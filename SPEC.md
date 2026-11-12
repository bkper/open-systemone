# Open System One Specification

> **Status: in production.** Breaking changes are avoided and, when unavoidable, marked in the [changelog](CHANGELOG.md).

This document holds the normative rules of Open System One. The contract itself is the OpenAPI file of a release, the latest being [openapi/2026-11-11.json](openapi/2026-11-11.json); schema names in this document, such as `SystemOneRequest`, refer to its `components.schemas`. Where this document and the OpenAPI file disagree, that is a bug.

The key words MUST, MUST NOT, REQUIRED, SHOULD, SHOULD NOT, and MAY are to be interpreted as described in RFC 2119.

## Scope and terminology

- **State**: the input that all questions in a request refer to: a string, or structured data as an object or array (`SystemOneContent`).
- **Question**: a named, typed question about the state (`SystemOneQuestion`). Its `type` selects the question shape and the answer shape.
- **Answer**: the result for one question, under the question's name, with the question's type (`SystemOneAnswer`).
- **Asset**: an image or other file referenced from the state, instructions, or criteria by a placeholder (`SystemOneAsset`).
- **Implementer**: a server that serves the System One operation at an endpoint URL, such as a model provider or a gateway in front of one.
- **Client**: anything that calls an implementer.
- **Decision types** (`noul`, `choice`, `score`, `box`) judge the state: a probability, a choice, a score, or a box in an image. They come from TypeSafe's format.
- **Extraction types** (`text`, `number`, `date`, `time`, `datetime`, `duration`, `list`, `estimate`, `forecast`) answer with values read, computed, or estimated from the state.
- **Core types** are the decision and extraction types above (`SystemOneCoreQuestion`, `SystemOneCoreAnswer`). **Extension types** are any other type, named `owner:type`.

An implementer need not support every core type. It MUST reject the ones it does not support (see [Errors](#errors)).

## Endpoint and envelope

The contract fixes no endpoint path. Its operation, `components.pathItems.SystemOne`, is served as an HTTP POST at a URL the implementer chooses, such as `https://api.example.com/v1/systemone`. A client MUST take the full endpoint URL as configuration, not build it from a base URL, so that switching implementers changes only the URL and `model`.

An implementer MUST accept an `application/json` body. An implementer that accepts assets MUST also accept `multipart/form-data`, with the JSON request in the first part, named `request`, and the bytes of each asset in their own part, named by the `part` of the asset that uses it.

An implementer MUST accept a body compressed with `Content-Encoding: gzip`, `x-gzip`, or `zstd`, in one layer. Its size limits apply to the decompressed body too. It MUST reject any other encoding, or more than one layer, with HTTP 415, and a body that does not decompress with HTTP 400. Clients SHOULD keep a zstd window at most 8 MiB; an implementer MAY reject a larger one with HTTP 400.

| `SystemOneRequest` | Required | Rules |
| --- | --- | --- |
| `model` | yes | Name or alias of the model. It stays required when an implementer serves a single model at its URL; an implementer MUST reject a model it does not serve. |
| `state` | yes | String, object, or array. |
| `questions` | yes | One or more questions keyed by names the client chooses. Types MAY be mixed in one request. |
| `assets` | no | Images and other files keyed by placeholder. Each placeholder, wherever it appears as or inside a string in `state`, `instructions`, or `criteria`, stands for the asset. An asset carries its bytes in `data_base64`, or, in a multipart request, the name of its `part`; every asset part is used by exactly one asset. The placeholder's position is a hint: an implementer MAY present assets before the state, for example when its model reads images only there. See [Assets](#assets). |
| `reference_date` | no | `YYYY-MM-DD`. Relative and year-less dates in the state resolve against it. |

| `SystemOneResponse` | Required | Rules |
| --- | --- | --- |
| `model` | yes | The model that answered. It MAY differ from the alias in the request. |
| `answers` | yes | Exactly one answer per question, under the same names, each with its question's type. |
| `usage` | yes | `SystemOneUsage`: `input_tokens` and `output_tokens`. Other counts are not part of the core contract. |
| `truncated` | no | See [Truncation and state text](#truncation-and-state-text). |
| `state_text` | no | See [Truncation and state text](#truncation-and-state-text). |

- A request either succeeds with every answer or fails. An implementer MUST NOT return a partial `answers` object.
- Setting a field to its documented default is equivalent to omitting it.
- Implementers MAY add response fields. Clients MUST ignore response fields they do not know.
- Request fields this specification does not define are implementer-defined: an implementer MAY ignore or reject them.

### Assets

- An image asset (`SystemOneImageAsset`) keeps TypeSafe's shape: `type` `image`, and `format` with `data_base64`.
- A file asset (`SystemOneFileAsset`) has `type` `file`, a `media_type`, and `data_base64` or `part`. `media_type` is a lowercase `type/subtype` without parameters, such as `application/pdf`, and MUST name the actual format of the bytes. An implementer MAY reject a generic type such as `application/octet-stream`.
- A file asset with media type `image/png`, `image/jpeg`, or `image/webp` is equivalent to an image asset with format `png`, `jpeg`, or `webp`.
- An implementer MUST reject an asset its model cannot read with `unsupported_parameter`: `param` is `assets.<placeholder>.type` for an asset type it does not accept, and `assets.<placeholder>.media_type` or `assets.<placeholder>.format` for a format it does not read.

## Question types

Settings are the question fields other than `type`.

| Type | Kind | Question | Answer | Required settings | Optional settings |
| --- | --- | --- | --- | --- | --- |
| `noul` | decision | `NoulQuestion` | `NoulAnswer` | | `instructions`, `criteria` |
| `choice` | decision | `ChoiceQuestion` | `ChoiceAnswer` | `criteria` | `instructions` |
| `score` | decision | `ScoreQuestion` | `ScoreAnswer` | `criteria` | `instructions` |
| `box` | decision | `BoxQuestion` | `BoxAnswer` | | `instructions` |
| `text` | extraction | `TextQuestion` | `TextAnswer` | | `instructions`, `null_threshold` |
| `number` | extraction | `NumberQuestion` | `NumberAnswer` | | `instructions`, `unit`, `integer`, `decimals`, `null_threshold` |
| `date` | extraction | `DateQuestion` | `DateAnswer` | | `instructions`, `null_threshold` |
| `time` | extraction | `TimeQuestion` | `TimeAnswer` | | `instructions`, `null_threshold` |
| `datetime` | extraction | `DateTimeQuestion` | `DateTimeAnswer` | | `instructions`, `null_threshold` |
| `duration` | extraction | `DurationQuestion` | `DurationAnswer` | | `instructions`, `unit`, `integer`, `decimals`, `null_threshold` |
| `list` | extraction | `ListQuestion` | `ListAnswer` | `items` | `instructions`, `decimals` |
| `estimate` | extraction | `EstimateQuestion` | `EstimateAnswer` | `min`, `max` | `instructions`, `unit`, `step`, `scale`, `quantiles` |
| `forecast` | extraction | `ForecastQuestion` | `ForecastAnswer` | `min`, `max`, `horizon` | `instructions`, `unit`, `step`, `scale`, `interval` |
| `owner:type` | extension | `ExtensionQuestion` | `ExtensionAnswer` | | defined by the owner |

An implementer MUST NOT silently ignore a setting it cannot honor. It MUST reject the request with `unsupported_parameter`.

## Answer guarantees

An implementer MUST return answers that satisfy these rules. Clients MAY rely on them across implementers.

### Decision types

- `noul`, `choice`, `score`, and `box` answers keep TypeSafe's shapes exactly.
- `choice`: `choice` MUST be one of the question's `criteria` names and SHOULD be the one with the highest probability. `probabilities` is keyed by criteria names.
- `score`: `legend` and `probabilities` are keyed by score level, `"0"` for the first criterion. `score` is within `[0, number of criteria - 1]`.

### Value types

`text`, `number`, `date`, `time`, `datetime`, and `duration` are value types. Their answers have `value`, `p_null`, `confidence`, and optionally `guess` and `span`.

- **Null rule**: `value` MUST be null when `p_null` is above the question's `null_threshold`, and MUST NOT be null otherwise. `null_threshold` defaults to 0.5.
- **Guess**: `guess` is the most likely value. An implementer that returns `guess` MUST return it also when `value` is null. An answer with a non-null `span` MUST have `guess`.
- **Span**: `span` is where `guess` was read in the state text, as a half-open range `[start, end)` of `SystemOneSpan` offsets, with `start <= end <= length`. It indexes into `state_text` when the response has it, and into `state` otherwise. For `text`, the spanned text MUST equal `guess`; for other value types it is the text `guess` was read from, such as `$52.10` for `52.1`. When `guess` was not read from the state text, for example when it was read from an image or computed, `span` is absent or null.
- **Offsets** count Unicode code points.
- `number` and `duration` values honor `integer` and `decimals`. A `duration` answer's `unit` equals its question's `unit`, which defaults to `seconds`.
- `date` is `YYYY-MM-DD`. `time` is 24-hour `HH:MM` or `HH:MM:SS` without a time zone. `datetime` is `SystemOneDateTime`, with an offset only when the state gives one.

### `list`

- `value` MUST be an array, never null: no match is an empty list.
- Items MUST be in the order they appear in the input, each in the format of its `items` type.
- `spans`, when present, has one entry per item in the same order: the item's span, following the span rules above, or null when the item was not read from the state text. It is REQUIRED for `text` items, and each non-null entry for a text item MUST cover exactly that item.

### `estimate`

- An estimate answer is never null.
- `value`, `median`, `p10`, `p90`, and every entry of `quantiles` MUST be within `[min, max]` and of the same kind as `min` and `max` (numbers or dates).
- `mean`, `p_below`, and `p_above` are optional. `mean`, when present, is of the same kind as `min` and `max`: a date for date estimates.
- `value`, `median`, `p10`, and `p90` MUST be on the `step` grid starting at `min`, when `step` is set. `mean` MAY fall between grid points.
- `p10 <= median <= p90`.
- `quantiles` MUST be present when the question sets `quantiles: true`, as the 1st to 99th percentiles in non-decreasing order, and MUST be absent otherwise.

### `forecast`

- `steps` MUST have exactly `horizon` entries, nearest step first. Parallel arrays per field, such as an array of values and an array of medians, are not part of the contract; an implementer MAY return them only as extra fields.
- Each step MUST satisfy the `estimate` rules, using the question's `min`, `max`, `step`, and `scale`. Steps MUST NOT have `quantiles`: forecast questions have no quantiles setting.

## Truncation and state text

- `state_text` is REQUIRED whenever span offsets index text that differs from the `state` sent, for example when structured state is serialized to text. It MUST be the text the offsets index into.
- An answer MUST NOT have spans into a non-string `state` without `state_text`.
- `truncated` is REQUIRED whenever the implementer knows whether it shortened the state to fit the model's context. An implementer that never truncates MAY omit it or set it to false.
- Clients MUST NOT read an absent `truncated` as false.
- When `truncated` is true, `state_text`, if returned, MAY be only the portion of the state the model read. Spans index into it.
- Instead of truncating, an implementer MAY reject input too long for the model with an implementer-defined error.

## Errors

Two error codes are standard. Both use HTTP 400 and the `SystemOneErrorResponse` envelope.

| `SystemOneError` | Required | Rules |
| --- | --- | --- |
| `type` | yes | `invalid_request_error` for the standard codes. |
| `code` | yes | `unsupported_question_type` or `unsupported_parameter` for the standard cases. |
| `param` | yes | Path of the rejected field: `questions.<name>.type`, `questions.<name>.<setting>`, or a request field such as `reference_date` or `assets`. |
| `message` | yes | Human-readable. Clients MUST NOT parse it. |

An implementer MUST use:

- `unsupported_question_type` for a question whose type it does not support, whether core, extension, or unknown. `param` is `questions.<name>.type`.
- `unsupported_parameter` for a request field or question setting defined by this specification that it cannot honor, such as a `reference_date` it cannot apply, an asset the model cannot read, such as a PDF for a model that reads only images, or `quantiles: true` for a model without quantiles. `param` names the field.

An implementer MAY report only the first unsupported item. All other errors, such as unknown models, oversized input, authentication, and rate limits, are implementer-defined.

## Extension types

- A non-core type MUST be named `owner:type` (`SystemOneExtensionType`): a lowercase owner identifier, a colon, and a lowercase type name, such as `acme:sentiment`.
- The owner identifier names the organization that defines the type, such as its domain name without the top-level domain. Owners SHOULD publish the question and answer shapes of their types.
- Unprefixed type names are reserved for core types. Implementers MUST NOT define unprefixed types.
- Only `type` is constrained by `ExtensionQuestion` and `ExtensionAnswer`. Owners SHOULD reuse core conventions such as `p_null`, `confidence`, and `span`, and MUST follow the envelope, error, and state text rules.
- An implementer MUST reject an extension type it does not support with `unsupported_question_type`.
- Clients and intermediaries SHOULD tolerate answer types they do not know: a gateway SHOULD pass them through unchanged, and a client MAY skip them.

### Promotion to core

An extension type becomes core when at least two independent implementers support it with the same shape and a dated release adds it. That release defines it under the unprefixed name. Implementers that supported the prefixed name SHOULD keep accepting it, as an alias, until the next dated release.

## Versioning

- A release is a single OpenAPI file named `openapi/YYYY-MM-DD.json` by its release date. A released file MUST NOT change.
- The first release is [2026-11-07](openapi/2026-11-07.json).
- `openapi/draft.json` is the working draft. It MAY change at any time and is not a release. At a release it is identical to the new release file, whose date is its `info.version`; between releases its `info.version` is `draft`.
- Additive changes are new optional request fields or question settings, new response fields, and new core types. Any other change, such as removing, renaming, or retyping a field, or making an optional field required, is breaking. Breaking changes SHOULD be avoided and MUST be marked as breaking in the [changelog](CHANGELOG.md).
- Releases after 2026-11-07 fix no endpoint path. The 2026-11-07 release defines its operation at `/v1/systemone`.
- Clients pin a release by vendoring its dated file, optionally with a checksum. Implementers SHOULD state which release they implement.

## Compatibility with TypeSafe

- Open System One is a strict superset of TypeSafe's format: a valid TypeSafe request is a valid `SystemOneRequest`, and TypeSafe answers are valid `SystemOneAnswer`s.
- Implementers accept requests as TypeSafe's clients send them: compressed, and with images as multipart (see [Endpoint and envelope](#endpoint-and-envelope)).
- Releases MUST NOT change TypeSafe's request or answer shapes.
- If TypeSafe adds a type whose name collides with a core type, the next dated release adopts TypeSafe's shape. If that shape is not compatible with the core one, the change is breaking and is marked as such; earlier releases keep the old shape.
