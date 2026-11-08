import { defineMdastPlugin } from 'satteri';

// The site renders the repository's Markdown files, whose links are relative to the repository.
// siteHref turns those links into site pages, site files, or GitHub URLs.

export const REPOSITORY_URL = 'https://github.com/opensystemoneorg/opensystemone';
export const SITE_URL = 'https://opensystemone.org';

const PAGES: Readonly<Record<string, string>> = {
    'README.md': '/',
    'SPEC.md': '/specification',
    'CHANGELOG.md': '/changelog',
};

export function siteHref(href: string): string {
    if (href.startsWith('#') || href.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(href)) return href;
    const [path = '', hash] = href.split('#', 2);
    const anchor = hash === undefined ? '' : `#${hash}`;
    const file = path.replace(/^\.\//, '');
    const page = PAGES[file];
    if (page) return `${page}${anchor}`;
    if (/^openapi\/[^/]+\.json$/.test(file)) return `/${file}${anchor}`;
    return `${REPOSITORY_URL}/blob/main/${file}${anchor}`;
}

/**
 * A Markdown file as served to LLMs: without front matter, and with links made absolute so they
 * work wherever the text is read. Links to site pages point at their Markdown versions; links to
 * anchors in the same file stay as they are.
 */
export function markdownForLlms(markdown: string): string {
    const body = markdown.replace(/^---\n[\s\S]*?\n---\n+/, '');
    return body.replace(/\]\(([^)\s]+)\)/g, (_, href: string) => {
        const target = siteHref(href);
        if (!target.startsWith('/')) return `](${target})`;
        const [path = '', hash] = target.split('#', 2);
        const page = /^\/[a-z-]*$/.test(path) ? `${path === '/' ? '/index' : path}.md` : path;
        return `](${SITE_URL}${page}${hash === undefined ? '' : `#${hash}`})`;
    });
}

/** A Sätteri Markdown plugin that applies siteHref to every link. */
export const siteLinks = defineMdastPlugin({
    name: 'site-links',
    link(node, ctx) {
        const href = siteHref(node.url);
        if (href !== node.url) ctx.setProperty(node, 'url', href);
    },
});
