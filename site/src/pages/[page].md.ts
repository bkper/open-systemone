import type { APIRoute, GetStaticPaths } from 'astro';
import { markdownForLlms } from '../lib/links.ts';
import overview from './index.md?raw';
import adapters from './adapters.md?raw';
import specification from '../../../SPEC.md?raw';
import changelog from '../../../CHANGELOG.md?raw';

// Each page as Markdown, for LLMs and tools that read text: /index.md, /specification.md, and so on.
const pages: Readonly<Record<string, string>> = { index: overview, specification, adapters, changelog };

export const getStaticPaths = (() =>
    Object.entries(pages).map(([page, markdown]) => ({ params: { page }, props: { markdown } }))
) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
    new Response(markdownForLlms(String(props.markdown)), {
        headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    });
