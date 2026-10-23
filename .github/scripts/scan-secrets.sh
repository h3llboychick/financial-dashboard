#!/usr/bin/env bash
# Read committed history only: local ignored credentials are never opened.
set -euo pipefail
if [[ $# -lt 1 || $# -gt 2 ]]; then
  printf 'Usage: %s GITLEAKS_BINARY [REPOSITORY]\n' "$0" >&2
  exit 2
fi
exec "$1" git --redact=100 --no-banner --no-color --verbose \
  --exit-code=1 --log-opts='--all' "${2:-.}"
