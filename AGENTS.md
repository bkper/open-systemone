# Open System One

Public, neutral specification for System One model APIs. Bkper maintains it, but the contract must stay vendor-neutral.

## Layout

- `README.md`: purpose, problem, the four gaps, non-goals
- `SPEC.md`: normative rules (MUST/SHOULD)
- `CHANGELOG.md`: contract changes per release, newest first, with an `Unreleased` section
- `LICENSE`: Apache-2.0
- `openapi/draft.json`: the working draft; `info.version` is `draft` between releases
- `openapi/<YYYY-MM-DD>.json`: released versions, `info.version` set to the date
- `examples/`: request, response, and error examples; `examples/invalid/` holds examples that must fail
- `scripts/validate.js`: validates the examples against the contract
- `scripts/check-spec.js`: checks that `SPEC.md` agrees with the contract
- `scripts/check-releases.js`: checks that released files never change
- `site/`: the website at https://opensystemone.org (Astro, static), served by `site/worker.ts`, which only redirects `www` and plain HTTP to `https://opensystemone.org`, and deployed by `.github/workflows/deploy.yml` on push to `main`. It also serves `/llms.txt` and each page as Markdown, such as `/specification.md`
- `site/og/og.html`: source of the share image `site/public/og.png`; after changing it, render it at 1200x630 and save the screenshot as the image

## Rules

- The source of truth is hand-written OpenAPI 3.1 JSON in `openapi/`. Do not add TypeSpec, Zod, or code generators.
- Released files `openapi/<YYYY-MM-DD>.json` are immutable. Never edit, rename, or delete them. Make changes in `openapi/draft.json`, setting its `info.version` back to `draft` first, and release a new dated file.
- To release: set the draft's `info.version` to today's UTC date, copy it to `openapi/<date>.json`, point the links in `README.md` and `SPEC.md` at it, move the `Unreleased` changelog entries under `## <date>`, commit, and push an annotated tag named `<date>`.
- `SPEC.md` and the OpenAPI file must agree. Change both in the same commit.
- No Bkper-specific or provider-specific names in the contract. Non-core types use an `owner:type` prefix.
- Stay a strict superset of TypeSafe's format. Do not change TypeSafe's existing request or answer shapes.
- Keep it thin. No marketing copy.
- The site presents the spec; it does not define it. It renders `SPEC.md` and `CHANGELOG.md` and serves the files in `openapi/` byte for byte, so it never holds a second copy. Its own pages are the overview and the adapters.
- In `.astro` templates, never end a line with text when the next line starts with a tag: Astro drops that line break, gluing the words together. Keep the text and its link on one line; a site test checks the built pages.
- Never deploy the site from a local machine. Run `cd site && bun install && bun run test` before committing site changes.
- The contract fixes no endpoint path. Its operation is `components.pathItems.SystemOne`; implementers serve it at a URL they choose.
- Every relative link in the markdown files must resolve to an existing file.

## Validation

Run before committing:

```bash
bun install
bun run validate
```

It checks every example against `openapi/draft.json` and, when the draft's `info.version` names a release, against that release too (or against the latest dated file when there is no draft): files outside `examples/invalid/` must pass, files inside must fail, and a request/response pair must have matching question names and types and pass the cross-checks JSON Schema cannot express (choice in criteria, null threshold, span text, estimate bounds, quantiles only when requested, forecast horizon). The file suffix selects the schema (`.request.json`, `.response.json`, `.error.json`); see `examples/README.md`.

It then checks `SPEC.md` against the same contract: the question types table lists exactly the contract's question and answer types with their schema names and required and optional settings, each table headed by a schema name (such as `SystemOneRequest`) lists exactly its properties and which are required, every core type has an answer guarantee, every schema name mentioned exists, and the contract has no `paths` but a POST operation in `components.pathItems.SystemOne`. Finally it checks that every released file ever committed still exists unchanged, that each release's `info.version` is its date, and that a draft naming a release is identical to it; this needs the full git history. CI runs the same command on every push and pull request (`.github/workflows/validate.yml`).

When adding a question or answer type, add a valid example and at least one invalid example for it, and add it to the types table and answer guarantees in `SPEC.md`.

## Commits

- Subject line: imperative, under 72 characters (aim for 50), one idea, no chained clauses.
- Put the why in a short bullet body only when needed.
- Never reference plans, tasks, or internal tickets in files or commits.
