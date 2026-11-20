#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
if [[ " ${*} " != *" --demo "* ]]; then
  if ! command -v g++ >/dev/null || ! command -v make >/dev/null; then
    echo 'USB kullanımı için g++ ve make gereklidir. Sensörsüz açmak için: ./start.sh --demo' >&2
    exit 1
  fi
  make --no-print-directory
fi
exec python3 server.py --open "$@"
