CXX ?= g++
CXXFLAGS ?= -O2 -std=c++17 -Wall -Wextra
SDK_LIB = rplidar_sdk/output/$(shell uname -s)/Release/libsl_lidar_sdk.a
.PHONY: all sdk run demo test clean
all: build/lidar_bridge
sdk:
	$(MAKE) -C rplidar_sdk/sdk
$(SDK_LIB):
	$(MAKE) -C rplidar_sdk/sdk
build/lidar_bridge: lidar_bridge.cpp $(SDK_LIB)
	mkdir -p build
	$(CXX) $(CXXFLAGS) -Irplidar_sdk/sdk/include $< $(SDK_LIB) -pthread -o $@
run: all
	python3 server.py --open
demo:
	python3 server.py --demo --open
test:
	python3 -m unittest discover -s tests -v
	node tests/core.test.mjs
clean:
	rm -f build/lidar_bridge
