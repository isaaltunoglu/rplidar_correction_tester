#!/usr/bin/env python3
"""Package tracked source files only; omit local history, secrets and binaries."""

import hashlib
import subprocess
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
result = subprocess.run(
    [str(ROOT / "scripts/git.sh"), "ls-files", "-z"], cwd=ROOT, check=True, capture_output=True
)
files = [Path(p.decode()) for p in result.stdout.split(b"\0") if p]
if not files:
    raise SystemExit("No tracked source files. Stage reviewed files first.")
out = ROOT / "dist/rplidar-lab-1.0.0.tar.gz"
out.parent.mkdir(exist_ok=True)
with tarfile.open(out, "w:gz") as archive:
    for path in files:
        if (
            path.parts[0]
            in (".git", ".git-local", ".aws", ".codex", ".agents", "dist", "artifacts")
            or ".git" in path.parts
            or path.name.startswith(".env")
        ):
            continue
        archive.add(ROOT / path, arcname=str(Path("rplidar-lab") / path), recursive=False)
checksum = hashlib.sha256(out.read_bytes()).hexdigest()
out.with_suffix(out.suffix + ".sha256").write_text(f"{checksum}  {out.name}\n")
print(out)
print(checksum)
