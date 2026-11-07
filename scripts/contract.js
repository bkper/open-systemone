import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const RELEASE_FILE = /^\d{4}-\d{2}-\d{2}\.json$/;

// Dated release files in openapi/, oldest first.
export function releaseFiles(root) {
    return readdirSync(join(root, 'openapi')).filter(file => RELEASE_FILE.test(file)).sort();
}

// The contracts checked by the scripts: openapi/draft.json, plus the release it is identical to
// when its info.version names a release; or the latest release when there is no draft.
export function contractPaths(root) {
    const draft = join(root, 'openapi', 'draft.json');
    if (!existsSync(draft)) {
        const latest = releaseFiles(root).at(-1);
        if (!latest) throw new Error('No OpenAPI file found in openapi/');
        return [join(root, 'openapi', latest)];
    }
    const { version } = JSON.parse(readFileSync(draft, 'utf8')).info;
    const release = join(root, 'openapi', `${version}.json`);
    return RELEASE_FILE.test(`${version}.json`) && existsSync(release) ? [draft, release] : [draft];
}
