// Serves the static site, plus Markdown and JSON for agents that ask for them. It follows the
// content negotiation of the Bkper marketing site: Markdown only when the Accept header names
// text/markdown, so browsers always get HTML.

interface Env {
    ASSETS: { fetch(request: Request): Promise<Response> };
}

function accepts(request: Request, mediaTypes: readonly string[]): boolean {
    return (request.headers.get('Accept') ?? '')
        .split(',')
        .some(part => mediaTypes.includes((part.split(';')[0] ?? '').trim().toLowerCase()));
}

/** The Markdown twin of a page: `/` is `/index.md`, `/specification` is `/specification.md`. */
function markdownPath(pathname: string): string | null {
    if ((pathname.split('/').at(-1) ?? '').includes('.')) return null;
    return pathname === '/' ? '/index.md' : `${pathname.replace(/\/$/, '')}.md`;
}

function withVary(response: Response): Response {
    const headers = new Headers(response.headers);
    const vary = (headers.get('Vary') ?? '').split(',').map(value => value.trim()).filter(Boolean);
    if (!vary.some(value => value.toLowerCase() === 'accept')) headers.set('Vary', ['Accept', ...vary].join(', '));
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

const MARKDOWN_NOT_FOUND = `# Page not found

This page does not exist on Open System One. To find what you are looking for:

- [/llms.txt](/llms.txt): an index of the site for agents
- [/sitemap.xml](/sitemap.xml): every page
- [/specification.md](/specification.md): the specification
`;

function notFound(request: Request, page: Response): Response {
    if (accepts(request, ['text/markdown'])) {
        return withVary(new Response(MARKDOWN_NOT_FOUND, {
            status: 404,
            headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
        }));
    }
    if (accepts(request, ['application/json', 'application/problem+json'])) {
        const problem = {
            type: 'about:blank',
            title: 'Not Found',
            status: 404,
            detail: `Nothing is published at ${new URL(request.url).pathname}. This site publishes a specification and serves no API.`,
            documentation: new URL('/llms.txt', request.url).toString(),
        };
        return withVary(new Response(JSON.stringify(problem), {
            status: 404,
            headers: { 'Content-Type': 'application/problem+json' },
        }));
    }
    return withVary(page);
}

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        const markdown = accepts(request, ['text/markdown']) ? markdownPath(url.pathname) : null;
        if (markdown) {
            const response = await env.ASSETS.fetch(new Request(new URL(markdown, url), request));
            if (response.ok) return withVary(response);
        }
        const response = await env.ASSETS.fetch(request);
        if (response.status === 404) return notFound(request, response);
        return (response.headers.get('Content-Type') ?? '').startsWith('text/html') ? withVary(response) : response;
    },
};
