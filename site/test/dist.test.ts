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

    it('serves Markdown pages with absolute links only', () => {
        for (const page of ['index.md', 'specification.md', 'adapters.md', 'changelog.md']) {
            const markdown = readFileSync(join(dist, page), 'utf8');
            const relative = [...markdown.matchAll(/\]\(([^)]+)\)/g)]
                .map(match => match[1] ?? '')
                .filter(href => !/^(https?:|mailto:|#)/.test(href));
            expect({ page, relative }).toEqual({ page, relative: [] });
        }
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
