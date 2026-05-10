#!/usr/bin/env bash
set -euo pipefail

STATIC_PORT="${STATIC_PORT:-4173}"
ADMIN_PORT="${ADMIN_PORT:-4174}"

kill_port() {
  local port="$1"
  local pids=""
  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -tiTCP:${port} -sTCP:LISTEN || true)"
  elif command -v fuser >/dev/null 2>&1; then
    pids="$(fuser ${port}/tcp 2>/dev/null || true)"
  fi

  if [[ -z "${pids}" ]]; then
    echo "Port ${port}: no listening process"
    return
  fi

  for pid in ${pids}; do
    kill -9 "${pid}" >/dev/null 2>&1 || true
    echo "Port ${port}: stopped PID ${pid}"
  done
}

kill_port "${STATIC_PORT}"
kill_port "${ADMIN_PORT}"
