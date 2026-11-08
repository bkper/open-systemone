# Open System One

An open specification for System One model APIs: what [Open Responses](https://www.openresponses.org) is for LLMs, for System One models.

Open System One is independent. It is not affiliated with TypeSafe or Open Responses.

> **Status: early draft.** The 2026-11-07 release is a first snapshot, implemented by one gateway against three models. Expect breaking changes in the next releases. A dated release never changes, so pin one if you depend on it.

## Purpose

System One models answer typed questions about an input, the state, directly. They return structured answers with probabilities instead of generated text. Decision questions judge the state (yes/no, choice, score); extraction questions read values from it (text, numbers, dates, lists, estimates). The client's code makes the decisions.

Open System One defines one HTTP contract, `POST /v1/systemone`, that any provider or gateway can implement for every question type:

- Request: `{model, state, questions, assets}`
- Response: `{model, answers, usage}`
- Questions and answers are unions keyed on `type`.

The format is derived from [TypeSafe's API](https://docs.typesafe.ai) and is a strict superset of it: a valid TypeSafe request is a valid Open System One request, and TypeSafe answer shapes are unchanged.

## The problem

System One APIs exist, but each provider has its own envelope, question types, answer shapes, and failure behavior. Clients and gateways that talk to more than one provider end up writing per-provider adapters and guessing at semantics: when a value is null, what a span points at, what happens when input is too long, or what a server does with a question type it does not know.

## The four gaps

Open System One stays close to TypeSafe's format and adds only what is needed to make it a shared contract:

1. **Dated, immutable releases.** Each release is a single OpenAPI file named by its date. Once released, it never changes.
2. **Prefixed extension types.** Non-core question types use an `owner:type` name, so implementers can extend without collisions. A rule defines when an extension is promoted to core.
3. **Normative answer guarantees.** The spec states what every answer must satisfy, such as null rules, span indexing, list ordering, and estimate bounds, so clients can rely on them across providers.
4. **A standard unsupported error.** A server that cannot handle a question type or request parameter rejects it with a defined error instead of ignoring it silently.

## Non-goals

- Not an LLM or chat API. Use Open Responses for that.
- Not a model, SDK, hosted service, or website.
- No provider-specific or vendor-specific names in the contract.
- No standard for authentication, billing, rate limits, or errors beyond the unsupported error.

## Repository

- `README.md`: this overview
- [SPEC.md](SPEC.md): the normative rules (MUST/SHOULD), including the answer guarantees, errors, extension types, and versioning
- [openapi/2026-11-07.json](openapi/2026-11-07.json): the contract as hand-written OpenAPI 3.1 JSON, the latest dated release; [openapi/draft.json](openapi/draft.json) is the working draft for the next one
- [examples/](examples/README.md): request, response, and error examples, validated against the contract in CI with `bun run validate`, which also checks that SPEC.md agrees with the contract and that released files never change
- [CHANGELOG.md](CHANGELOG.md): release history

## License

[Apache-2.0](LICENSE)
