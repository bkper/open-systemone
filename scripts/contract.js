import { readdirSync } from 'node:fs';
import { join } from 'node:path';

// The contract checked by the scripts: openapi/draft.json, or the latest dated file when there is no draft.
export function contractPath(root) {
    const files = readdirSync(join(root, 'openapi')).filter(file => file.endsWith('.json')).sort();
    const file = files.includes('draft.json') ? 'draft.json' : files.at(-1);
    if (!file) throw new Error('No OpenAPI file found in openapi/');
    return join(root, 'openapi', file);
}
