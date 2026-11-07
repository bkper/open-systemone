# Changelog

Each release is a dated, immutable OpenAPI file in `openapi/`. Entries describe contract changes.

## Unreleased

- Initial draft: `POST /v1/systemone` with TypeSafe's request, response, and decision question types (`noul`, `choice`, `score`, `box`).
- Add optional request `reference_date` and response `truncated` and `state_text`.
- Add the error envelope with standard codes `unsupported_question_type` and `unsupported_parameter`.
- Add extraction question and answer types: `text`, `number`, `date`, `time`, `datetime`, `duration`, `list`, `estimate`, and `forecast`.
- Add extension question and answer types named `owner:type`.
- Add `SPEC.md` with the normative rules: answer guarantees, truncation and `state_text`, the standard errors, extension types and their promotion to core, versioning, and compatibility with TypeSafe.
- Settle span offsets as Unicode code points, `time` as `HH:MM[:SS]`, and `forecast` answers as a `steps` array.
- Allow a null `span`, and null entries in a list's `spans`, for values not read from the state text.
- Let `state_text` be the portion read when the state was truncated, and let implementers reject oversized input.
- Return estimate `quantiles` only when requested, never in forecast steps; a date estimate's `mean` is a date.
- Make the most likely criterion a SHOULD for `choice`.
- Treat the asset placeholder position as a hint, and accept `webp` images.
- Group the core types in `SystemOneCoreQuestion` and `SystemOneCoreAnswer`, apart from extension types.
