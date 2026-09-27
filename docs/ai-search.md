# Plain-words search

Checked 2026-09-27. Chain defaults live in `src/Api/appsettings.json`. `ChainVerified` is `2026-09-27`.

The server asks the model for a small JSON object, then resolves groups, credentials, specialty phrases, and places itself. Model text is not rendered as HTML. If every rung fails, the rules interpreter answers and `engine.provider` is `rules`.

## A real interpret call

`POST /api/search/interpret` with the text "nurse practitioner in Salem within 10 miles who takes Aetna".

One call returned in 1,809 ms from Groq `qwen/qwen3.8-27b`. The two Groq models ahead of it, `openai/gpt-oss-120b` and `openai/gpt-oss-20b`, returned HTTP 400 because Groq could not validate their JSON (`json_validate_failed`, empty generation). A later probe of the same prompt got HTTP 200 from both of those models, so this was a failed generation, not a retired id. The chain moved on.

Filters from that call: group `nurse_practitioner`, credential `NP`, place `SALEM`, radius 10. Unsupported sentence: "The registry doesn't record insurance, so that part was left out."

`/api/meta` then listed those three rungs with outcome, status, and milliseconds. The import counts on that response are cached for 10 minutes. The chain list is read on each request, so a cached page cannot hide the last call.

## Probe, every rung

`dotnet run --project src/Importer -- llm probe`

Prompt: "nurse practitioner in Salem within 10 miles".

| Provider | Model | Outcome | Status | ms |
| --- | --- | --- | --- | --- |
| Groq | `openai/gpt-oss-120b` | ok | 200 | 1,038 |
| Groq | `openai/gpt-oss-20b` | ok | 200 | 534 |
| Groq | `qwen/qwen3.8-27b` | ok | 200 | 239 |
| NVIDIA | `nvidia/nemotron-3-super-120b-a12b` | ok | 200 | 1,695 |
| NVIDIA | `nvidia/nemotron-3-super-120b-a12b` (second key) | ok | 200 | 825 |
| NVIDIA | `nvidia/nemotron-3-super-120b-a12b` (third key) | ok | 200 | 741 |
| NVIDIA | `nvidia/nemotron-3.5-lightning-30b-a3b` | ok | 200 | 1,799 |
| NVIDIA | `nvidia/nemotron-3.5-lightning-30b-a3b` (second key) | ok | 200 | 3,119 |
| NVIDIA | `nvidia/nemotron-3.5-lightning-30b-a3b` (third key) | timeout | 0 | 10,004 |
| Cerebras | `gpt-oss-120b` | ok | 200 | 303 |
| Cerebras | `qwen-3.8-27b` | ok | 200 | 372 |
| Gemini | `gemini-3.5-flash` | empty | 200 | 2,226 |
| Gemini | `gemini-2.5-flash` | ok | 200 | 1,379 |
| Gemini | `gemini-flash-latest` | ok | 200 | 1,099 |

The first success was Groq `openai/gpt-oss-120b`. Interpret stops at the first success. The probe keeps going so a dead later rung is visible. Parsed groups from the successful rungs included `nurse_practitioner`, and the place was Salem.

`gemini-3.5-flash` returned HTTP 200 with an empty `content` field. The chain treats that as a failed rung. `gemini-flash-latest` still answered, and the chain still ends on that alias. One NVIDIA key timed out on the lightning model. The other two keys for that model returned HTTP 200. NVIDIA tries each model with each key.

## Poisoned Groq key

`dotnet run --project src/Importer -- llm probe --poison groq`

| Provider | Model | Outcome | Status | ms |
| --- | --- | --- | --- | --- |
| Groq | `openai/gpt-oss-120b` | http | 401 | 225 |
| Groq | `openai/gpt-oss-20b` | http | 401 | 26 |
| Groq | `qwen/qwen3.8-27b` | http | 401 | 27 |
| NVIDIA | `nvidia/nemotron-3-super-120b-a12b` | ok | 200 | 789 |

The bad Groq key did not stop the chain. NVIDIA answered, with group `nurse_practitioner` and place Salem.

## Rate limit

Twenty posts of an empty body to `/api/search/interpret` returned 400. The next two returned 429. The limit is 20 requests a minute per IP, and it counts before the handler runs.
