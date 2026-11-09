import type { APIRoute } from 'astro';
import { execFileSync } from 'node:child_process';
import { SITE_URL } from '../lib/links.ts';
import { PAGES } from '../lib/pages.ts';

// The pages change only through commits, so the last commit's date is when the site last changed.
const lastmod = execFileSync('git', ['log', '-1', '--format=%cs'], { encoding: 'utf8' }).trim();

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PAGES.map(page => `  <url>\n    <loc>${SITE_URL}${page.href}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`).join('\n')}
</urlset>
`;

export const GET: APIRoute = () =>
    new Response(sitemap, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
