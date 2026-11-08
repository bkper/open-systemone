import { defineMdastPlugin } from 'satteri';

// The site renders the repository's Markdown files, whose links are relative to the repository.
// siteHref turns those links into site pages, site files, or GitHub URLs.

export const REPOSITORY_URL = 'https://github.com/opensystemoneorg/opensystemone';

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

/** A Sätteri Markdown plugin that applies siteHref to every link. */
export const siteLinks = defineMdastPlugin({
    name: 'site-links',
    link(node, ctx) {
        const href = siteHref(node.url);
        if (href !== node.url) ctx.setProperty(node, 'url', href);
    },
});
