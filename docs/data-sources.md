# Data sources

Checked 2026-09-27. Column names below were read from the files, not assumed from the build brief.

## NPPES full replacement file

Page: https://download.cms.gov/nppes/NPI_Files.html

Local file: `data/downloads/NPPES_Data_Dissemination_September_2026_V2.zip` (gitignored, about 1.1 GB). `unzip -t` reported no errors.

Zip entry used: `npidata_pfile_20050523-20260913.csv` (about 11.7 GB uncompressed, 330 columns). The name's end date is 2026-09-13.

Also in the zip, and not imported: `npidata_pfile_20050523-20260913_fileheader.csv`, `pl_pfile_20050523-20260913.csv` (other practice locations), `endpoint_pfile_20050523-20260913.csv`, `othername_pfile_20050523-20260913.csv`, plus the readme and code-values PDF.

The data CSV has a header row. Names are quoted in the file. Map by header name. The columns this app reads:

- `NPI`
- `Entity Type Code`
- `Provider Last Name (Legal Name)`, `Provider First Name`, `Provider Middle Name`
- `Provider Name Prefix Text`, `Provider Name Suffix Text`
- `Provider Credential Text`
- `Provider First Line Business Practice Location Address`
- `Provider Second Line Business Practice Location Address`
- `Provider Business Practice Location Address City Name`
- `Provider Business Practice Location Address State Name`
- `Provider Business Practice Location Address Postal Code`
- `Provider Business Practice Location Address Telephone Number`
- `Provider Enumeration Date`
- `Last Update Date`
- `NPI Deactivation Date`
- `NPI Reactivation Date`
- `Provider Sex Code` (this is the sex column in the September 2026 V.2 file)
- `Healthcare Provider Taxonomy Code_1` through `_15`
- `Provider License Number_1` through `_15`
- `Provider License Number State Code_1` through `_15`
- `Healthcare Provider Primary Taxonomy Switch_1` through `_15`

There are 15 taxonomy slots, then other-provider-identifier slots, sole-proprietor fields, taxonomy group slots, and `Certification Date`. Those are not imported.

Keep a row only when the entity type is `1`, the practice state is `OR` after trim and upper-case, the NPI is active (deactivation date empty, and a last name is present), and at least one taxonomy code falls in a provider group below.

Postal codes in this file are 5 or 9 digits with no dash. The app keeps the first 5 as `zip5`. Phone numbers are stored as 10 digits.

NPPES data is a US government work. The registry is self-reported.

## Provider groups (NUCC)

CSV page: https://www.nucc.org/index.php/code-sets-mainmenu-41/provider-taxonomy-mainmenu-40/csv-mainmenu-57

Newest file linked there on 2026-09-27: https://www.nucc.org/images/stories/CSV/nucc_taxonomy_261.csv (883 data rows). Header: `Code`, `Grouping`, `Classification`, `Specialization`, `Definition`, `Notes`, `Display Name`, `Section`.

Permission to distribute, checked the same day: https://www.nucc.org/index.php/code-sets-mainmenu-41/provider-taxonomy-mainmenu-40/csv-mainmenu-57/21-provider-taxonomy/111-permission-to-use-and-distribute-the-health-care-provider-taxonomy-code-set

The AMA, on behalf of the NUCC, allows use and distribution in US products if the codes are not changed, the copyright notice stays with the file, and the product does not imply endorsement. `data/taxonomy/nucc-subset.csv` is that subset (283 rows). See `data/taxonomy/NOTICE.md`.

Group rules, and how many codes in the 26.1 file match:

| Group key | UI label | Rule | Codes |
| --- | --- | --- | --- |
| `physician` | Physicians (MD, DO) | code starts with `207` or `208` | 229 |
| `nurse_practitioner` | Nurse practitioners | starts with `363L` | 18 |
| `physician_assistant` | Physician assistants | starts with `363A` | 3 |
| `psychologist` | Psychologists | starts with `103T`, plus `103G00000X` | 23 |
| `counselor` | Counselors (LPC and others) | starts with `101Y` | 6 |
| `social_worker` | Social workers | starts with `1041` | 3 |
| `mft` | Marriage and family therapists | `106H00000X` | 1 |

No prefix in that list pulled in an unexpected classification. `363L` is Nurse Practitioner. `363A` is Physician Assistant. `101Y` is Counselor. `1041` is Social Worker. `207` and `208` are physician classifications.

Care-need presets, each code found in the same file:

- Psychiatry: `2084P0800X` (Psychiatry Physician), `363LP0808X` (Psychiatric/Mental Health Nurse Practitioner)
- Therapy and counseling: groups `counselor`, `mft`, `psychologist`, plus social worker `1041C0700X` (Clinical Social Worker)
- Primary care: `207Q00000X` (Family Medicine), `207R00000X` (Internal Medicine), `208D00000X` (General Practice), `363LF0000X` (Family NP), `363LA2200X` (Adult Health NP), `363LP2300X` (Primary Care NP)
- Children and teens: `208000000X` (Pediatrics), `363LP0200X` (Pediatric NP), `103TC2200X` (Clinical Child and Adolescent Psychologist)
- Substance use: counselor `101YA0400X`, credential token `CADC`, and these physician addiction medicine codes: `207LA0401X` (Anesthesiology), `207QA0401X` (Family Medicine), `207RA0401X` (Internal Medicine), `2083A0300X` (Preventive Medicine), `2084A0401X` (Psychiatry and Neurology)

## ZIP centroids

US Census 2026 Gazetteer ZCTA national file:

https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/2026_Gaz_zcta_national.zip

The text file inside is pipe-delimited. Header: `GEOID|GEOIDFQ|ALAND|AWATER|ALAND_SQMI|AWATER_SQMI|INTPTLAT|INTPTLONG`. The zip listing dates the text file 2026-09-08. Census gazetteer files are public domain.

`data/geo/oregon-zcta.csv` keeps `GEOID`, `INTPTLAT`, and `INTPTLONG` for the 428 ZCTAs whose GEOID starts with `97`.

Pins and distances are ZIP-level, or a city centroid when the ZIP is missing from this file. The UI says so.

## Plain-words model chain

Checked against each provider's model list on 2026-09-27, using keys already on this machine. The list calls returned HTTP 200. No key value is stored in this repo.

| Provider | Endpoint | Models in the chain | On the list |
| --- | --- | --- | --- |
| Groq | `https://api.groq.com/openai/v1/models` | `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.8-27b` | yes |
| NVIDIA NIM | `https://integrate.api.nvidia.com/v1/models` | `nvidia/nemotron-3-super-120b-a12b`, `nvidia/nemotron-3.5-lightning-30b-a3b` | yes |
| Cerebras | `https://api.cerebras.ai/v1/models` | `gpt-oss-120b`, `qwen-3.8-27b` | yes, and those were the only two ids returned |
| Gemini | `https://generativelanguage.googleapis.com/v1beta/openai/models` | `gemini-3.5-flash`, `gemini-2.5-flash`, `gemini-flash-latest` | yes |

Gemini's model list prefixes ids with `models/` (`models/gemini-flash-latest`). A chat completion to the OpenAI-compatible endpoint with the unprefixed id `gemini-flash-latest` returned HTTP 200, so the chain sends the unprefixed id.

The chain still ends on `gemini-flash-latest`.

`ChainVerified` in app settings is `2026-09-27`.

A completion to `nvidia/nemotron-3.5-lightning-30b-a3b` with `chat_template_kwargs.thinking` set to false returned HTTP 200 on 2026-09-27 (`finish_reason` stop, a two-character answer). The message also included a `reasoning_content` field. The chain will read `content` and ignore `reasoning_content`. If a later model rejects `chat_template_kwargs`, that rung fails and the chain moves on.

## Map tiles

The map uses the OpenStreetMap standard tile server and shows the OSM attribution. Policy: https://operations.osmfoundation.org/policies/tiles/. Markers are ZIP centers. Details are in `docs/design.md`.
