# Decisions

Short dated notes. Settled product choices live in the build brief and are not reopened here.

## 2026-09-27: .NET SDK location

The 10.0.401 SDK is the copy installed by `dotnet-install.sh` into `.tools/dotnet` (gitignored). Scripts prepend that directory to `PATH` and set `DOTNET_ROOT` when it exists. Otherwise they use `dotnet` on `PATH`. GitHub Actions installs the SDK with `actions/setup-dotnet`. The Homebrew cask was not installed.

## 2026-09-27: Public repo and phase branches

Eric created https://github.com/erichers/oregon-provider-finder and asked for work in public. `main` holds the phase 1 skeleton. Each later phase is a branch off current `main`, a pull request, then a merge commit. This replaces the single `build-v1` branch in the brief.

## 2026-09-27: Postgres on this Mac

`brew services start postgresql@18` cannot run: Homebrew reports that the formula has no service plist. The keg-only link also stopped, because libpq 18.2 already owns the client binaries in `/usr/local/bin`. The server still expects its share and library directories at `/usr/local/share/postgresql@18` and `/usr/local/lib/postgresql@18`. Those two symlinks point at the 18.6 cellar. The client tools in `/usr/local/bin` were left as libpq.

`initdb` created a cluster at `.work/pgdata` (gitignored). `pg_ctl` starts it. It is not a launchd service. `select version()` returned PostgreSQL 18.6, and `pg_isready` reports localhost:5432 accepting connections. Local connections use trust authentication, which is what `initdb` wrote.

## 2026-09-27: NPPES zip

`unzip -t` on `data/downloads/NPPES_Data_Dissemination_September_2026_V2.zip` (about 1.1 GB) reported no errors. The zip stays gitignored.

## 2026-09-27: Node for Angular

System Node is v22.21.1. Angular CLI 22.2.0 requires Node `^22.22.3` or `^24.15.0` or `>=26`. The project keeps Node v22.22.3 under `.tools/node` (gitignored), same pattern as the SDK. Scripts prepend it when the directory exists. CI installs Node 22.22.3 with `actions/setup-node`. nvm is on this Mac, and it was left alone so nothing outside the project directory changes.

## 2026-09-27: Secret scan shapes

`scripts/check-secrets.sh` looks for key-shaped strings (a known prefix plus a tail) rather than the bare prefix. Lockfile hashes contain short fragments such as the OpenAI prefix by coincidence. The script skips `package-lock.json` for the same reason. It also rejects connection-string password assignments and this machine's Frida path.

## 2026-09-27: CI starts at phase 1

The workflow file is added with the skeleton so GitHub checks every push. Phase 1 runs `dotnet build` and the Angular production build. Test jobs are added when those tests exist (phase 7).
