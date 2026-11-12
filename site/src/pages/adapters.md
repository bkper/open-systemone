---
layout: ../layouts/Layout.astro
title: Adapters
description: How today's System One APIs map to Open System One.
---

# Adapters

For implementers. Until providers serve Open System One themselves, a gateway or client library translates. These are the mappings for today's System One APIs. Each adapter also checks every answer against the [answer guarantees](/specification#answer-guarantees) and rejects what a model cannot do with the [standard errors](/specification#errors). Clients written against the contract never see these differences.

The TypeSafe and Cloudflare mappings were verified against their live APIs on 2026-11-07, and the OpenAI and Gemini mappings on 2026-11-12.

A file asset with media type `image/png`, `image/jpeg`, or `image/webp` is an image asset. Every adapter rejects other file assets its provider does not read with `unsupported_parameter`.

## TypeSafe

```http
POST https://api.typesafe.ai/v1/systemone
```

Open System One is a superset of TypeSafe's format, so requests and responses pass through unchanged, except:

- **Question types:** `noul`, `choice`, `score`, and `box`. Reject extraction types with `unsupported_question_type`.
- **`noul` without `instructions`:** TypeSafe rejects it, although its schema allows it. Send the question name as the instructions.
- **Assets:** `png`, `jpg`, and `jpeg` images only; reject `webp` with `unsupported_parameter`. Requests with images need the header `TypeSafe-Danger-Zone-Images: true`.

## Cloudflare Clef

```http
POST https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/@cf/cloudflare/clef
```

| Open System One | Clef |
| --- | --- |
| `model` | `model`, such as `clef` |
| `state` | `state` |
| `questions` | `questions`. Every question needs `instructions`: send the name when they are missing. |
| `assets` | `images`: a list of data URLs, read before the state. At most 4, up to 4 MiB each and 8 MiB in total. |

- **Question types:** `noul`, `choice`, and `score`. Reject `box` and extraction types with `unsupported_question_type`.
- **Assets:** `png`, `jpg`, `jpeg`, and `webp` images.
- **Limits:** at most 64 questions, names of up to 100 letters, digits, `_`, `.`, or `-`, at least 2 choice options, and 2 to 10 score levels. Reject anything beyond them with `unsupported_parameter`.
- **Response:** the answers are in `result` of Cloudflare's `{ success, result }` envelope. Clef does not report truncation.

## Cloudflare Clairic

```http
POST https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/@cf/cloudflare/clairic
```

| Open System One | Clairic |
| --- | --- |
| `model` | `model`, such as `clairic` |
| `state` | `state` as text: send structured state as compact JSON |
| `questions` | `fields`, with names of up to 64 characters, starting with a letter or `_` |
| `assets` | `images`, as for Clef |
| `reference_date` | `reference_date` |
| `quantiles` on an estimate | `options.include_quantiles`, for the whole request |
| — | `options.return_state_text: true`, so spans always have the text they index |

- **Question types:** the extraction types. Reject decision types with `unsupported_question_type`, and forecasts beyond 64 steps with `unsupported_parameter`.
- **Response:** read `result` from the envelope. Return `state_text` when it differs from the state, and `truncated`.
- **Quantiles:** keep them only on estimates that asked for them, never on forecast steps. When a forecast comes back as parallel arrays, rebuild its `steps`.
- **Derived fields:** Clairic can return a `value` that contradicts its own `p_null`, a `guess` of `null`, a span that does not cover its text, or a text list with repeated items collapsed into one. Recompute `value` from `p_null` and `guess`, treat a `null` guess as no guess, locate the text again or set the span to `null`, and restore repeated items from the spans.

## OpenAI Decisions

```http
POST https://api.openai.com/v1/decisions
```

| Open System One | OpenAI Decisions |
| --- | --- |
| `model` | `model`, such as `gpt-6-luna` |
| `state` as a string, without assets | `input` as a string |
| `state` as an object or an array of objects | `input`: a user message with an `input_json` part. Other arrays are sent as compact JSON text. |
| `questions: { name: {…} }` | `questions: [{ name, … }]` |
| `instructions` | `instructions`. Send the name when they are missing, and structured instructions as compact JSON text. |
| `noul` | `predicate`, with `criteria.true` and `criteria.false` written into `instructions` |
| `choice` with `criteria: { value: description }` | `choice` with `choices: [{ value, description }]`, without `description` when it is null |
| `score` with `criteria: [label, …]` | `score` with `levels: [{ label }]` |
| `assets` | Before the state, for each asset, an `input_text` part with its placeholder, then an `input_image` part with a data URL |

| OpenAI Decisions answer | Open System One answer |
| --- | --- |
| `answers: [{ name, … }]` | `answers: { name: {…} }` |
| `predicate` with `probability` | `noul` with `noul` |
| `choice` with `probabilities: [{ value, probability }]` | `choice` with `probabilities: { value: probability }` |
| `score` with `probabilities: [{ value, label, probability }]` | `score` with `probabilities: { index: probability }`, and `legend` rebuilt from the question's criteria |
| `usage.input_tokens`, which includes cached tokens, and `usage.output_tokens` | `usage.input_tokens` and `usage.output_tokens` |
| `refusal` | The request fails with `refused` at `questions.<name>`, without the other answers |

- **Question types:** `noul`, `choice`, and `score`. Reject `box` and extraction types with `unsupported_question_type`.
- **Assets:** `png`, `jpg`, `jpeg`, and `webp` images. OpenAI reads no files or audio.
- **Limits:** 1 to 400 questions, at least 2 choice options, and 2 to 10 score levels. Reject anything beyond them with `unsupported_parameter`.
- **Response:** OpenAI does not report truncation.

## Gemini Decisions

```http
POST https://generativelanguage.googleapis.com/v1beta/decisions
```

Gemini Decisions is in preview, so these mappings may change.

| Open System One | Gemini Decisions |
| --- | --- |
| `model` | `model`, such as `gemini-decision-1` |
| `state` as a string, without assets | `input` as a string |
| `state` as an object or array | `input` as compact JSON text |
| `questions` | `questions`, keyed the same way |
| `instructions` | `instructions`. Send the name when they are missing, and structured instructions and criteria as compact JSON text. |
| `noul` with `criteria.true` and `criteria.false` | `noul` with `criteria.true_description` and `criteria.false_description` |
| `choice` criteria with a null description | An empty description, `""` |
| `assets` | Before the state, for each asset, a text part with its placeholder, then an `image`, `document`, `audio`, or `video` part with `data` and `mime_type`. Gemini joins text parts without a separator, so each part ends its own line. |

| Gemini Decisions answer | Open System One answer |
| --- | --- |
| No `model` | The model of the request |
| `usage.total_input_tokens` and `usage.total_output_tokens` | `usage.input_tokens` and `usage.output_tokens`; Gemini may omit output tokens, which are 0 |
| `noul` with `confidence` | `noul`, without `confidence` |
| `score` with `legend` | `score`, with `legend` rebuilt from the question's criteria |
| HTTP 400 with `error.code` `safety`, `prohibited_content`, `blocklist`, `image_safety`, or `content_blocked` | `refused`, with `param` null |

- **Question types:** `noul`, `choice`, and `score`. Reject `box` and extraction types with `unsupported_question_type`.
- **Assets:** image assets in every format, and file assets of these media types:

  | Kind | Media types |
  | --- | --- |
  | Documents | `application/pdf` |
  | Images | `image/png`, `image/jpeg`, `image/webp`, `image/heic`, `image/heif`, `image/gif`, `image/bmp`, `image/tiff` |
  | Audio | `audio/wav`, `audio/mp3`, `audio/mpeg`, `audio/aiff`, `audio/aac`, `audio/ogg`, `audio/flac`, `audio/m4a`, `audio/opus`, `audio/webm`, `audio/l16`, `audio/alaw`, `audio/mulaw` |
  | Video | `video/mp4`, `video/mpeg`, `video/mov`, `video/avi`, `video/webm`, `video/wmv`, `video/x-flv`, `video/3gpp` |

- **Limits:** at most 1,000 questions, named with up to 64 letters, digits, `_`, or `-`; at least 2 choice options, named with up to 128 characters, without leading or trailing spaces, control characters, or non-ASCII spaces; and at least 2 nonempty score levels. Reject anything beyond them with `unsupported_parameter`.
- **Response:** Gemini does not report truncation.

## Open gaps

What adapters handle today that the specification does not define yet. Each is a candidate for a later release. TypeSafe and Cloudflare document none of them.

| Gap | OpenAI | Gemini | Adapters today |
| --- | --- | --- | --- |
| Assets by URL | HTTPS image URLs | HTTPS and Files API URIs | Send the bytes inline |
| Image detail | `detail`: `low`, `high`, `auto`, or `original` | `resolution`: `low`, `medium`, `high`, or `ultra_high` | Use the provider's default |
| Cached input tokens | Counted within `input_tokens` | Not offered for decisions | Report them within `input_tokens` |
