# Changelog

Each release is a dated, immutable OpenAPI file in `openapi/`. Entries describe contract changes.

## Unreleased

- Initial draft: `POST /v1/systemone` with TypeSafe's request, response, and decision question types (`noul`, `choice`, `score`, `box`).
- Add optional request `reference_date` and response `truncated` and `state_text`.
- Add the error envelope with standard codes `unsupported_question_type` and `unsupported_parameter`.
- Add extraction question and answer types: `text`, `number`, `date`, `time`, `datetime`, `duration`, `list`, `estimate`, and `forecast`.
- Add extension question and answer types named `owner:type`.
