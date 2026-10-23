#!/usr/bin/env bash
# Exercise the CI scanner against disposable repositories; never scan local .env files.
set -euo pipefail
umask 077

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
project_dir=$(cd -- "$script_dir/../.." && pwd)
gitleaks_bin=${1:-}

fail() { printf 'Secret-scanning regression failed: %s\n' "$1" >&2; exit 1; }

# The workflow must retain the history scan as a separate read-only job.
node - "$project_dir/.github/workflows/ci.yml" <<'NODE'
const fs = require('node:fs');
const assert = require('node:assert/strict');
const workflow = fs.readFileSync(process.argv[2], 'utf8');
assert.match(workflow, /^  secret-scan:\s*$/m, 'CI must have a separate secret-scan job');
assert.match(workflow, /fetch-depth: 0/, 'secret scan must fetch the full history');
assert.match(workflow, /persist-credentials: false/, 'scanner checkout must not retain a token');
assert.match(workflow, /contents: read/, 'workflow must use a read-only token');
assert.doesNotMatch(workflow, /pull_request_target|contents:\s*write|GITLEAKS_LICENSE/);
assert.match(workflow, /bash \.github\/scripts\/install-gitleaks\.sh/);
assert.match(workflow, /bash \.github\/scripts\/test-secret-scanning\.sh/);
assert.match(workflow, /bash \.github\/scripts\/scan-secrets\.sh/);
NODE

[[ -x "$gitleaks_bin" ]] || fail 'pass the installed Gitleaks binary path'
gitleaks_bin=$(realpath -- "$gitleaks_bin")
scratch=$(mktemp -d "${TMPDIR:-/tmp}/financial-dashboard-secret-smoke.XXXXXX")
trap 'rm -rf -- "$scratch"' EXIT

# Network-independent tampering test: a corrupted download must never be executed or installed.
mkdir "$scratch/bin" "$scratch/install"
cat > "$scratch/bin/curl" <<'CURL'
#!/usr/bin/env bash
set -euo pipefail
while (( $# )); do
  if [[ "$1" == --output ]]; then printf 'invalid archive\n' > "$2"; exit 0; fi
  shift
done
exit 2
CURL
chmod 700 "$scratch/bin/curl"
if PATH="$scratch/bin:$PATH" bash "$script_dir/install-gitleaks.sh" "$scratch/install" > "$scratch/checksum.log" 2>&1; then
  fail 'installer accepted a corrupted download'
fi
grep -q 'checksum verification failed' "$scratch/checksum.log" || fail 'installer must explain a checksum failure'
[[ ! -e "$scratch/install/gitleaks" ]] || fail 'failed installation left an executable'

repo="$scratch/repo"
git init --quiet "$repo"
git -C "$repo" config user.name 'Secret scanner regression'
git -C "$repo" config user.email 'secret-scanner@example.invalid'
cp -- "$project_dir/.gitleaks.toml" "$repo/.gitleaks.toml"
cp -- "$project_dir/.gitleaksignore" "$repo/.gitleaksignore"
printf 'A clean fixture.\n' > "$repo/README"
printf '.env\n' > "$repo/.gitignore"
# Generate a nonfunctional token at runtime; an ignored local .env must never be scanned.
synthetic_token="ghp_$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 36 || true)"
[[ ${#synthetic_token} -eq 40 ]] || fail 'could not generate a synthetic token'
printf 'api_token = "%s"\n' "$synthetic_token" > "$repo/.env"
git -C "$repo" add README .gitleaks.toml .gitleaksignore .gitignore
git -C "$repo" commit --quiet -m 'clean fixture'
bash "$script_dir/scan-secrets.sh" "$gitleaks_bin" "$repo" > "$scratch/clean.log" 2>&1 || fail 'clean history scan failed'

# Use the historical exception path: a new finding in that file must still fail.
mkdir -p "$repo/server/src/modules/auth"
printf ' * token: %s\n' "$synthetic_token" > "$repo/server/src/modules/auth/auth.routes.js"
git -C "$repo" add server/src/modules/auth/auth.routes.js
git -C "$repo" commit --quiet -m 'synthetic secret fixture'
# Remove it in HEAD to prove historical findings are detected too.
git -C "$repo" rm --quiet server/src/modules/auth/auth.routes.js
git -C "$repo" commit --quiet -m 'remove fixture from HEAD'
set +e
bash "$script_dir/scan-secrets.sh" "$gitleaks_bin" "$repo" > "$scratch/finding.log" 2>&1
scan_status=$?
set -e
[[ "$scan_status" -eq 1 ]] || fail 'historical synthetic secret must fail with exit code 1'
grep -q 'leaks found' "$scratch/finding.log" || fail 'scan did not report the synthetic finding'
grep -Eq 'Secret:[[:space:]]+REDACTED' "$scratch/finding.log" || fail 'findings must be explicitly redacted'
if grep -Fq -- "$synthetic_token" "$scratch/finding.log"; then
  fail 'scanner exposed the synthetic secret instead of redacting it'
fi
printf 'Secret-scanning regressions passed: clean history, historical detection, redaction, checksum rejection.\n'
