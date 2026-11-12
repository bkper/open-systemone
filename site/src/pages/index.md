---
layout: ../layouts/Layout.astro
title: Open System One
description: An open specification for System One model APIs, so software can switch models by changing a URL.
---

# Open System One

<p class="lead">An open specification for System One model APIs: what <a href="https://www.openresponses.org">Open Responses</a> is for LLMs, for System One models.</p>

System One models answer typed questions about an input: the probability that something is true, a choice, a score, or a value read from a document. They return structured answers with probabilities instead of generated text, and software reads those answers directly.

## Why

LLM APIs began with chat completions: text in, text out. Each provider shipped its own variant, structured output was added later, and applications collected an adapter per provider until Open Responses gave them a shared contract.

System One APIs are at that same starting point. Four providers already ship four formats for the same idea:

| Provider | Questions | Yes/no question | Images and files |
| --- | --- | --- | --- |
| TypeSafe | an object keyed by name | `noul` | `assets` placeholders |
| Cloudflare | `questions`, or `fields` for extraction | `noul` | an `images` list |
| OpenAI | an array with a `name` each | `predicate` | `input_image` parts |
| Google | an object keyed by name | `noul` | `input` parts |

The answers differ too. One model returns a value that contradicts its own probability of being null, one refuses a single question and another the whole request, and a server may ignore a question type it does not know. A wrapper can rename fields, but it cannot make answers mean the same thing.

This matters more than it did for chat, because code reads every answer. A company can call a System One model from hundreds of places across its apps. If each call depends on one provider's format, changing models becomes a migration project instead of a configuration change.

## What it defines

- **One contract, at any URL.** A request `{model, state, questions, assets}` and a response `{model, answers, usage}`.
- **TypeSafe's format as the base.** Any valid TypeSafe request is a valid Open System One request.
- **Decision and extraction questions.** `noul`, `choice`, `score`, and `box` judge the input. `text`, `number`, `date`, `time`, `datetime`, `duration`, `list`, `estimate`, and `forecast` read values from it.
- **Images and files as assets**, such as a receipt photo or a PDF, referred to from the state by placeholder.
- **Answer guarantees** that code can rely on, such as when a value is null, what a span points at, and that estimates stay within bounds.
- **Standard errors** for a question type, setting, or asset a model cannot handle, instead of ignoring it, and for a model that refuses to answer.
- **Dated releases** that never change, and `owner:type` extensions that can become core.

## Example

```http
POST https://api.example.com/v1/systemone
```

```json
{
  "model": "your-model",
  "state": "Invoice INV-2291 from Northwind Supply. Total due: $1,080.00 by 2026-10-02.",
  "questions": {
    "is_invoice": { "type": "noul", "instructions": "Is this an invoice?" },
    "total": { "type": "number", "decimals": 2, "unit": "USD" }
  }
}
```

```json
{
  "model": "your-model",
  "answers": {
    "is_invoice": { "type": "noul", "noul": 0.99 },
    "total": {
      "type": "number",
      "value": 1080,
      "p_null": 0.001,
      "confidence": 0.99,
      "guess": 1080,
      "span": [52, 60]
    }
  },
  "usage": { "input_tokens": 64, "output_tokens": 8 }
}
```

Switching to another implementer changes two values. The questions and the code that reads the answers stay the same:

```diff
- https://api.example.com/v1/systemone
+ https://other.example.net/systemone

- "model": "your-model"
+ "model": "other-model"
```

The same request can also compare models or route between them.

## Implementations

- **[Bkper AI gateway](https://bkper.com/docs/ai/system-one-models)**, at `https://ai.bkper.app/v1/systemone`: models from TypeSafe, Cloudflare, OpenAI, and Google, translated with the [adapters](/adapters).

Implemented it? [Open an issue](https://github.com/opensystemoneorg/opensystemone/issues) to be listed.

## Get started

**To call models:**

1. Read the [specification](/specification), and look up schemas in the [reference](/reference).
2. Configure the full endpoint URL and the model; don't build them in code.
3. Pin a release by vendoring its dated OpenAPI file from the [changelog](/changelog).

**To serve models:**

1. Serve the operation at a URL you choose, and state which release you implement.
2. Reject what your model cannot handle with the [standard errors](/specification#errors), and return answers that meet the [answer guarantees](/specification#answer-guarantees).
3. Check your requests and answers against the [examples](https://github.com/opensystemoneorg/opensystemone/tree/main/examples). To translate an existing API, start from the [adapters](/adapters).

## Origin

Open System One started at [Bkper](https://bkper.com), a bookkeeping platform that uses System One models to categorize transactions and read invoices and bank statements. Calling models from four providers there meant an adapter per format, and every app depended on those formats. Bkper wrote down the contract its gateway serves and published it as a separate, open specification, so other providers, gateways, and clients can use it on the same terms.

## Get involved

Open System One is developed in the open on [GitHub](https://github.com/opensystemoneorg/opensystemone). Providers, gateways, and client authors are welcome: open an issue or a pull request with what your API needs. Releases are dated and never change, and a new question type becomes core once two independent implementers support it with the same shape.
