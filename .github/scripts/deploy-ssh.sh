#!/usr/bin/env bash
set -euo pipefail
umask 077

for name in DEPLOY_HOST DEPLOY_USER DEPLOY_SSH_KEY DEPLOY_KNOWN_HOSTS DEPLOY_ROOT DEPLOY_PM2_NAME; do
  [[ -n "${!name:-}" ]] || { echo "Missing production setting: $name" >&2; exit 1; }
done
deploy_port=${DEPLOY_PORT:-22}
[[ "$DEPLOY_HOST" =~ ^[A-Za-z0-9][A-Za-z0-9.:-]*$ && "$DEPLOY_USER" =~ ^[A-Za-z_][A-Za-z0-9_-]*$ ]] || exit 2
[[ "$deploy_port" =~ ^[0-9]+$ && "$deploy_port" -ge 1 && "$deploy_port" -le 65535 ]] || exit 2
[[ "$DEPLOY_ROOT" =~ ^/[A-Za-z0-9_/-]+$ && "$DEPLOY_ROOT" != / ]] || exit 2
[[ "$DEPLOY_PM2_NAME" =~ ^[A-Za-z0-9_.-]+$ && "$GITHUB_SHA" =~ ^[a-f0-9]{40}$ ]] || exit 2
[[ "$GITHUB_RUN_ID" =~ ^[0-9]+$ && "$GITHUB_RUN_ATTEMPT" =~ ^[0-9]+$ ]] || exit 2
[[ "$GITHUB_REPOSITORY" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*/[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] || exit 2
[[ -f deployment.tgz ]] || { echo 'Deployment artifact is missing' >&2; exit 1; }

scratch=$(mktemp -d)
trap 'rm -rf -- "$scratch"' EXIT
printf '%s\n' "$DEPLOY_SSH_KEY" > "$scratch/key"
printf '%s\n' "$DEPLOY_KNOWN_HOSTS" > "$scratch/known_hosts"
chmod 600 "$scratch/key" "$scratch/known_hosts"
connection=( -i "$scratch/key" -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$scratch/known_hosts" -o ConnectTimeout=15 )
destination="$DEPLOY_USER@$DEPLOY_HOST"
copy_destination="$destination"
if [[ "$DEPLOY_HOST" == *:* ]]; then copy_destination="$DEPLOY_USER@[$DEPLOY_HOST]"; fi
run_id="$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT"
deploy_id="$GITHUB_SHA-$run_id"
# All remote arguments above are restricted to shell-safe characters.
ssh "${connection[@]}" -p "$deploy_port" "$destination" "test -d '$DEPLOY_ROOT/app' && mkdir -p '$DEPLOY_ROOT/.deploy/incoming' && chmod 700 '$DEPLOY_ROOT/.deploy' '$DEPLOY_ROOT/.deploy/incoming'"
scp "${connection[@]}" -P "$deploy_port" deployment.tgz "$copy_destination:$DEPLOY_ROOT/.deploy/incoming/$deploy_id.tgz"
ssh "${connection[@]}" -p "$deploy_port" "$destination" "bash -s -- '$DEPLOY_ROOT' '$DEPLOY_PM2_NAME' '$GITHUB_SHA' '$run_id' '$GITHUB_REPOSITORY'" < deploy/deploy.sh
