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

## 2026-09-27: Review follow-up

Wren and Nora reviewed the screens after phase 11. The list below is what changed, and what was left as it is.

Provider type, specialty, and credentials are closed disclosures under the results, so the first names sit with the search box instead of under a page of checkboxes. On a 390px screen the first result starts just below the fold. Facets drop a taxonomy code when the NUCC subset has no display name for it. City suggestions require at least three providers in that city, which removes one-off registry spellings such as Portand and Portlan. A street address is title case, with SW, NE, and US left uppercase, and the ZIP sits on the city line. Credential text is split on commas. Button-styled links are not underlined. The skip link goes to the main content. The pending search label says Searching. A map marker opens a popup with the ZIP and the count. The circle size was already the count.

The fixed Map button still sits over the list while it scrolls. The page has extra space at the bottom so the last card clears it. The button stays fixed because that is how a phone reaches the map. Markers still overlap in the Portland area because many ZIP centers are close together. Each marker is one ZIP, not one provider.

## 2026-09-27: Review

The review pass looked at the API, the screens at 390 and 1440, the README, and the setup script.

A distance of 0 miles is real: the practice ZIP center is the same point as the city center, which is what the haversine returns. The list was showing "0 mi", which reads as the same building. It now says "under 1 mi" when the distance is below 1. Rounded miles stay as they were for longer distances.

The phone results frame was wider than the page because the URL pill stretched the window. The pill now ellipsizes. The exception page in Development was already replaced with the shared handler in the security pass, after a null model radius threw and the stack reached the client.

No other defect in that pass needed a code change. The assigned reviewers were Ivy and Nora. This session did the pass in the main thread and recorded it here.

## 2026-09-27: Filter length limits

The security pass found that a city or ZIP and the page number were not bounded, while search text, page size, and radius already were. A place is now limited to 80 characters, a page to 200, and the comma-separated filter lists to a few hundred characters. The sentences returned for a bad request are written in this API.

## 2026-09-27: Setup loads the taxonomy table

The committed snapshot has providers, taxonomy links, and enough metadata to rebuild cities. It does not include the NUCC rows or the ZIP centroids. `setup.sh` runs `import geo`, `import taxonomy`, and `import snapshot` into both databases. A fresh checkout can search without the 1 GB NPPES zip.

## 2026-09-27: CI starts at phase 1

The workflow file is added with the skeleton so GitHub checks every push. Phase 1 ran `dotnet build` and the Angular production build. Phase 7 adds the Postgres 18 service, `dotnet test`, Vitest, the Playwright smoke, and `dotnet format --verify-no-changes`.

## 2026-09-27: API tests do not call a model

The test host sets `ASPNETCORE_ENVIRONMENT` to `Testing` before the app is built. That skips Development user-secrets, so the model keys on this machine are not visible to the tests. Interpret then uses the rules interpreter. CI loads `oregon_providers_test` from the committed snapshot and sets `OPF_TEST_CONNECTION`. The workflow password `ci` exists only inside the GitHub Actions Postgres container.

## 2026-09-27: Ivy review

Ivy reviewed the branch after phase 11. The secret scan used `grep -q` in a pipe, so a match in a long stream died as SIGPIPE and the script reported a clean file. CI also ran with a closed stdin, so that step scanned nothing. The scan now takes `--stdin`, `--tracked`, or `--history`, and a match is a here-string. Password assignments match only when the value is at least 12 characters, so the CI password and the setup placeholders stay in the repo. Two-letter credentials match only when typed in capitals, so "who do I see" does not become an osteopathic filter. Specialty facet counts are distinct NPIs. The Docker quick start names `PGHOST`, `PGUSER`, and `PGPASSWORD`. A radius the menu does not list is shown as its own option. A count of one reads "1 provider".

## 2026-09-27: Map markers are the providers on the page

The map plots the providers in the current list, at their ZIP centroid, and groups the ones that land on the same point. Leaflet.markercluster expects a global Leaflet object, which the Angular build does not provide, so the grouping lives next to the map instead of in that plugin. A click on a marker selects that card. Pointing at a card highlights its marker. With nothing to plot, the map stays on a view of Oregon. Tiles are OpenStreetMap, attributed, with a zoom cap of 16. If a tile fails, the markers stay and a line says the tiles did not load. No tile key is required.

## 2026-09-27: The search page is a full-screen map

Eric rejected the split list and map. The search route is now the full window: the map sits behind a left drawer on a wide screen and a bottom sheet on a phone. The sheet stops at a peek, half, and full height, and a drag with enough speed goes to the next stop. The search field and the filter chips float over the map. Panning or zooming asks for providers inside the visible box (`minLat`, `minLng`, `maxLat`, `maxLng`, all four or none). A new search or filter change flies the map to those results once. Moving the map by hand does not fly it back. Scroll, pinch, and double-click zoom stay on. "Your location" uses the browser geolocation API and says so when it is denied.

Leaflet and Leaflet.markercluster load as page scripts so they share one `L`. The earlier import failed because the bundler gave the plugin a different Leaflet than the map. Clusters split with the plugin's own animation, and `prefers-reduced-motion: reduce` turns that animation off. CARTO's public raster URL now returns tiles stamped "API KEY REQUIRED", so the basemap is the OpenStreetMap tile server, attributed, with no key. If a tile fails, the markers remain and a line says the tiles did not load.

## 2026-09-27: Search tolerates a typo

A word search still uses the full-text vector, and it also keeps a row when the name is a close trigram match, the city is a close trigram match, the specialty text contains the words, or the ZIP starts with what was typed. The city trigram index is created in SQL because a second index on the same column in the model replaces the btree. When the search has words and no place, the page sorts by relevance. Distance stays the default when a place is set. A credential is shown as its code plus a plain-language label, and the raw taxonomy code stays next to the specialty name.

## 2026-09-27: Motion is a short rise

Result cards, the page you navigate to, and the panels on a profile rise 8 pixels and fade in over about 200 to 240 milliseconds. The search box does not animate while someone is typing. `prefers-reduced-motion: reduce` sets those animations to none, so the content is in place immediately.

## 2026-09-27: Secondary locations, not board status

The NPPES practice location file is already in the September 2026 zip. `import locations` copies rows whose NPI is already in the directory (13,545 rows) into `provider_locations`. The profile lists those addresses and names the file and the NPPES data date. Enumeration date and the registry update date were already stored; the profile now shows both, with NPPES as the source.

Oregon license status, type, and expiration stay off the profile. The Medical Board open data file is aggregate counts. Individual lookup is behind a terms page, and a licensee list is a paid records request. The Board of Nursing sells a mailing list and otherwise takes a records request. Neither is a bulk file or public API this directory can copy. A license number on the profile, when present, is the number the provider typed into NPPES.

The other-organization-name file and the endpoint file stay in the zip and are not imported. The other-name file is a separate national list of organization names and a type code, not a verified affiliation. The endpoint file is electronic endpoints, not practice locations.

## 2026-09-27: The map bar floats

The search page header and the 988 line share one slim bar over the map, and the crisis links stay in that bar. The search field is a pill. Care needs are one scrolling row of chips. Sort and the rest of the filters open from a Filters button. On a phone the list starts as a short peek that names the count, so the map stays in view. The framed screenshots were wider than the 390px capture because the window chrome stretched past the image. The frame is now the same width as the shot.

## 2026-09-27: The list opens from a chevron

The gray handle pill is gone. A 44px button at the top of the list holds a chevron. On a wide screen it points left to close and right to open, and a closed drawer shrinks to that button. On a phone it points down to close and up to open, and the closed sheet is a 64px bar with the count. Dragging the bar still changes the sheet height. The arrow does not rotate when reduced motion is on. Active filters, Reset, and Filters share one scrolling row so they do not stack over the map.

## 2026-09-27: Phone zoom sits above the list

On a phone the plus and minus buttons move to the lower right, just above the sheet. They fade out once the sheet rises above half, so they never sit on the chips. Pinch zoom stays on. The wide-screen control stays at the upper right. A tap on the phone arrow opens a peek to half height and closes any taller sheet back to the peek. The up and down keys still step one stop at a time. The full stop is the space under the chip row, so the count and the chevron stay in view. The phone title is OR Provider Finder on the same line as Crisis? Call or text 988. Search, About the data, and GitHub sit in a Menu button.

## 2026-09-27: A map node keeps its list

Clicking a cluster lists the providers in that node and does not zoom or spiderfy. Zooming was the move that replaced the list with whatever the new map bounds returned. The list stays through pans, zooms, and the fly to a single marker. Clearing the node, or starting a new search, shows the map results again. Closing the drawer with the arrow does not wipe the list.

## 2026-09-27: The drawer is not a panel

The drawer column and the phone sheet have no fill, border, or shadow. The search pill, each chip, the count row, and each card are their own glass. Cards use 90% white so the type stays readable on street tiles. The empty margin of the drawer ignores clicks, so a drag there reaches the map. The list column keeps pointer events: letting the gaps pass clicks through stopped the wheel, the trackpad, and touch from scrolling the cards. The column stays transparent, so it still does not read as a panel.

## 2026-09-27: Review fixes before merging R1E

On phones the map credit moves up with the sheet so the sheet never covers it, and the zoom buttons sit 28 px above the sheet so the two do not touch. When the sheet is taller than half, both fade out, and the drawer footer carries the OpenStreetMap credit so it is always on screen. On phones the teaser takes the place of its card in the list, so the same provider does not show twice, and focus goes back to the card after the next render. The desktop reopen tab is 44 px wide. The ZIP center note sits on its own glass card so it reads over the map.
