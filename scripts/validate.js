// Validates every example in examples/ against the OpenAPI contract: the draft, and the
// release it is identical to when it names one.
//
// The file suffix selects the schema: *.request.json, *.response.json, *.error.json.
// Files under examples/invalid/ must fail validation; all others must pass.
// A response is checked against its request: the request with the same name up to the
// first dot, in the response's directory or in examples/. The checks cover rules JSON
// Schema cannot express: matching question names and types, choice in criteria, null
// threshold, span text, list spans, estimate bounds and grid, quantiles only when requested,
// and forecast horizon.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { createValidators, pairProblems } from './checks.js';
import { contractPaths } from './contract.js';

const root = join(import.meta.dirname, '..');
const examplesDir = join(root, 'examples');
const invalidDir = join(examplesDir, 'invalid');

const SCHEMA_BY_SUFFIX = {
    '.request.json': 'SystemOneRequest',
    '.response.json': 'SystemOneResponse',
    '.error.json': 'SystemOneErrorResponse',
};

function listJsonFiles(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return listJsonFiles(path);
        return entry.name.endsWith('.json') ? [path] : [];
    });
}

function readJson(path) {
    return JSON.parse(readFileSync(path, 'utf8'));
}

function schemaFor(path) {
    const suffix = Object.keys(SCHEMA_BY_SUFFIX).find(s => path.endsWith(s));
    return suffix ? SCHEMA_BY_SUFFIX[suffix] : undefined;
}

function requestFor(responsePath) {
    const name = `${basename(responsePath).split('.')[0]}.request.json`;
    const path = [dirname(responsePath), examplesDir].map(dir => join(dir, name)).find(existsSync);
    return path ? readJson(path) : undefined;
}

function validateExamples(contract) {
    const validators = createValidators(readJson(contract), Object.values(SCHEMA_BY_SUFFIX));
    const failures = [];
    let checked = 0;

    for (const path of listJsonFiles(examplesDir).sort()) {
        const name = relative(root, path);
        const schema = schemaFor(path);
        if (!schema) {
            failures.push(`${name}: name must end with ${Object.keys(SCHEMA_BY_SUFFIX).join(', ')}`);
            continue;
        }
        const validate = validators[schema];
        const example = readJson(path);
        const problems = validate(example) ? [] : [`fails ${schema}\n${JSON.stringify(validate.errors, null, 2)}`];
        if (problems.length === 0 && schema === 'SystemOneResponse') {
            const request = requestFor(path);
            if (request) problems.push(...pairProblems(request, example));
        }
        const mustFail = path.startsWith(invalidDir);
        checked++;

        if (mustFail && problems.length === 0) {
            failures.push(`${name}: expected to fail, but it passed`);
        } else if (!mustFail) {
            failures.push(...problems.map(problem => `${name}: ${problem}`));
        }
    }

    if (checked === 0) failures.push('No examples found');
    return { checked, failures: failures.map(failure => `${relative(root, contract)}: ${failure}`) };
}

let failed = false;
for (const contract of contractPaths(root)) {
    const { checked, failures } = validateExamples(contract);
    if (failures.length > 0) {
        console.error(failures.join('\n'));
        failed = true;
    } else {
        console.log(`Validated ${checked} examples against ${relative(root, contract)}`);
    }
}
if (failed) process.exit(1);
