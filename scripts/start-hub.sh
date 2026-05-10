#!/usr/bin/env bash
set -euo pipefail

STATIC_PORT="${STATIC_PORT:-4173}"
ADMIN_PORT="${ADMIN_PORT:-4174}"
HOST="${HOST:-127.0.0.1}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

require_cmd() {
  if ! command_exists "$1"; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

is_port_in_use() {
  local port="$1"
  if command_exists lsof; then
    lsof -iTCP:"${port}" -sTCP:LISTEN -n -P >/dev/null 2>&1
    return $?
  fi
  if command_exists nc; then
    nc -z "${HOST}" "${port}" >/dev/null 2>&1
    return $?
  fi
  return 1
}

wait_http_ready() {
  local url="$1"
  local timeout_sec="${2:-20}"
  local start_ts
  start_ts="$(date +%s)"
  while true; do
    if command_exists curl && curl -fsS "${url}" >/dev/null 2>&1; then
      return 0
    fi
    if (( "$(date +%s)" - start_ts >= timeout_sec )); then
      return 1
    fi
    sleep 0.3
  done
}

if is_port_in_use "${STATIC_PORT}"; then
  echo "Static port ${STATIC_PORT} is already in use." >&2
  exit 1
fi
if is_port_in_use "${ADMIN_PORT}"; then
  echo "Admin port ${ADMIN_PORT} is already in use." >&2
  exit 1
fi

require_cmd node
if command_exists python3; then
  PYTHON_BIN="python3"
elif command_exists python; then
  PYTHON_BIN="python"
else
  echo "Python not found. Install Python 3 first." >&2
  exit 1
fi

cleanup() {
  set +e
  if [[ -n "${STATIC_PID:-}" ]]; then kill "${STATIC_PID}" >/dev/null 2>&1 || true; fi
  if [[ -n "${ADMIN_PID:-}" ]]; then kill "${ADMIN_PID}" >/dev/null 2>&1 || true; fi
}

trap cleanup EXIT INT TERM

cd "${ROOT_DIR}"
"${PYTHON_BIN}" -m http.server "${STATIC_PORT}" --bind "${HOST}" >/dev/null 2>&1 &
STATIC_PID=$!

node "${ROOT_DIR}/hub/admin-server.mjs" >/dev/null 2>&1 &
ADMIN_PID=$!

SITE_URL="http://${HOST}:${STATIC_PORT}/hub/index.html"
ADMIN_HEALTH="http://${HOST}:${ADMIN_PORT}/health"

if ! wait_http_ready "${SITE_URL}" 20; then
  echo "Static site failed to start: ${SITE_URL}" >&2
  exit 1
fi
if ! wait_http_ready "${ADMIN_HEALTH}" 20; then
  echo "Admin API failed to start: ${ADMIN_HEALTH}" >&2
  exit 1
fi

echo
echo "Wiki Hub started successfully."
echo "Site : ${SITE_URL}"
echo "Admin: ${ADMIN_HEALTH}"
echo "Static PID: ${STATIC_PID}"
echo "Admin  PID: ${ADMIN_PID}"
echo
echo "Press Ctrl+C to stop both services."

wait
