#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/tool-path.sh"

download=""
export_snapshot=""
for arg in "$@"; do
  case "$arg" in
    --download-latest) download=1 ;;
    --export) export_snapshot=1 ;;
    *)
      echo "Usage: ./scripts/refresh-data.sh [--download-latest] [--export]"
      exit 1
      ;;
  esac
done

args=(import full)
if [[ -n "$download" ]]; then
  args+=(--download-latest)
fi
dotnet run --project src/Importer --configuration Release -- "${args[@]}"
if [[ -n "$export_snapshot" ]]; then
  dotnet run --project src/Importer --configuration Release -- export snapshot
fi
