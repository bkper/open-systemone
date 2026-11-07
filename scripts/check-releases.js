// Checks that released contracts stay immutable.
//
// - Every openapi/YYYY-MM-DD.json ever added in the git history still exists, with the same
//   content as in the commit that added it.
// - Every release file's info.version is its date.
// - When openapi/draft.json names a release in info.version, it is identical to that release.
//
// Needs the full git history: a shallow clone fails the check.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { RELEASE_FILE, releaseFiles } from './contract.js';

const root = join(import.meta.dirname, '..');
const failures = [];

function git(...args) {
    return execFileSync('git', args, { cwd: root, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
}

if (git('rev-parse', '--is-shallow-repository').toString().trim() !== 'false') {
    failures.push('the git history is shallow; fetch the full history to check releases');
} else {
    const added = git('log', '--diff-filter=A', '--name-only', '--format=', '--', 'openapi/')
        .toString()
        .split('\n')
        .filter(path => path.startsWith('openapi/') && RELEASE_FILE.test(basename(path)));
    for (const path of new Set(added)) {
        if (!existsSync(join(root, path))) {
            failures.push(`${path} was released and must not be deleted or renamed`);
            continue;
        }
        const [first] = git('log', '--diff-filter=A', '--format=%H', '--reverse', '--', path)
            .toString()
            .split('\n');
        const released = git('show', `${first}:${path}`);
        if (!released.equals(readFileSync(join(root, path)))) {
            failures.push(`${path} differs from its release in ${first.slice(0, 7)}; released files must not change`);
        }
    }
}

for (const file of releaseFiles(root)) {
    const { version } = JSON.parse(readFileSync(join(root, 'openapi', file), 'utf8')).info;
    if (`${version}.json` !== file) failures.push(`openapi/${file} has info.version ${version}`);
}

const draftPath = join(root, 'openapi', 'draft.json');
if (existsSync(draftPath)) {
    const { version } = JSON.parse(readFileSync(draftPath, 'utf8')).info;
    const releasePath = join(root, 'openapi', `${version}.json`);
    if (RELEASE_FILE.test(`${version}.json`)) {
        if (!existsSync(releasePath)) {
            failures.push(`openapi/draft.json names release ${version}, which does not exist`);
        } else if (!readFileSync(draftPath).equals(readFileSync(releasePath))) {
            failures.push(`openapi/draft.json names release ${version} but differs from it`);
        }
    }
}

if (failures.length > 0) {
    console.error(failures.map(failure => `Releases: ${failure}`).join('\n'));
    process.exit(1);
}
console.log(`Releases unchanged: ${releaseFiles(root).join(', ') || 'none'}`);
