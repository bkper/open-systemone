// Validates every example in examples/ against the OpenAPI contract.
//
// The file suffix selects the schema: *.request.json, *.response.json, *.error.json.
// Files under examples/invalid/ must fail validation; all others must pass.
// A request and response that share a name must have matching question names and types.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = join(import.meta.dirname, '..');
const examplesDir = join(root, 'examples');
const invalidDir = join(examplesDir, 'invalid');

const SCHEMA_BY_SUFFIX = {
    '.request.json': 'SystemOneRequest',
    '.response.json': 'SystemOneResponse',
    '.error.json': 'SystemOneErrorResponse',
};

function contractPath() {
    const files = readdirSync(join(root, 'openapi')).filter(file => file.endsWith('.json')).sort();
    const file = files.includes('draft.json') ? 'draft.json' : files.at(-1);
    if (!file) throw new Error('No OpenAPI file found in openapi/');
    return join(root, 'openapi', file);
}

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

function createValidators(document) {
    const ajv = new Ajv2020({ strict: true, allErrors: true });
    addFormats(ajv);
    // OpenAPI annotation: oneOf plus a const type already selects the branch.
    ajv.addKeyword('discriminator');
    // Lets refs like #/components/schemas/X resolve inside the wrapper schema.
    ajv.addKeyword('components');
    ajv.addSchema({ $id: 'contract', components: document.components });

    const validators = {};
    for (const name of Object.values(SCHEMA_BY_SUFFIX)) {
        validators[name] = ajv.getSchema(`contract#/components/schemas/${name}`);
        if (!validators[name]) throw new Error(`Schema ${name} not found`);
    }
    // Compile every component so unused ones are checked too.
    for (const name of Object.keys(document.components.schemas)) {
        ajv.getSchema(`contract#/components/schemas/${name}`);
    }
    return validators;
}

function schemaFor(path) {
    const suffix = Object.keys(SCHEMA_BY_SUFFIX).find(s => path.endsWith(s));
    return suffix ? SCHEMA_BY_SUFFIX[suffix] : undefined;
}

function pairProblems(requestPath) {
    const responsePath = requestPath.replace(/\.request\.json$/, '.response.json');
    let response;
    try {
        response = readJson(responsePath);
    } catch {
        return [];
    }
    const questions = readJson(requestPath).questions;
    const problems = [];
    const questionNames = Object.keys(questions).sort();
    const answerNames = Object.keys(response.answers).sort();
    if (questionNames.join() !== answerNames.join()) {
        problems.push(`answer names [${answerNames}] do not match question names [${questionNames}]`);
    }
    for (const name of questionNames) {
        const answer = response.answers[name];
        if (answer && answer.type !== questions[name].type) {
            problems.push(`answer '${name}' has type ${answer.type}, question has type ${questions[name].type}`);
        }
    }
    return problems;
}

const document = readJson(contractPath());
const validators = createValidators(document);
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
    const valid = validate(readJson(path));
    const mustFail = path.startsWith(invalidDir);
    checked++;

    if (mustFail && valid) {
        failures.push(`${name}: expected to fail ${schema}, but it passed`);
    } else if (!mustFail && !valid) {
        failures.push(`${name}: fails ${schema}\n${JSON.stringify(validate.errors, null, 2)}`);
    } else if (!mustFail && schema === 'SystemOneRequest') {
        failures.push(...pairProblems(path).map(problem => `${name}: ${problem}`));
    }
}

if (checked === 0) failures.push('No examples found');

if (failures.length > 0) {
    console.error(failures.join('\n'));
    process.exit(1);
}
console.log(`Validated ${checked} examples against ${relative(root, contractPath())}`);
