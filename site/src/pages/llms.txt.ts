import type { APIRoute } from 'astro';
import { REPOSITORY_URL, SITE_URL } from '../lib/links.ts';

const contracts = import.meta.glob('../../../openapi/*.json');
const releases = Object.keys(contracts)
    .map(path => path.split('/').at(-1)?.replace('.json', '') ?? '')
    .filter(name => /^\d{4}-\d{2}-\d{2}$/.test(name))
    .sort();
const latest = releases.at(-1);
if (!latest) throw new Error('No released OpenAPI file in openapi/');

// https://llmstxt.org
const llms = `# Open System One

> An open specification for System One model APIs. System One models answer typed questions about an input (a yes/no probability, a choice, a score, or a value read from a document) and return structured answers with probabilities instead of generated text. Implementers serve one request and response contract at a URL they choose, so clients switch models by changing only the endpoint URL and the model.

- The format is TypeSafe's, extended: any valid TypeSafe request is a valid Open System One request.
- Releases are dated OpenAPI files that never change. The latest release is ${latest}.
- Origin: started at Bkper, a bookkeeping platform, whose AI gateway is the first implementation; published as a separate, open specification.
- Status: early draft, implemented so far by one gateway against three models. Expect breaking changes in the next releases; pin a dated release if you depend on it.

## When to use

- Use it when you call System One models and want one request and response format for all of them, so switching models means changing only the endpoint URL and the model, not your code.
- Use it when you serve a System One model, or a gateway in front of several, and want clients written against the contract to call you unchanged. Serve the OpenAPI operation at any URL; reject question types and parameters you don't support with the documented errors.
- Use it for classification, scoring, yes/no decisions, and extracting typed values (dates, amounts, lists, spans) from text or images, where you need probabilities and machine-checkable answers.
- Don't use it for generated text, chat, tool calling, or embeddings: those belong to chat and responses APIs such as Open Responses.

## Docs

- [Overview](${SITE_URL}/index.md): why a shared contract matters, what it defines, and an example
- [Specification](${SITE_URL}/specification.md): the normative rules, question types, answer guarantees, and errors
- [Reference](${SITE_URL}/reference.md): every schema of the latest release, with its properties and types
- [Adapters](${SITE_URL}/adapters.md): how TypeSafe, Cloudflare Clef and Clairic, and OpenAI Decisions map to the contract
- [Changelog](${SITE_URL}/changelog.md): contract changes in each release

## OpenAPI

${releases.toReversed().map(release => `- [Release ${release}](${SITE_URL}/openapi/${release}.json)`).join('\n')}
- [Working draft](${SITE_URL}/openapi/draft.json): the next release in progress; it may change at any time

## Optional

- [Source on GitHub](${REPOSITORY_URL}): issues and pull requests
`;

export const GET: APIRoute = () =>
    new Response(llms, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
