# Open System One

Public, neutral specification for System One model APIs (`POST /v1/systemone`). Bkper maintains it, but the contract must stay vendor-neutral.

## Layout

- `README.md`: purpose, problem, the four gaps, non-goals
- `SPEC.md`: normative rules (MUST/SHOULD)
- `CHANGELOG.md`: contract changes per release, newest first, with an `Unreleased` section
- `LICENSE`: Apache-2.0
- `openapi/draft.json`: the working draft
- `openapi/<YYYY-MM-DD>.json`: released versions
- `examples/`: request, response, and error examples; `examples/invalid/` holds examples that must fail
- `scripts/validate.js`: validates the examples against the contract
- `scripts/check-spec.js`: checks that `SPEC.md` agrees with the contract

## Rules

- The source of truth is hand-written OpenAPI 3.1 JSON in `openapi/`. Do not add TypeSpec, Zod, or code generators.
- Released files `openapi/<YYYY-MM-DD>.json` are immutable. Never edit them. Make changes in `openapi/draft.json` and release a new dated file.
- `SPEC.md` and the OpenAPI file must agree. Change both in the same commit.
- No Bkper-specific or provider-specific names in the contract. Non-core types use an `owner:type` prefix.
- Stay a strict superset of TypeSafe's format. Do not change TypeSafe's existing request or answer shapes.
- Keep it thin. No website, no marketing copy.
- Every relative link in the markdown files must resolve to an existing file.

## Validation

Run before committing:

```bash
bun install
bun run validate
```

It checks every example against `openapi/draft.json` (or the latest dated file when there is no draft): files outside `examples/invalid/` must pass, files inside must fail, and a request/response pair must have matching question names and types and pass the cross-checks JSON Schema cannot express (choice in criteria, null threshold, span text, estimate bounds, forecast horizon). The file suffix selects the schema (`.request.json`, `.response.json`, `.error.json`); see `examples/README.md`.

It then checks `SPEC.md` against the same contract: the question types table lists exactly the contract's question and answer types with their schema names and required and optional settings, each table headed by a schema name (such as `SystemOneRequest`) lists exactly its properties and which are required, every core type has an answer guarantee, and every schema name mentioned exists. CI runs the same command on every push and pull request (`.github/workflows/validate.yml`).

When adding a question or answer type, add a valid example and at least one invalid example for it, and add it to the types table and answer guarantees in `SPEC.md`.

## Commits

- Subject line: imperative, under 72 characters (aim for 50), one idea, no chained clauses.
- Put the why in a short bullet body only when needed.
- Never reference plans, tasks, or internal tickets in files or commits.
