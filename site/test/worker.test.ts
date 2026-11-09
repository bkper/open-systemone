import { describe, expect, it } from 'bun:test';
import worker from '../worker.ts';

// Serves a few pages the way Workers static assets do: unknown paths get the 404 page.
const PAGES: Readonly<Record<string, [string, string]>> = {
    '/': ['<h1>Open System One</h1>', 'text/html; charset=utf-8'],
    '/specification': ['<h1>Specification</h1>', 'text/html; charset=utf-8'],
    '/index.md': ['# Open System One', 'text/markdown; charset=utf-8'],
    '/specification.md': ['# Specification', 'text/markdown; charset=utf-8'],
    '/llms.txt': ['# Open System One', 'text/plain; charset=utf-8'],
};

const ASSETS = {
    fetch(request: Request): Promise<Response> {
        const page = PAGES[new URL(request.url).pathname];
        if (!page) {
            return Promise.resolve(new Response('<h1>Not found</h1>', {
                status: 404,
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
            }));
        }
        return Promise.resolve(new Response(page[0], { headers: { 'Content-Type': page[1] } }));
    },
};

function get(path: string, accept: string): Promise<Response> {
    return worker.fetch(new Request(`https://opensystemone.org${path}`, { headers: { Accept: accept } }), { ASSETS });
}

const BROWSER = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';

describe('site worker', () => {
    it('serves a page as Markdown when the request asks for Markdown', async () => {
        for (const [path, markdown] of [['/', '# Open System One'], ['/specification', '# Specification']]) {
            const response = await get(path ?? '', 'text/markdown, text/html;q=0.9');
            expect(response.status).toBe(200);
            expect(response.headers.get('Content-Type')).toStartWith('text/markdown');
            expect(response.headers.get('Vary')).toContain('Accept');
            expect(await response.text()).toBe(markdown ?? '');
        }
    });

    it('serves HTML to browsers, varying by Accept so caches keep both versions apart', async () => {
        const response = await get('/', BROWSER);
        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toStartWith('text/html');
        expect(response.headers.get('Vary')).toContain('Accept');
    });

    it('serves files as they are, whatever the request asks for', async () => {
        const response = await get('/llms.txt', 'text/markdown');
        expect(response.headers.get('Content-Type')).toStartWith('text/plain');
        expect(await response.text()).toBe('# Open System One');
    });

    it('answers a missing page with a Markdown 404 that points to llms.txt', async () => {
        const response = await get('/nope', 'text/markdown');
        expect(response.status).toBe(404);
        expect(response.headers.get('Content-Type')).toStartWith('text/markdown');
        expect(await response.text()).toContain('/llms.txt');
    });

    it('answers a missing page with a JSON problem when the request asks for JSON', async () => {
        const response = await get('/api/nope', 'application/json');
        expect(response.status).toBe(404);
        expect(response.headers.get('Content-Type')).toStartWith('application/problem+json');
        const problem: { status?: number; title?: string } = await response.json();
        expect(problem.status).toBe(404);
        expect(problem.title).toBe('Not Found');
    });

    it('answers a missing page in a browser with the 404 page', async () => {
        const response = await get('/nope', BROWSER);
        expect(response.status).toBe(404);
        expect(await response.text()).toBe('<h1>Not found</h1>');
    });
});
