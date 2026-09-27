#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/tool-path.sh"

api_pid=""
web_pid=""
cleanup() {
  if [[ -n "$api_pid" ]]; then
    kill "$api_pid" 2>/dev/null || true
  fi
  if [[ -n "$web_pid" ]]; then
    kill "$web_pid" 2>/dev/null || true
  fi
  wait || true
}
trap cleanup INT TERM

dotnet run --project src/Api --launch-profile http &
api_pid=$!
(cd web && npx ng serve --host 127.0.0.1 --port 4200) &
web_pid=$!

if [[ -z "${OPF_NO_OPEN:-}" ]]; then
  for _ in $(seq 1 90); do
    if curl -sf -o /dev/null "http://127.0.0.1:4200"; then
      if command -v open >/dev/null; then
        open "http://localhost:4200"
      elif command -v xdg-open >/dev/null; then
        xdg-open "http://localhost:4200"
      fi
      break
    fi
    sleep 1
  done
fi

wait
