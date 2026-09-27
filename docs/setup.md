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
