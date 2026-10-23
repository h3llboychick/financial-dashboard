#!/usr/bin/env bash
# MIT-licensed upstream CLI, without the separately licensed GitHub Action.
# Release: https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1
# Checksum: https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_checksums.txt
set -euo pipefail
umask 077

readonly version='8.30.1'
readonly archive_sha256='551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb'
readonly release_url="https://github.com/gitleaks/gitleaks/releases/download/v${version}/gitleaks_${version}_linux_x64.tar.gz"

if [[ $# -ne 1 || -z "$1" ]]; then
  printf 'Usage: %s INSTALL_DIRECTORY\n' "$0" >&2
  exit 2
fi
if [[ "$(uname -s)" != Linux || "$(uname -m)" != x86_64 ]]; then
  printf 'The pinned Gitleaks installer supports Linux x86_64 only.\n' >&2
  exit 2
fi

destination=$1
scratch=$(mktemp -d "${TMPDIR:-/tmp}/financial-dashboard-gitleaks.XXXXXX")
trap 'rm -rf -- "$scratch"' EXIT

curl --proto '=https' --proto-redir '=https' --tlsv1.2 --fail --silent --show-error \
  --location --retry 3 --output "$scratch/archive.tar.gz" "$release_url"
if ! printf '%s  %s\n' "$archive_sha256" "$scratch/archive.tar.gz" | sha256sum --check --status; then
  printf 'Gitleaks %s checksum verification failed; refusing to install.\n' "$version" >&2
  exit 1
fi

tar -xzf "$scratch/archive.tar.gz" -C "$scratch" gitleaks LICENSE
if [[ "$("$scratch/gitleaks" version)" != "$version" ]]; then
  printf 'Gitleaks version verification failed; refusing to install.\n' >&2
  exit 1
fi
mkdir -p -- "$destination"
install -m 0755 -- "$scratch/gitleaks" "$destination/gitleaks"
install -m 0644 -- "$scratch/LICENSE" "$destination/GITLEAKS-LICENSE"
printf 'Installed verified Gitleaks %s.\n' "$version"
