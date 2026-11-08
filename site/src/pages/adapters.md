---
layout: ../layouts/Layout.astro
title: Adapters
description: How today's System One APIs map to Open System One.
---

# Adapters

Until providers serve Open System One themselves, a client or gateway translates. These are the mappings for today's System One APIs. Each adapter also checks every answer against the [answer guarantees](/specification#answer-guarantees) and rejects what a model cannot do with the [standard errors](/specification#errors).

The TypeSafe and Cloudflare mappings were verified against their live APIs on 2026-11-07. The OpenAI mapping follows OpenAI's published documentation.

## TypeSafe

```http
POST https://api.typesafe.ai/v1/systemone
```

Open System One is a superset of TypeSafe's format, so requests and responses pass through unchanged, except:

- **Question types:** `noul`, `choice`, `score`, and `box`. Reject extraction types with `unsupported_question_type`.
- **`noul` without `instructions`:** TypeSafe rejects it, although its schema allows it. Send the question name as the instructions.
- **Images:** `png`, `jpg`, and `jpeg` only; reject `webp` with `unsupported_parameter`. Requests with images need the header `TypeSafe-Danger-Zone-Images: true`.

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

- **Question types:** `noul`, `choice`, and `score`.
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
| `state` as a string | `input` as a string |
| `state` as an object or array | `input`: a user message with an `input_json` part |
| `questions: { name: {…} }` | `questions: [{ name, … }]` |
| `noul` | `predicate`, with `criteria.true` and `criteria.false` written into `instructions` |
| `choice` with `criteria: { value: description }` | `choice` with `choices: [{ value, description }]` |
| `score` with `criteria: [label, …]` | `score` with `levels: [{ label }]`, 2 to 10 |
| `assets` | `input_image` parts with data URLs |

| OpenAI Decisions answer | Open System One answer |
| --- | --- |
| `answers: [{ name, … }]` | `answers: { name: {…} }` |
| `predicate` with `probability` | `noul` with `noul` |
| `choice` with `probabilities: [{ value, probability }]` | `choice` with `probabilities: { value: probability }` |
| `score` with `probabilities: [{ value, label, probability }]` | `score` with `probabilities: { index: probability }` and `legend: { index: label }` |
| `refusal` | No equivalent yet: the request fails |

- **Question types:** `noul`, `choice`, and `score`. OpenAI documents no `box` type and no extraction types; reject them with `unsupported_question_type`.
