# Security pass

Checked 2026-09-27.

- `git log -p | scripts/check-secrets.sh` printed `check-secrets: ok`. Tracked files were scanned the same way in CI.
- `opf_app` can read `providers` and cannot insert. `psql` as that role returned `permission denied for table providers`.
- Search text is limited to 200 characters, a city or ZIP to 80, filter lists to a few hundred characters, page to 200, page size to 50, and radius to 100 miles. Groups, specialties, credentials, presets, sex, and sort are whitelisted. Plain-words text is limited to 300 characters. The location lookup keeps 40 characters.
- `POST /api/search/interpret` is limited to 20 requests a minute per IP. The 21st returns 429.
- The Angular templates interpolate registry and model text. There is no `innerHTML`.
- Rejected searches return ProblemDetails with a sentence this API wrote. The host does not enable the developer exception page. The database health check swallows the driver exception and reports unhealthy.
- `dotnet list package --vulnerable --include-transitive` reported no vulnerable packages. `npm audit --omit=dev` in `web/` reported 0 vulnerabilities.

Model keys stay in user-secrets. The test host uses `Testing`, so those keys are not loaded. The CI database password `ci` exists only in the Actions Postgres container.
