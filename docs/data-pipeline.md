# Data pipeline

Ran on 2026-09-27 from `data/downloads/NPPES_Data_Dissemination_September_2026_V2.zip` (gitignored). The importer streams `npidata_pfile_20050523-20260913.csv` out of that zip and does not extract it to disk.

## Commands

- `import geo` loads `data/geo/oregon-zcta.csv` into `zip_centroids`.
- `import taxonomy` loads `data/taxonomy/nucc-subset.csv` into `taxonomies`.
- `import full --file <zip>` loads those reference tables, keeps Oregon individual clinicians who have a group taxonomy, and swaps the new rows in during one transaction. `--download-latest` fetches the current V.2 zip from the CMS page when a local file is not the one you want.
- `export snapshot` writes `data/snapshot/providers.csv.gz`, `provider_taxonomies.csv.gz`, `provider_locations.csv.gz`, and `meta.json`.
- `import snapshot` copies those files back, rebuilds `cities`, and writes an `import_runs` row of kind `snapshot`.
- `import locations` reads the NPPES practice location file for NPIs already in the directory. Run it before `export snapshot`.
- `checksum` prints two md5 digests, providers then taxonomy links, so a reload can be compared with the source database.

`import_runs.started_at` and `finished_at` come from PostgreSQL `NOW()`.

## Full import

Source entry `npidata_pfile_20050523-20260913.csv`. Data as of 2026-09-13.

| Measure | Value |
| --- | --- |
| Rows scanned | 9,798,758 |
| Rows kept | 64,780 |
| Elapsed | 1 minute 50 seconds |
| Peak RSS | 63 MB |
| Provider taxonomy rows | 93,900 |
| Cities | 285 |

Location precision on the kept rows: Zip 64,698, City 74, None 8.

Group memberships. A provider whose taxonomies fall in two groups is counted in each.

| Group | Providers |
| --- | --- |
| physician | 17,417 |
| nurse_practitioner | 5,577 |
| physician_assistant | 3,217 |
| psychologist | 2,537 |
| counselor | 28,858 |
| social_worker | 7,659 |
| mft | 1,667 |

Those memberships sum to 66,932. Distinct NPIs are 64,780.

## Snapshot

| File | Bytes |
| --- | --- |
| `providers.csv.gz` | 3,733,091 |
| `provider_taxonomies.csv.gz` | 776,344 |
| `meta.json` | 135 |
| Total | 4,509,570 |

The stop line is 25 MB (26,214,400 bytes). This snapshot is under it.

`import snapshot` into `oregon_providers_test` produced the same checksum as `oregon_providers`:

`756c97843da5b3b69c571b5a6f5268a8|a2c982643d44ffd5b292a3e9afc075f7`

`import geo` and `import taxonomy` on that database then matched the source reference counts: 283 taxonomy rows, 428 ZIP centroids, 285 cities, 64,780 providers.

## Swap

Npgsql sends a command that has parameters through the extended query protocol, and that protocol accepts one statement. The swap runs each statement by itself, inside one transaction, so a reader never sees a half-loaded table.
