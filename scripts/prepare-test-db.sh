#!/usr/bin/env bash
# Builds oregon_providers_test for CI. The password is only for the ephemeral Postgres service.
set -euo pipefail

password="${OPF_CI_PASSWORD:-ci}"
export PGPASSWORD="$password"
psql=(psql -h localhost -U postgres -v ON_ERROR_STOP=1)

"${psql[@]}" -d postgres <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'opf_owner') THEN
    CREATE ROLE opf_owner LOGIN PASSWORD '${password}';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'opf_app') THEN
    CREATE ROLE opf_app LOGIN PASSWORD '${password}';
  END IF;
END
\$\$;
SQL

exists="$("${psql[@]}" -d postgres -tA -c "SELECT 1 FROM pg_database WHERE datname = 'oregon_providers_test'")"
if [[ "$exists" != "1" ]]; then
  "${psql[@]}" -d postgres -c "CREATE DATABASE oregon_providers_test OWNER opf_owner"
fi

export OPF_OWNER_CONNECTION="Host=localhost;Port=5432;Database=oregon_providers_test;Username=opf_owner;Password=${password}"
dotnet tool restore
dotnet ef database update --project src/Core --startup-project src/Api

"${psql[@]}" -d oregon_providers_test <<'SQL'
GRANT USAGE ON SCHEMA public TO opf_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO opf_app;
SQL
"${psql[@]}" -d postgres -c "GRANT CONNECT ON DATABASE oregon_providers_test TO opf_app"

dotnet run --project src/Importer --configuration Release -- import geo
dotnet run --project src/Importer --configuration Release -- import taxonomy
dotnet run --project src/Importer --configuration Release -- import snapshot
