#!/usr/bin/env bash
# Standard Git fallback when this workspace's root .git is mounted read-only.
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
if [[ -f .git/HEAD || -f .git ]]; then
  exec git "$@"
fi
exec git --git-dir=.git-local --work-tree=. "$@"
