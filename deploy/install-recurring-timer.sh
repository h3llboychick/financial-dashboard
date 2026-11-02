#!/usr/bin/env bash
#
# Installs the systemd timer that keeps recurring payments materialised.
#
# Run once, as root, from the deployed app directory:
#
#   cd /path/to/DEPLOY_ROOT/app
#   sudo bash deploy/install-recurring-timer.sh
#
# Safe to re-run: it rewrites the unit files and restarts the timer.
set -euo pipefail

SERVICE_NAME="financial-dashboard-recurring"
UNIT_DIR="/etc/systemd/system"

fail() {
  printf 'error: %s\n' "$1" >&2
  exit 1
}

[[ "$(id -u)" == "0" ]] || fail "run this as root, for example: sudo bash deploy/install-recurring-timer.sh"

APP_DIR="$(pwd -P)"
[[ -f "$APP_DIR/deploy/recurring-run.mjs" ]] || fail "run this from the app directory (deploy/recurring-run.mjs not found in $APP_DIR)"
[[ -f "$APP_DIR/server/.env" ]] || fail "server/.env not found in $APP_DIR; deploy the app first"

SERVICE_USER="$(stat -c '%U' "$APP_DIR")"
[[ "$SERVICE_USER" != "root" ]] || fail "app directory is owned by root; expected a dedicated app user"

NODE_BIN="$(command -v node || true)"
[[ -n "$NODE_BIN" ]] || fail "node is not in PATH"

if ! grep -qE '^RECURRING_RUN_TOKEN=.+' "$APP_DIR/server/.env"; then
  fail "RECURRING_RUN_TOKEN is missing from $APP_DIR/server/.env (generate one with: openssl rand -hex 32)"
fi

PORT="$(grep -m1 -E '^PORT=' "$APP_DIR/server/.env" | cut -d= -f2 | tr -d '[:space:]')"
PORT="${PORT:-3001}"

# Prove the endpoint exists and refuses a bad token, without creating anything.
if ! "$NODE_BIN" -e "
  fetch('http://127.0.0.1:${PORT}/internal/recurring/run', {
    method: 'POST',
    headers: { 'x-service-token': 'installer-probe' },
  })
    .then(response => process.exit(response.status === 401 ? 0 : 1))
    .catch(() => process.exit(1))
"; then
  fail "the API did not answer 401 on 127.0.0.1:${PORT}/internal/recurring/run; is it running and deployed with recurring support?"
fi

render() {
  sed \
    -e "s|@APP_DIR@|${APP_DIR}|g" \
    -e "s|@SERVICE_USER@|${SERVICE_USER}|g" \
    -e "s|@NODE_BIN@|${NODE_BIN}|g" \
    "$1" > "$2"
  chmod 644 "$2"
}

render "$APP_DIR/deploy/recurring-timer.service.in" "$UNIT_DIR/${SERVICE_NAME}.service"
render "$APP_DIR/deploy/recurring-timer.timer.in" "$UNIT_DIR/${SERVICE_NAME}.timer"
chmod 644 "$UNIT_DIR/${SERVICE_NAME}.timer"

systemctl daemon-reload
systemctl enable --now "${SERVICE_NAME}.timer"
systemctl restart "${SERVICE_NAME}.timer"

printf '\nInstalled %s.service and %s.timer\n' "$SERVICE_NAME" "$SERVICE_NAME"
printf '  app dir: %s\n  user:    %s\n  node:    %s\n\n' "$APP_DIR" "$SERVICE_USER" "$NODE_BIN"
systemctl list-timers "${SERVICE_NAME}.timer" --no-pager || true
