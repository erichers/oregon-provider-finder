# Setup

Verified on 2026-09-27.

- .NET SDK 10.0.x. This machine uses 10.0.401 from `.tools/dotnet` (gitignored). Any 10.0 SDK on `PATH` is enough. `global.json` rolls forward inside the 10.0 feature band.
- Node.js 22.22.3 or newer on the 22 line. Angular CLI 22.2.0 rejects Node 22.21. This machine uses `.tools/node`.
- PostgreSQL 18 listening on localhost:5432. Homebrew's `postgresql@18` formula (18.6) is installed here. `brew services` has no plist for that formula, so the cluster is started with `pg_ctl`. See `docs/decisions.md`.

From a checkout:

```bash
dotnet build
cd web && npm ci && npm run build
```

`scripts/setup.sh` and `scripts/dev.sh` arrive in a later phase. They will create the database roles, apply migrations, and load the snapshot.

`data/snapshot` is the committed Oregon extract (about 4.5 MB). `dotnet run --project src/Importer -- import snapshot` reloads providers, taxonomy links, and cities. `import geo` and `import taxonomy` load the ZIP centroids and the NUCC subset. Counts from the 2026-09-27 full import are in `docs/data-pipeline.md`.

## Database roles

Two databases: `oregon_providers` and `oregon_providers_test`. Two login roles: `opf_owner` (owns the schema, runs migrations and imports) and `opf_app` (SELECT on every table, which is the API connection). Passwords live in user-secrets on the Api and Importer projects, under `ConnectionStrings:Owner` and `ConnectionStrings:App`. They are not in the repo.

On this machine the migration `Initial` has been applied to both databases as `opf_owner`. `opf_app` can `SELECT` from `providers` and cannot `INSERT`. `miles_between` is the haversine distance in statute miles.
