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

    it('upgrades plain HTTP to HTTPS on the bare domain', async () => {
        for (const url of ['http://www.opensystemone.org/adapters', 'http://opensystemone.org/adapters']) {
            const response = await worker.fetch(new Request(url), { ASSETS: assets });
            expect(response.status).toBe(301);
            expect(response.headers.get('Location')).toBe('https://opensystemone.org/adapters');
        }
    });

    it('leaves other hosts, such as local development, alone', async () => {
        const response = await worker.fetch(new Request('http://localhost:8787/adapters'), { ASSETS: assets });
        expect(response.status).toBe(200);
    });

    it('serves the site on the bare domain', async () => {
        const response = await worker.fetch(new Request('https://opensystemone.org/adapters'), { ASSETS: assets });
        expect(response.status).toBe(200);
        expect(await response.text()).toBe('asset /adapters');
    });
});
