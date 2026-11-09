import type { APIRoute } from 'astro';
import { SITE_URL } from '../lib/links.ts';
import { latestRelease } from '../lib/releases.ts';
import { referenceMarkdown } from '../lib/schema.ts';

export const GET: APIRoute = () =>
    new Response(referenceMarkdown(latestRelease, SITE_URL), {
        headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    });
