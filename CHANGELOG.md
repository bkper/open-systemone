# Changelog

Each release is a dated, immutable OpenAPI file in `openapi/`. Entries describe contract changes.

## Unreleased

- **Breaking:** the contract fixes no endpoint path. The operation moves from `paths./v1/systemone` to `components.pathItems.SystemOne`, served as `POST` at a URL the implementer chooses. Clients take the full endpoint URL as configuration.
- `model` stays required when an implementer serves a single model at its URL, and an implementer rejects a model it does not serve.

## 2026-11-07

First release: [openapi/2026-11-07.json](openapi/2026-11-07.json).

- `POST /v1/systemone` with TypeSafe's request, response, and decision question types (`noul`, `choice`, `score`, `box`). Image assets also accept the `webp` format.
- Optional request `reference_date`, and optional response `truncated` and `state_text`. When the state was truncated, `state_text` may be only the portion the model read. Implementers may reject oversized input instead of truncating it.
- Error envelope with standard codes `unsupported_question_type` and `unsupported_parameter`.
- Extraction question and answer types: `text`, `number`, `date`, `time`, `datetime`, `duration`, `list`, `estimate`, and `forecast`.
- Extension question and answer types named `owner:type`, kept apart from the core types in `SystemOneCoreQuestion` and `SystemOneCoreAnswer`.
- `SPEC.md` with the normative rules: answer guarantees, truncation and `state_text`, the standard errors, extension types and their promotion to core, versioning, and compatibility with TypeSafe.
- Spans count Unicode code points. A value not read from the state text, such as one read from an image, has no span: `span` is absent or null, and a list's `spans` entry is null.
- `time` answers are `HH:MM` or `HH:MM:SS`. `forecast` answers are a `steps` array; steps have no quantiles. Estimate `quantiles` are present only when the question requests them, and a date estimate's `mean` is a date.
- `choice` must be one of the criteria and should be the most likely one.

