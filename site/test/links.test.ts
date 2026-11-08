import { describe, expect, it } from 'bun:test';
import { markdownForLlms, siteHref } from '../src/lib/links.ts';

describe('siteHref', () => {
    it('maps the spec documents to their pages', () => {
        expect(siteHref('SPEC.md')).toBe('/specification');
        expect(siteHref('SPEC.md#answer-guarantees')).toBe('/specification#answer-guarantees');
        expect(siteHref('CHANGELOG.md')).toBe('/changelog');
        expect(siteHref('README.md')).toBe('/');
    });

    it('serves OpenAPI files from the site', () => {
        expect(siteHref('openapi/2026-11-07.json')).toBe('/openapi/2026-11-07.json');
    });

    it('sends other repository files to GitHub', () => {
        expect(siteHref('examples/README.md')).toBe(
            'https://github.com/opensystemoneorg/opensystemone/blob/main/examples/README.md'
        );
        expect(siteHref('LICENSE')).toBe('https://github.com/opensystemoneorg/opensystemone/blob/main/LICENSE');
    });

    it('leaves anchors, site paths, and absolute URLs alone', () => {
        expect(siteHref('#errors')).toBe('#errors');
        expect(siteHref('/adapters')).toBe('/adapters');
        expect(siteHref('https://www.openresponses.org')).toBe('https://www.openresponses.org');
        expect(siteHref('mailto:someone@example.com')).toBe('mailto:someone@example.com');
    });
});

describe('markdownForLlms', () => {
    it('drops front matter and makes repository and site links absolute', () => {
        const markdown = [
            '---',
            'title: Adapters',
            '---',
            '',
            'See the [changelog](CHANGELOG.md), the [release](openapi/2026-11-07.json),',
            'the [errors](/specification#errors), [below](#limits), and [Open Responses](https://www.openresponses.org).',
        ].join('\n');

        expect(markdownForLlms(markdown)).toBe([
            'See the [changelog](https://opensystemone.org/changelog.md), the [release](https://opensystemone.org/openapi/2026-11-07.json),',
            'the [errors](https://opensystemone.org/specification.md#errors), [below](#limits), and [Open Responses](https://www.openresponses.org).',
        ].join('\n'));
    });
});
