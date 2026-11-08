// Serves the static site at https://opensystemone.org, and sends www and plain HTTP there.

interface Env {
    ASSETS: { fetch(request: Request): Promise<Response> };
}

const CANONICAL_HOST = 'opensystemone.org';
const SITE_HOSTS: ReadonlySet<string> = new Set([CANONICAL_HOST, `www.${CANONICAL_HOST}`]);

export default {
    fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        if (SITE_HOSTS.has(url.hostname) && (url.hostname !== CANONICAL_HOST || url.protocol !== 'https:')) {
            url.protocol = 'https:';
            url.hostname = CANONICAL_HOST;
            return Promise.resolve(Response.redirect(url.toString(), 301));
        }
        return env.ASSETS.fetch(request);
    },
};
