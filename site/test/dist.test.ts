// Checks the built site in dist/: run `astro build` first (`bun run test` does).
import { describe, expect, it } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const site = join(import.meta.dirname, '..');
const dist = join(site, 'dist');
const repo = join(site, '..');

function files(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const path = join(dir, entry.name);
        return entry.isDirectory() ? files(path) : [path];
    });
}

// A site path resolves the way Workers static assets serve it: as a file, or as an HTML page.
function resolves(path: string): boolean {
    const file = join(dist, decodeURIComponent(path));
    return [file, `${file}.html`, join(file, 'index.html')].some(candidate => existsSync(candidate));
}

describe('built site', () => {
    it('serves every OpenAPI file byte for byte, so vendored checksums match', () => {
        const contracts = readdirSync(join(repo, 'openapi')).filter(name => name.endsWith('.json'));
        expect(contracts.length).toBeGreaterThan(0);
        for (const name of contracts) {
            const served = join(dist, 'openapi', name);
            expect(existsSync(served)).toBe(true);
            expect(readFileSync(served).equals(readFileSync(join(repo, 'openapi', name)))).toBe(true);
        }
    });

    it('publishes llms.txt with links that resolve', () => {
        const llms = readFileSync(join(dist, 'llms.txt'), 'utf8');
        expect(llms.startsWith('# Open System One\n')).toBe(true);
        const links = [...llms.matchAll(/\]\(https:\/\/opensystemone\.org(\/[^)#]*)/g)].map(match => match[1] ?? '');
        expect(links.length).toBeGreaterThan(0);
        expect(links.filter(link => !resolves(link))).toEqual([]);
    });

    it('serves a Markdown twin of every HTML page', () => {
        const pages = files(dist)
            .filter(path => path.endsWith('.html') && !path.endsWith('404.html'))
            .map(path => relative(dist, path).replace(/\.html$/, ''));
        expect(pages.length).toBeGreaterThan(0);
        for (const page of pages) {
            const markdown = readFileSync(join(dist, `${page}.md`), 'utf8');
            expect({ page, heading: markdown.startsWith('# ') }).toEqual({ page, heading: true });
        }
    });

    it('lists every page in the sitemap, which robots.txt points to', () => {
        const sitemap = readFileSync(join(dist, 'sitemap.xml'), 'utf8');
        const listed = [...sitemap.matchAll(/<loc>https:\/\/opensystemone\.org(\/[^<]*)<\/loc>\s*<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g)]
            .map(match => match[1] ?? '');
        const pages = files(dist)
            .filter(path => path.endsWith('.html') && !path.endsWith('404.html'))
            .map(path => `/${relative(dist, path).replace(/\.html$/, '').replace(/^index$/, '')}`);
        expect(listed.toSorted()).toEqual(pages.toSorted());
        expect(readFileSync(join(dist, 'robots.txt'), 'utf8')).toContain('Sitemap: https://opensystemone.org/sitemap.xml');
    });

    it('describes the site as JSON-LD on the homepage', () => {
        const html = readFileSync(join(dist, 'index.html'), 'utf8');
        const json = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
        const graph: { '@type': string; name?: string; url?: string }[] = JSON.parse(json ?? '{}')['@graph'] ?? [];
        const website = graph.find(node => node['@type'] === 'WebSite');
        expect(website?.name).toBe('Open System One');
        expect(website?.url).toBe('https://opensystemone.org/');
    });

    it('serves Markdown pages with absolute links only', () => {
        for (const page of ['index.md', 'specification.md', 'reference.md', 'adapters.md', 'changelog.md']) {
            const markdown = readFileSync(join(dist, page), 'utf8');
            const relative = [...markdown.matchAll(/\]\(([^)]+)\)/g)]
                .map(match => match[1] ?? '')
                .filter(href => !/^(https?:|mailto:|#)/.test(href));
            expect({ page, relative }).toEqual({ page, relative: [] });
        }
    });

    it('gives every page a 1200 by 630 share image', () => {
        for (const page of files(dist).filter(path => path.endsWith('.html'))) {
            const html = readFileSync(page, 'utf8');
            const image = html.match(/<meta property="og:image" content="https:\/\/opensystemone\.org(\/[^"]+)"/)?.[1];
            expect({ page: relative(dist, page), image: image ?? null }).toEqual({ page: relative(dist, page), image: '/og.png' });
        }
        const png = readFileSync(join(dist, 'og.png'));
        expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
    });

    it('keeps a space between words and the links or code next to them', () => {
        const glued: string[] = [];
        for (const page of files(dist).filter(path => path.endsWith('.html'))) {
            const html = readFileSync(page, 'utf8');
            for (const [match] of html.matchAll(/\w<(a|code)[\s>]|<\/(a|code)>(?!s\b)\w/g)) {
                glued.push(`${relative(dist, page)}: ${match}`);
            }
        }
        expect(glued).toEqual([]);
    });

    it('links only to pages and files that exist', () => {
        const broken: string[] = [];
        for (const page of files(dist).filter(path => path.endsWith('.html'))) {
            const html = readFileSync(page, 'utf8');
            for (const [, href] of html.matchAll(/href="(\/[^"#?]*)/g)) {
                if (!resolves(href)) broken.push(`${relative(dist, page)} -> ${href}`);
            }
        }
        expect(broken).toEqual([]);
    });
});
