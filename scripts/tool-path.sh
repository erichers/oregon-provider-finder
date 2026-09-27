#!/usr/bin/env bash
# Puts the local toolchain on PATH when this checkout has one. CI and other machines use PATH.
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -d "$root/.tools/dotnet" ]]; then
  export PATH="$root/.tools/dotnet:$PATH"
  export DOTNET_ROOT="$root/.tools/dotnet"
fi
if [[ -d "$root/.tools/node/bin" ]]; then
  export PATH="$root/.tools/node/bin:$PATH"
fi
if [[ -d /usr/local/opt/postgresql@18/bin ]]; then
  export PATH="/usr/local/opt/postgresql@18/bin:$PATH"
fi
export DOTNET_CLI_TELEMETRY_OPTOUT=1
export DOTNET_NOLOGO=1
cd "$root"
