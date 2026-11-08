// Serves the static site, and sends www.opensystemone.org to the bare domain.

interface Env {
    ASSETS: { fetch(request: Request): Promise<Response> };
}

const CANONICAL_HOST = 'opensystemone.org';

export default {
    fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        if (url.hostname === `www.${CANONICAL_HOST}`) {
            url.hostname = CANONICAL_HOST;
            return Promise.resolve(Response.redirect(url.toString(), 301));
        }
        return env.ASSETS.fetch(request);
    },
};
