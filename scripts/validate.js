// Validates every example in examples/ against the OpenAPI contract.
//
// The file suffix selects the schema: *.request.json, *.response.json, *.error.json.
// Files under examples/invalid/ must fail validation; all others must pass.
// A response is checked against its request: the request with the same name up to the
// first dot, in the response's directory or in examples/. The checks cover rules JSON
// Schema cannot express: matching question names and types, choice in criteria, null
// threshold, span text, list spans, estimate bounds and grid, and forecast horizon.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
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

const VALUE_TYPES = new Set(['text', 'number', 'date', 'time', 'datetime', 'duration']);
const DEFAULT_NULL_THRESHOLD = 0.5;

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

function requestFor(responsePath) {
    const name = `${basename(responsePath).split('.')[0]}.request.json`;
    const path = [dirname(responsePath), examplesDir].map(dir => join(dir, name)).find(existsSync);
    return path ? readJson(path) : undefined;
}

function spanProblems([start, end], expected, text) {
    if (text === undefined) return ['a span needs a string state or a state_text'];
    const chars = Array.from(text);
    if (start > end || end > chars.length) return [`span [${start}, ${end}] is outside the text`];
    const covered = chars.slice(start, end).join('');
    if (expected === undefined || covered === expected) return [];
    return [`span [${start}, ${end}] covers '${covered}', expected '${expected}'`];
}

function onGrid(value, min, step) {
    const steps = (value - min) / step;
    return Math.abs(steps - Math.round(steps)) < 1e-9;
}

function distributionProblems({ min, max, step }, distribution) {
    const problems = [];
    const { value, median, p10, p90, quantiles = [] } = distribution;
    for (const v of [value, median, p10, p90, ...quantiles]) {
        if (typeof v !== typeof min || v < min || v > max) problems.push(`${v} is outside [${min}, ${max}]`);
    }
    if (typeof step === 'number' && typeof min === 'number') {
        for (const v of [value, median, p10, p90]) {
            if (!onGrid(v, min, step)) problems.push(`${v} is not on the grid ${min} + k * ${step}`);
        }
    }
    if (!(p10 <= median && median <= p90)) problems.push('expected p10 <= median <= p90');
    return problems;
}

function answerProblems(question, answer, text) {
    const problems = [];
    if (answer.type === 'choice' && !Object.hasOwn(question.criteria, answer.choice)) {
        problems.push(`choice '${answer.choice}' is not in the question's criteria`);
    }
    if (VALUE_TYPES.has(answer.type)) {
        const threshold = question.null_threshold ?? DEFAULT_NULL_THRESHOLD;
        if ((answer.value === null) !== answer.p_null > threshold) {
            problems.push(`value must be null exactly when p_null ${answer.p_null} is above ${threshold}`);
        }
        if (answer.span) {
            problems.push(...spanProblems(answer.span, answer.type === 'text' ? answer.guess : undefined, text));
        }
    }
    if (answer.type === 'list') {
        const textItems = question.items === 'text';
        if (textItems && !answer.spans) problems.push('text items need spans');
        if (answer.spans && answer.spans.length !== answer.value.length) {
            problems.push(`${answer.spans.length} spans for ${answer.value.length} items`);
        }
        (answer.spans ?? []).forEach((span, i) => {
            problems.push(...spanProblems(span, textItems ? answer.value[i] : undefined, text));
        });
    }
    if (answer.type === 'estimate') problems.push(...distributionProblems(question, answer));
    if (answer.type === 'forecast') {
        if (answer.steps.length !== question.horizon) {
            problems.push(`${answer.steps.length} steps, expected horizon ${question.horizon}`);
        }
        for (const step of answer.steps) problems.push(...distributionProblems(question, step));
    }
    return problems;
}

function pairProblems(request, response) {
    const { questions } = request;
    const problems = [];
    const questionNames = Object.keys(questions).sort();
    const answerNames = Object.keys(response.answers).sort();
    if (questionNames.join() !== answerNames.join()) {
        problems.push(`answer names [${answerNames}] do not match question names [${questionNames}]`);
    }
    const text = response.state_text ?? (typeof request.state === 'string' ? request.state : undefined);
    for (const [name, answer] of Object.entries(response.answers)) {
        const question = questions[name];
        if (!question) continue;
        if (answer.type !== question.type) {
            problems.push(`answer '${name}' has type ${answer.type}, question has type ${question.type}`);
            continue;
        }
        problems.push(...answerProblems(question, answer, text).map(problem => `answer '${name}': ${problem}`));
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

if (failures.length > 0) {
    console.error(failures.join('\n'));
    process.exit(1);
}
console.log(`Validated ${checked} examples against ${relative(root, contractPath())}`);
