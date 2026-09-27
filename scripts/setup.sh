#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/tool-path.sh"

if ! dotnet --list-sdks | grep -q '^10\.'; then
  echo ".NET 10 SDK was not found."
  exit 1
fi

node_ok="$(node -p "const [maj, min] = process.versions.node.split('.').map(Number); (maj > 22 || (maj === 22 && min >= 22)) ? 'yes' : 'no'")"
if [[ "$node_ok" != "yes" ]]; then
  echo "Node.js 22.22 or newer is required."
  exit 1
fi

if ! psql -d postgres -tA -c "SELECT 1" >/dev/null; then
  echo "Postgres is not accepting connections. Start it, or set PGHOST and PGUSER."
  exit 1
fi

tmp="$(mktemp)"
OPF_ENV_FILE="$tmp" python3 <<'PY'
import json, os, secrets, subprocess
from pathlib import Path

out = Path(os.environ["OPF_ENV_FILE"])
home = Path.home() / ".microsoft" / "usersecrets"
api = home / "oregon-provider-finder-api" / "secrets.json"
importer = home / "oregon-provider-finder-importer" / "secrets.json"

def read_pair(path):
    if not path.exists():
        return None
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    owner = data.get("ConnectionStrings:Owner")
    app = data.get("ConnectionStrings:App")
    if owner and app:
        return owner, app
    return None

pair = read_pair(api)
if pair is None:
    owner_pw = secrets.token_hex(24)
    app_pw = secrets.token_hex(24)
    owner = f"Host=localhost;Port=5432;Database=oregon_providers;Username=opf_owner;Password={owner_pw}"
    app = f"Host=localhost;Port=5432;Database=oregon_providers;Username=opf_app;Password={app_pw}"
else:
    owner, app = pair

def password_of(connection, user):
    for part in connection.split(";"):
        if part.startswith("Password="):
            return part.split("=", 1)[1]
    raise SystemExit(f"ConnectionStrings for {user} has no password.")

owner_pw = password_of(owner, "opf_owner")
app_pw = password_of(app, "opf_app")

def quote(value):
    return "'" + value.replace("'", "''") + "'"

def psql(sql, database="postgres"):
    cmd = ["psql", "-v", "ON_ERROR_STOP=1", "-q", "-d", database]
    host = os.environ.get("PGHOST")
    user = os.environ.get("PGUSER")
    if host:
        cmd[1:1] = ["-h", host]
    if user:
        cmd[1:1] = ["-U", user]
    subprocess.run(cmd, input=sql, text=True, check=True)

psql(f"""
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'opf_owner') THEN
    CREATE ROLE opf_owner LOGIN PASSWORD {quote(owner_pw)};
  ELSE
    ALTER ROLE opf_owner WITH LOGIN PASSWORD {quote(owner_pw)};
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'opf_app') THEN
    CREATE ROLE opf_app LOGIN PASSWORD {quote(app_pw)};
  ELSE
    ALTER ROLE opf_app WITH LOGIN PASSWORD {quote(app_pw)};
  END IF;
END
$$;
""")

for database in ("oregon_providers", "oregon_providers_test"):
    probe = subprocess.run(
        ["psql", "-d", "postgres", "-tA", "-c", f"SELECT 1 FROM pg_database WHERE datname = '{database}'"],
        text=True, capture_output=True, check=True)
    if probe.stdout.strip() != "1":
        psql(f"CREATE DATABASE {database} OWNER opf_owner")
    psql("CREATE EXTENSION IF NOT EXISTS pg_trgm;", database)

def with_database(connection, database):
    parts = []
    seen = False
    for part in connection.split(";"):
        if part.lower().startswith("database="):
            parts.append(f"Database={database}")
            seen = True
        elif part:
            parts.append(part)
    if not seen:
        parts.append(f"Database={database}")
    return ";".join(parts)

owner_main = with_database(owner, "oregon_providers")
owner_test = with_database(owner, "oregon_providers_test")
app_main = with_database(app, "oregon_providers")
app_test = with_database(app, "oregon_providers_test")

for project in ("src/Api", "src/Importer"):
    for key, value in (("ConnectionStrings:Owner", owner_main), ("ConnectionStrings:App", app_main)):
        subprocess.run(["dotnet", "user-secrets", "set", key, value, "--project", project], check=True)

out.write_text(
    "export OPF_OWNER_MAIN=" + json.dumps(owner_main) + "\n"
    "export OPF_OWNER_TEST=" + json.dumps(owner_test) + "\n"
    "export OPF_APP_TEST=" + json.dumps(app_test) + "\n"
)
PY

# shellcheck disable=SC1090
source "$tmp"
rm -f "$tmp"

dotnet tool restore
OPF_OWNER_CONNECTION="$OPF_OWNER_MAIN" dotnet ef database update --project src/Core --startup-project src/Core
OPF_OWNER_CONNECTION="$OPF_OWNER_TEST" dotnet ef database update --project src/Core --startup-project src/Core

python3 - <<'PY'
import os, subprocess

def psql(sql, database):
    cmd = ["psql", "-v", "ON_ERROR_STOP=1", "-q", "-d", database]
    host = os.environ.get("PGHOST")
    user = os.environ.get("PGUSER")
    if host:
        cmd[1:1] = ["-h", host]
    if user:
        cmd[1:1] = ["-U", user]
    subprocess.run(cmd, input=sql, text=True, check=True)

grant = """
GRANT USAGE ON SCHEMA public TO opf_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO opf_app;
"""
for database in ("oregon_providers", "oregon_providers_test"):
    psql(grant, database)
    psql(f"GRANT CONNECT ON DATABASE {database} TO opf_app", "postgres")
PY

import_into() {
  OPF_OWNER_CONNECTION="$1" dotnet run --project src/Importer --configuration Release -- import geo
  OPF_OWNER_CONNECTION="$1" dotnet run --project src/Importer --configuration Release -- import taxonomy
  OPF_OWNER_CONNECTION="$1" dotnet run --project src/Importer --configuration Release -- import snapshot
}
import_into "$OPF_OWNER_MAIN"
import_into "$OPF_OWNER_TEST"
unset OPF_OWNER_MAIN OPF_OWNER_TEST OPF_APP_TEST

(cd web && npm ci)
echo "Next: ./scripts/dev.sh"
