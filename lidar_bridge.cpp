// RPLIDAR Lab native adapter. Vendor SDK remains BSD-2-Clause.
#include "sl_lidar.h"
#include "sl_lidar_driver.h"
#include <algorithm>
#include <chrono>
#include <cmath>
#include <csignal>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <poll.h>
#include <string>
#include <unistd.h>
#include <vector>
using namespace sl;
static volatile sig_atomic_t exiting = 0;
static void on_signal(int) { exiting = 1; }
static std::string quote(const std::string &s) {
  std::string out = "\"";
  for (unsigned char c : s) {
    if (c == '"' || c == '\\') {
      out += '\\';
      out += c;
    } else if (c < 32) {
      char b[7];
      snprintf(b, sizeof b, "\\u%04x", c);
      out += b;
    } else
      out += c;
  }
  return out + '"';
}
static void error(const char *message, sl_result code = 0) {
  printf("{\"type\":\"error\",\"message\":%s,\"code\":%u}\n",
         quote(message).c_str(), unsigned(code));
}
static const char *technology(LIDARTechnologyType t) {
  switch (t) {
  case LIDAR_TECHNOLOGY_TRIANGULATION:
    return "Laser triangulation";
  case LIDAR_TECHNOLOGY_DTOF:
    return "dToF";
  case LIDAR_TECHNOLOGY_ETOF:
    return "eToF";
  case LIDAR_TECHNOLOGY_FMCW:
    return "FMCW";
  default:
    return "Unknown";
  }
}
int main(int argc, char **argv) {
  setvbuf(stdout, nullptr, _IOLBF, 0);
  signal(SIGINT, on_signal);
  signal(SIGTERM, on_signal);
  signal(SIGPIPE, SIG_IGN);
  if (argc < 2) {
    error("Serial port argument required");
    return 2;
  }
  unsigned requested = argc > 2 ? strtoul(argv[2], nullptr, 10) : 0;
  unsigned rates[] = {115200, 256000, 460800, 1000000};
  ILidarDriver *driver = nullptr;
  IChannel *channel = nullptr;
  sl_lidar_response_device_info_t info{};
  unsigned baud = 0;
  for (unsigned rate : rates) {
    if (exiting)
      break;
    if (requested)
      rate = requested;
    driver = *createLidarDriver();
    channel = *createSerialPortChannel(argv[1], rate);
    if (driver && channel && SL_IS_OK(driver->connect(channel)) &&
        SL_IS_OK(driver->getDeviceInfo(info, 1200))) {
      baud = rate;
      break;
    }
    delete driver;
    driver = nullptr;
    delete channel;
    channel = nullptr;
    if (requested)
      break;
  }
  if (!baud) {
    error(
        "Device handshake failed; check port, access permission and baud rate");
    return 1;
  }
  std::string model = "RPLIDAR";
  driver->getModelNameDescriptionString(model, false, &info);
  char serial[33]{};
  for (int i = 0; i < 16; ++i)
    snprintf(serial + 2 * i, 3, "%02X", info.serialnum[i]);
  sl_lidar_response_device_health_t health{};
  int health_status = -1, health_code = 0;
  if (SL_IS_OK(driver->getHealth(health))) {
    health_status = health.status;
    health_code = health.error_code;
  }
  std::vector<LidarScanMode> modes;
  bool modes_known = SL_IS_OK(driver->getAllSupportedScanModes(modes));
  MotorCtrlSupport support = MotorCtrlSupportNone;
  bool motor_known = SL_IS_OK(driver->checkMotorCtrlSupport(support));
  LidarMotorInfo motor{};
  motor.motorCtrlSupport = support;
  // This SDK's range query describes rotation limits, not a portable PWM range.
  // Only expose a numeric control for RPM devices with a successful range
  // query.
  bool range_known = motor_known && support == MotorCtrlSupportRpm &&
                     SL_IS_OK(driver->getMotorInfo(motor)) &&
                     motor.max_speed > motor.min_speed;
  printf("{\"type\":\"device_info\",\"port\":%s,\"baudrate\":%u,\"model\":%s,"
         "\"model_id\":%u,\"serial\":%s,\"firmware\":\"%u.%02u\",\"hardware\":%"
         "u,\"technology\":%s,\"health_status\":%d,\"health_error\":%d,\"modes_"
         "known\":%s,\"scan_modes\":[",
         quote(argv[1]).c_str(), baud, quote(model).c_str(), info.model,
         quote(serial).c_str(), info.firmware_version >> 8,
         info.firmware_version & 255, info.hardware_version,
         quote(technology(driver->getLIDARTechnologyType(&info))).c_str(),
         health_status, health_code, modes_known ? "true" : "false");
  for (size_t i = 0; i < modes.size(); ++i) {
    auto &m = modes[i];
    printf("%s{\"id\":%u,\"name\":%s,\"us_per_sample\":%.3f,\"max_distance_m\":"
           "%.3f}",
           i ? "," : "", m.id,
           quote(std::string(m.scan_mode, strnlen(m.scan_mode, 64))).c_str(),
           std::isfinite(m.us_per_sample) ? m.us_per_sample : 0,
           std::isfinite(m.max_distance) ? m.max_distance : 0);
  }
  printf("],\"motor\":{\"support\":%d,\"known\":%s,\"adjustable\":%s,\"unit\":"
         "\"rpm\",\"min\":%u,\"max\":%u}}\n",
         int(support), motor_known ? "true" : "false",
         range_known ? "true" : "false", motor.min_speed, motor.max_speed);
  LidarScanMode current{};
  bool scanning = false;
  int selected = -1;
  unsigned motor_speed = 0;
  unsigned long seq = 0;
  auto status = [&]() {
    printf("{\"type\":\"status\",\"scanning\":%s,\"mode\":%s,\"mode_id\":%u,"
           "\"motor_requested\":%u}\n",
           scanning ? "true" : "false", quote(current.scan_mode).c_str(),
           current.id, motor_speed);
  };
  auto stop = [&]() {
    auto a = driver->stop();
    auto b = driver->setMotorSpeed(0);
    scanning = false;
    return SL_IS_OK(a) && SL_IS_OK(b);
  };
  auto start = [&]() {
    if (health_status != SL_LIDAR_STATUS_OK &&
        health_status != SL_LIDAR_STATUS_WARNING) {
      error("Health unavailable or device reports an internal fault; scan "
            "inhibited");
      status();
      return false;
    }
    sl_result r = motor_speed ? driver->setMotorSpeed(motor_speed)
                              : driver->setMotorSpeed();
    if (SL_IS_OK(r))
      r = selected < 0
              ? driver->startScan(false, true, 0, &current)
              : driver->startScanExpress(false, sl_u16(selected), 0, &current);
    scanning = SL_IS_OK(r);
    if (!scanning) {
      error("Scan start failed", r);
      driver->setMotorSpeed(0);
    }
    status();
    return scanning;
  };
  start();
  std::string input;
  int failures = 0;
  while (!exiting) {
    pollfd fd{STDIN_FILENO, POLLIN, 0};
    if (poll(&fd, 1, scanning ? 0 : 50) > 0) {
      if (fd.revents & (POLLHUP | POLLERR))
        break;
      if (fd.revents & POLLIN) {
        char buffer[256];
        ssize_t n = read(STDIN_FILENO, buffer, sizeof buffer);
        if (n <= 0)
          break;
        input.append(buffer, size_t(n));
        if (input.size() > 2048) {
          error("Command too long");
          break;
        }
        size_t end;
        while ((end = input.find('\n')) != std::string::npos) {
          std::string cmd = input.substr(0, end);
          input.erase(0, end + 1);
          bool ok = false;
          if (cmd == "QUIT") {
            exiting = 1;
            break;
          }
          if (cmd == "PAUSE") {
            ok = stop();
            status();
          } else if (cmd == "RESUME") {
            ok = scanning || start();
          } else if (cmd == "HEALTH") {
            bool was = scanning;
            driver->stop();
            scanning = false;
            auto r = driver->getHealth(health);
            ok = SL_IS_OK(r);
            health_status = ok ? health.status : -1;
            health_code = ok ? health.error_code : 0;
            printf("{\"type\":\"health\",\"health_status\":%d,\"health_error\":"
                   "%d}\n",
                   health_status, health_code);
            if (was)
              start();
            else
              status();
          } else if (cmd.rfind("MODE ", 0) == 0) {
            int id = atoi(cmd.c_str() + 5);
            auto it = std::find_if(
                modes.begin(), modes.end(),
                [&](const LidarScanMode &m) { return m.id == id; });
            if (it != modes.end()) {
              bool was = scanning;
              driver->stop();
              scanning = false;
              selected = id;
              if (!was)
                current = *it;
              ok = was ? start() : true;
              status();
            }
          } else if (cmd.rfind("MOTOR ", 0) == 0) {
            unsigned speed = strtoul(cmd.c_str() + 6, nullptr, 10);
            if (range_known && speed >= motor.min_speed &&
                speed <= motor.max_speed) {
              bool was = scanning;
              driver->stop();
              scanning = false;
              motor_speed = speed;
              ok = was ? start() : true;
              status();
            }
          }
          printf("{\"type\":\"command\",\"command\":%s,\"ok\":%s}\n",
                 quote(cmd).c_str(), ok ? "true" : "false");
          failures = 0;
        }
      }
    }
    if (!scanning || exiting)
      continue;
    sl_lidar_response_measurement_node_hq_t nodes[8192];
    size_t count = 8192;
    sl_result r = driver->grabScanDataHq(nodes, count, 1000);
    if (SL_IS_FAIL(r)) {
      error("Scan data timeout or transport error", r);
      if (++failures >= 4)
        break;
      continue;
    }
    failures = 0;
    driver->ascendScanData(nodes, count);
    float hz = 0;
    driver->getFrequency(current, nodes, count, hz);
    printf("{\"type\":\"scan\",\"seq\":%lu,\"hz\":%.3f,\"mode\":%s,\"raw_"
           "count\":%zu,\"points\":[",
           ++seq, std::isfinite(hz) ? hz : 0, quote(current.scan_mode).c_str(),
           count);
    bool first = true;
    for (size_t i = 0; i < count; ++i) {
      float distance = nodes[i].dist_mm_q2 / 4.f;
      if (distance > 0) {
        printf("%s[%.3f,%.2f,%u]", first ? "" : ",",
               nodes[i].angle_z_q14 * 90.f / 16384.f, distance,
               nodes[i].quality >> SL_LIDAR_RESP_MEASUREMENT_QUALITY_SHIFT);
        first = false;
      }
    }
    printf("]}\n");
  }
  stop();
  status();
  delete driver;
  delete channel;
  return exiting ? 0 : 1;
}
