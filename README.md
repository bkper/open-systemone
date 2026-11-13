# Open System One

An open specification for System One model APIs: what [Open Responses](https://www.openresponses.org) is for LLMs, for System One models.

Website, with implementations and how to get started: [opensystemone.org](https://opensystemone.org)

Open System One is independent. It is not affiliated with TypeSafe, Cloudflare, OpenAI, Google, or Open Responses.

## Purpose

System One models answer typed questions about an input, the state, directly. They return structured answers with probabilities instead of generated text. Decision questions judge the state (yes/no, choice, score); extraction questions read values from it (text, numbers, dates, lists, estimates). The client's code makes the decisions.

Open System One defines one HTTP contract that any provider or gateway can implement for every question type, at a URL it chooses. Switching implementers changes only the endpoint URL and the model:

- Request: `{model, state, questions, assets}`
- Response: `{model, answers, usage}`
- Questions and answers are unions keyed on `type`.

The format is derived from [TypeSafe's API](https://docs.typesafe.ai) and is a strict superset of it: a valid TypeSafe request is a valid Open System One request, and TypeSafe answer shapes are unchanged.

## The problem

System One APIs exist, but each provider has its own envelope, question types, answer shapes, and failure behavior. Clients and gateways that talk to more than one provider end up writing per-provider adapters and guessing at semantics: when a value is null, what a span points at, what happens when input is too long, or what a server does with a question type it does not know.

## What it adds to TypeSafe's format

1. **Dated, immutable releases.** Each release is a single OpenAPI file named by its date. Once released, it never changes.
2. **Normative answer guarantees.** The spec states what every answer must satisfy, such as null rules, span indexing, list ordering, and estimate bounds, so clients can rely on them across providers.
3. **Standard errors.** A server that cannot handle a question type, setting, or asset rejects it with a defined error instead of ignoring it silently, and a refusal to answer has its own code.
4. **Extraction questions.** `text`, `number`, `date`, `time`, `datetime`, `duration`, `list`, `estimate`, and `forecast` read values from the state, next to TypeSafe's decision types.
5. **File assets.** Files of any media type, such as a PDF, next to TypeSafe's image assets.
6. **Prefixed extension types.** Non-core question types use an `owner:type` name, so implementers can extend without collisions. A rule defines when an extension is promoted to core.

## Non-goals

- Not an LLM or chat API. Use Open Responses for that.
- Not a model, SDK, or hosted service.
- Not a benchmark: it fixes what an answer means, not how well a model answers.
- No provider-specific or vendor-specific names in the contract.
- No standard for authentication, billing, rate limits, or errors beyond the standard errors.

## Conformance

The conformance suite checks a live endpoint against the latest release. It sends every valid request in [examples/](examples/README.md) with your model, then tests the rules every implementer follows: unknown question types and unreadable assets are rejected with the standard errors, compressed bodies are accepted, unknown encodings return 415, and assets can be sent as multipart.

```bash
bun install
bun run --silent conformance --url https://api.example.com/v1/systemone --model your-model \
  --header "Authorization: Bearer $API_KEY"
```

An example passes when its answers meet the contract and the answer guarantees, or when the endpoint rejects it with a standard error that names a field of the request, since an implementer need not support every question type. Each test prints `PASS`, `FAIL`, or `SKIP`, and the command exits nonzero on any failure. A refusal cannot be triggered on purpose, so `refused` is not tested. `--silent` keeps `bun` from printing the command, headers included.

## Repository

- `README.md`: this overview
- [SPEC.md](SPEC.md): the normative rules (MUST/SHOULD), including the answer guarantees, errors, extension types, and versioning
- [openapi/2026-11-12.json](openapi/2026-11-12.json): the contract as hand-written OpenAPI 3.1 JSON, the latest dated release; [openapi/draft.json](openapi/draft.json) is the working draft for the next one
- [scripts/conformance.js](scripts/conformance.js): the conformance suite, run with `bun run conformance`
- [examples/](examples/README.md): request, response, and error examples, validated against the contract in CI with `bun run validate`, which also checks that SPEC.md agrees with the contract and that released files never change
- [CHANGELOG.md](CHANGELOG.md): release history

## License

[Apache-2.0](LICENSE)
