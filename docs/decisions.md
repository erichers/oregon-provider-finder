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

## 2026-09-27: NUCC subset is committed

The NUCC permission page allows distribution of the Provider Taxonomy in a US product when the codes stay intact and the copyright notice travels with them. `data/taxonomy/nucc-subset.csv` is a row and column subset of `nucc_taxonomy_261.csv` (downloaded 2026-09-27). Code values are unchanged. `data/taxonomy/NOTICE.md` carries the attribution. This is not a stop-and-ask case: the terms grant distribution, they do not forbid it.

## 2026-09-27: Census ZCTA file is pipe-delimited

The 2026 Gazetteer ZCTA national file uses `|` between fields, not tabs. `data/geo/oregon-zcta.csv` is the 428 rows whose GEOID starts with `97`, with `GEOID`, `INTPTLAT`, and `INTPTLONG`.

## 2026-09-27: Gemini model ids are unprefixed

The Gemini model list returns ids like `models/gemini-flash-latest`. Chat completions on the OpenAI-compatible endpoint accept `gemini-flash-latest` (HTTP 200, `finish_reason` stop, on 2026-09-27). The chain stores the unprefixed id. Groq, NVIDIA, and Cerebras candidates from the brief were all present on their model lists the same day.

The same check sent `chat_template_kwargs` with `thinking` false to `nvidia/nemotron-3.5-lightning-30b-a3b`. NVIDIA returned HTTP 200 and a short `content` value, and also a `reasoning_content` field. The chain reads `content` only.

## 2026-09-27: Snake case columns, no unaccent in the search vector

EF Core maps property names to snake_case (`full_name`, `group_keys`) through EFCore.NamingConventions. The generated `search_vector` uses `to_tsvector('english', ...)` over name, city, and specialty labels. The stock `unaccent` function is not immutable, so it is not in that expression and the extension is not created.

`miles_between(lat1, lng1, lat2, lng2)` is a SQL haversine in statute miles, created by the Initial migration.

## 2026-09-27: Secret scan shapes

`scripts/check-secrets.sh` looks for key-shaped strings (a known prefix plus a tail) rather than the bare prefix. Lockfile hashes contain short fragments such as the OpenAI prefix by coincidence. The script skips `package-lock.json` for the same reason. It also rejects connection-string password assignments and this machine's Frida path.

## 2026-09-27: EF Core pinned to 10.0.4

`Npgsql.EntityFrameworkCore.PostgreSQL` 10.0.3 depends on EF Core 10.0.4. The Design package had resolved to 10.0.12, and the build warned that 10.0.4 won the conflict. Design, EF Core, and the relational package are pinned to 10.0.4 so the importer and the design-time factory load one version.

## 2026-09-27: Scalar for the Development API reference

ASP.NET Core 10 generates the OpenAPI document with `Microsoft.AspNetCore.OpenApi`. Microsoft Learn's ASP.NET Core 10 OpenAPI page shows Scalar (`MapScalarApiReference`) as the interactive UI on top of that document. `Scalar.AspNetCore` 2.17.10 is mapped only when the host is Development, at `/scalar`. The document itself is `/openapi/v1.json`.

## 2026-09-27: Meta cache keeps chain status fresh

`/api/facets` uses output caching for 10 minutes. `/api/meta` caches the import row and the provider count for 10 minutes, and reads the in-memory chain status on every request. A single output-cached meta response would keep showing an empty chain after the first interpret call.

## 2026-09-27: HttpClient instead of httpResource

`httpResource` in the installed `@angular/common` is still marked `@experimental` (21.0.0). The screens use `HttpClient` and signals, and the search filters live in the URL.

## 2026-09-27: CI starts at phase 1

The workflow file is added with the skeleton so GitHub checks every push. Phase 1 runs `dotnet build` and the Angular production build. Test jobs are added when those tests exist (phase 7).
