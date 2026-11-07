# Examples

`bun run validate` checks every file here against the contract in `../openapi/`.

- The file suffix selects the schema: `*.request.json` is a `SystemOneRequest`, `*.response.json` a `SystemOneResponse`, and `*.error.json` a `SystemOneErrorResponse`.
- A request and a response with the same name are a pair. The answers must use the question names and types of the request and follow the rules that depend on it: a choice is one of the criteria, a value is null exactly when `p_null` is above `null_threshold`, a text span covers its `guess` in `state` or `state_text`, text list items have one matching span each, estimates stay within `[min, max]` and on the `step` grid, and a forecast has `horizon` steps.
- Files in `invalid/` must fail validation. An invalid response named `<name>.<problem>.response.json` pairs with `<name>.request.json` in this directory, so it can break a rule that depends on the request.

## Sources

Files prefixed with a provider name are copied unchanged from that provider's published documentation. They show that the contract accepts existing formats as they are.

| Files | Source |
| --- | --- |
| `typesafe-noul`, `typesafe-choice`, `typesafe-score`, `typesafe-box` | Request and response examples in TypeSafe's OpenAPI document, `https://api.typesafe.ai/openapi.json` (version 0.2.0) |
| `typesafe-quickstart` | TypeSafe quick start, `https://docs.typesafe.ai/introduction/quickstart` |
| `typesafe-images` | TypeSafe images guide, `https://docs.typesafe.ai/images` (image data shortened in the source) |
| `clef-triage` | Request body from the Cloudflare Workers AI Clef model page, `https://developers.cloudflare.com/workers-ai/models/clef/`. Workers AI takes this body as is; the page publishes no response example. |

Files adapted from Cloudflare's Clairic sources keep the published state, settings, values, and spans, renamed to this specification's shapes: `fields` become `questions`, forecast arrays become `steps`, and extra usage counts are dropped. Values the source leaves out, such as usage or a list's confidence, are filled in.

| Files | Source |
| --- | --- |
| `invoice-extraction` | Request and response on the Cloudflare Workers AI Clairic model page, `https://developers.cloudflare.com/workers-ai/models/clairic/` |
| `damage-claim`, `home-price-estimate`, `traveler-forecast` | Cloudflare blog, "Introducing Clairic, a new System One class of extraction models", `https://blog.cloudflare.com/clairic-extraction-model/` |

All other files are written for this specification.
