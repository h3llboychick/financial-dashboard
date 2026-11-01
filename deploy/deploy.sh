#!/usr/bin/env bash
# Update the existing checkout as its PM2 owner. Never enable shell tracing.
set -euo pipefail
umask 077

[[ $# -eq 5 ]] || { echo 'Usage: deploy.sh PROJECT_ROOT PM2_NAME COMMIT RUN_ID REPOSITORY' >&2; exit 2; }
project_root=$1
app_name=$2
target=$3
run_id=$4
repository=$5
[[ "$project_root" =~ ^/[A-Za-z0-9_/-]+$ && "$project_root" != / ]] || exit 2
[[ "$app_name" =~ ^[A-Za-z0-9_.-]+$ && "$target" =~ ^[a-f0-9]{40}$ && "$run_id" =~ ^[0-9]+-[0-9]+$ ]] || exit 2
[[ "$repository" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*/[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] || exit 2
for executable in node npm pm2 git flock tar; do command -v "$executable" >/dev/null || { echo "Missing $executable in non-interactive SSH PATH" >&2; exit 1; }; done
project_root=$(realpath -e "$project_root")
app="$project_root/app"
state="$project_root/.deploy"
deploy_id="$target-$run_id"
archive="$state/incoming/$deploy_id.tgz"
work="$state/$deploy_id"
backup="$project_root/backups/$deploy_id"
[[ -f "$archive" && ! -e "$work" ]] || { echo 'Missing artifact or deployment attempt already exists; rerun CI with a new attempt.' >&2; exit 1; }
exec 9>"$state/deploy.lock"
flock -n 9 || { echo 'Another deployment is running' >&2; exit 1; }
mkdir "$work"
tar -xzf "$archive" -C "$work" --no-same-owner --no-same-permissions
[[ "$(cat "$work/COMMIT")" == "$target" && -f "$work/client/dist/index.html" ]] || { echo 'Frontend artifact does not match the tested commit' >&2; exit 1; }
helpers="$work/deploy"
node "$helpers/settings.cjs" "$project_root"
pm2 jlist | node "$helpers/check-pm2.cjs" "$project_root" "$app_name"
node "$helpers/backup-database.cjs" "$project_root" --check
[[ "$(git -C "$app" rev-parse --show-toplevel)" == "$app" ]] || { echo 'app/ must be the Git checkout root' >&2; exit 1; }
[[ -z "$(git -C "$app" status --porcelain --untracked-files=all)" ]] || { echo 'Checkout has uncommitted changes; refusing to overwrite them.' >&2; exit 1; }
origin=$(git -C "$app" config --get remote.origin.url)
case "$origin" in
  "https://github.com/$repository"|"https://github.com/$repository.git"|"git@github.com:$repository.git"|"ssh://git@github.com/$repository.git") ;;
  *) echo 'Checkout origin does not match the GitHub repository' >&2; exit 1 ;;
esac
previous=$(git -C "$app" rev-parse HEAD)
# The public repository needs no GitHub credential on the server.
GIT_TERMINAL_PROMPT=0 git -C "$app" fetch --no-tags "https://github.com/$repository.git" "$target"
git -C "$app" cat-file -e "$target^{commit}"
git -C "$app" merge-base --is-ancestor "$previous" "$target" || { echo 'Target does not contain the existing checkout history; refusing to discard commits.' >&2; exit 1; }
mkdir -p "$project_root/backups"
chmod 700 "$project_root/backups"

stopped=0
changed=0
recover_on_failure() {
  local result=$?
  trap - EXIT
  if (( result != 0 && stopped == 1 )); then
    if (( changed == 0 )); then
      echo 'Deployment failed before the checkout changed; restarting the existing process.' >&2
      if pm2 restart "$app_name" >/dev/null; then pm2 save >/dev/null || true; fi
    else
      pm2 stop "$app_name" >/dev/null || true
      pm2 save >/dev/null || true
      echo "Deployment failed. PM2 is stopped; previous commit: $previous; database backup: $backup. Recover manually before reopening traffic." >&2
    fi
  fi
  exit "$result"
}
trap recover_on_failure EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP

stopped=1
pm2 stop "$app_name"
# Persist the stopped state before changing files, including across a reboot or
# a hard-killed SSH session that cannot run the failure trap.
pm2 save
node "$helpers/backup-database.cjs" "$project_root" "$backup" "$previous" "$target"
changed=1
git -C "$app" checkout --detach "$target"
[[ "$(git -C "$app" rev-parse HEAD)" == "$target" ]] || exit 1
npm ci --prefix "$app" --omit=dev --no-audit --no-fund
npm ci --prefix "$app/server" --omit=dev --no-audit --no-fund
# Replace generated output, including obsolete assets, while PM2 is stopped.
[[ ! -L "$app/client" && ! -L "$app/client/dist" ]] || { echo 'Refusing a symlinked frontend output directory' >&2; exit 1; }
rm -rf -- "$app/client/dist"
cp -R -- "$work/client/dist" "$app/client/dist"
node "$helpers/settings.cjs" "$project_root"
NODE_ENV=production APP_REVISION="$target" pm2 restart "$app_name" --update-env
node "$helpers/check-health.cjs" "$project_root" "$target"
pm2 save
printf '%s\n' "$target" > "$state/deployed-commit.tmp"
mv -f "$state/deployed-commit.tmp" "$state/deployed-commit"
stopped=0
rm -- "$archive"
rm -rf -- "$work"
echo "Deployed $target successfully."
