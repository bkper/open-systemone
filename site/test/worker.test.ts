import { describe, expect, it } from 'bun:test';
import worker from '../worker.ts';

const assets = {
    fetch: (request: Request) => Promise.resolve(new Response(`asset ${new URL(request.url).pathname}`)),
};

describe('site worker', () => {
    it('redirects www to the bare domain, keeping the path and query', async () => {
        const response = await worker.fetch(new Request('https://www.opensystemone.org/specification?x=1'), {
            ASSETS: assets,
        });
        expect(response.status).toBe(301);
        expect(response.headers.get('Location')).toBe('https://opensystemone.org/specification?x=1');
    });

    it('serves the site on the bare domain', async () => {
        const response = await worker.fetch(new Request('https://opensystemone.org/adapters'), { ASSETS: assets });
        expect(response.status).toBe(200);
        expect(await response.text()).toBe('asset /adapters');
    });
});
