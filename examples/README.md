# Examples

`bun run validate` checks every file here against the contract in `../openapi/`.

- The file suffix selects the schema: `*.request.json` is a `SystemOneRequest`, `*.response.json` a `SystemOneResponse`, and `*.error.json` a `SystemOneErrorResponse`.
- A request and a response with the same name are a pair: the answers must use the question names and types of the request.
- Files in `invalid/` must fail validation.

## Sources

Files prefixed with a provider name are copied unchanged from that provider's published documentation. They show that the contract accepts existing formats as they are.

| Files | Source |
| --- | --- |
| `typesafe-noul`, `typesafe-choice`, `typesafe-score`, `typesafe-box` | Request and response examples in TypeSafe's OpenAPI document, `https://api.typesafe.ai/openapi.json` (version 0.2.0) |
| `typesafe-quickstart` | TypeSafe quick start, `https://docs.typesafe.ai/introduction/quickstart` |
| `typesafe-images` | TypeSafe images guide, `https://docs.typesafe.ai/images` (image data shortened in the source) |
| `clef-triage` | Request body from the Cloudflare Workers AI Clef model page, `https://developers.cloudflare.com/workers-ai/models/clef/`. Workers AI takes this body as is; the page publishes no response example. |

All other files are written for this specification.
