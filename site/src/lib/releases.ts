import type { Contract } from './schema.ts';

const contracts = import.meta.glob<Contract>('../../../openapi/*.json', { import: 'default', eager: true });

/** The latest dated release in openapi/. */
export const latestRelease: Contract = (() => {
    const latest = Object.entries(contracts)
        .filter(([path]) => /\/\d{4}-\d{2}-\d{2}\.json$/.test(path))
        .sort(([a], [b]) => a.localeCompare(b))
        .at(-1)?.[1];
    if (!latest) throw new Error('No released OpenAPI file in openapi/');
    return latest;
})();
