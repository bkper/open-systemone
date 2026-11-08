import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import { siteLinks } from './src/lib/links.ts';

export default defineConfig({
    site: 'https://opensystemone.org',
    output: 'static',
    trailingSlash: 'never',
    build: { format: 'file' },
    markdown: {
        processor: satteri({ mdastPlugins: [siteLinks] }),
        shikiConfig: { theme: 'github-light' },
    },
    // The site renders the specification files from the repository root.
    vite: { server: { fs: { allow: ['..'] } } },
});
