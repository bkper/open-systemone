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

| Provider | Questions | Yes/no question | Yes/no criteria | Images and files |
| --- | --- | --- | --- | --- |
| TypeSafe | an object keyed by name | `noul` | `true`, `false` | `assets` placeholders |
| Cloudflare | `questions`, or `fields` for extraction | `noul` | not documented | an `images` list |
| OpenAI | an array with a `name` each | `predicate` | none | `input_image` parts; no files |
| Google | an object keyed by name | `noul` | `true_description`, `false_description` | `input` parts, including PDFs, audio, and video |

This matters more than it did for chat, because code reads every answer. A company can call a System One model from hundreds of places across its apps. If each call depends on one provider's format, changing models becomes a migration project instead of a configuration change.

## What it defines

- **One contract, at any URL.** A request `{model, state, questions}` and a response `{model, answers, usage}`. Switching implementers changes the endpoint URL and the model, nothing else.
- **Images and files as assets.** The state refers to them by placeholder: images in TypeSafe's shape, and files of any media type, such as a PDF.
- **TypeSafe's format as the base.** Any valid TypeSafe request is a valid Open System One request.
- **Decision and extraction questions.** `noul`, `choice`, `score`, and `box` judge the input. `text`, `number`, `date`, `time`, `datetime`, `duration`, `list`, `estimate`, and `forecast` read values from it.
- **Answer guarantees** that code can rely on, such as when a value is null, what a span points at, and that estimates stay within bounds.
- **Standard errors** for a question type or parameter a model does not support.
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

## Origin

Open System One started at [Bkper](https://bkper.com), a bookkeeping platform that uses System One models to categorize transactions and read invoices and bank statements. Trying models from TypeSafe, Cloudflare, OpenAI, and Google there meant a separate adapter for each format, and every app that called them depended on those formats. Bkper wrote down the contract its gateway serves and published it as a separate, open specification, so other providers, gateways, and clients can use it on the same terms. Bkper's gateway is the first implementation.

## Get involved

Open System One is developed in the open on [GitHub](https://github.com/opensystemoneorg/opensystemone). Providers, gateways, and client authors are welcome: open an issue or a pull request with what your API needs, or tell us when you implement it.
