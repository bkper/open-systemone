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

It checks every example against `openapi/draft.json` (or the latest dated file when there is no draft): files outside `examples/invalid/` must pass, files inside must fail, and a request/response pair must have matching question names and types. The file suffix selects the schema (`.request.json`, `.response.json`, `.error.json`); see `examples/README.md`. CI runs the same command on every push and pull request (`.github/workflows/validate.yml`).

When adding a question or answer type, add a valid example and at least one invalid example for it.

## Commits

- Subject line: imperative, under 72 characters (aim for 50), one idea, no chained clauses.
- Put the why in a short bullet body only when needed.
- Never reference plans, tasks, or internal tickets in files or commits.
