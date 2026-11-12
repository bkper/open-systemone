// Runs the conformance suite against a live Open System One endpoint:
//
//   bun run conformance --url <endpoint> --model <model> [--header "Name: value"]... [--contract <file>]
//
// Every valid request in examples/ is sent with the given model. It passes when the answers meet
// the contract and the answer guarantees, or when the endpoint rejects it with a standard error
// that names a field of the request: an implementer need not support every type, and a model
// may refuse. Rules tests
// then check what every implementer must do: reject unknown question types and unreadable
// assets, accept compressed bodies, reject unknown encodings, and accept multipart assets.
// Refusals cannot be triggered on purpose, so the suite does not test them.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import { createValidators, pairProblems } from './checks.js';
import { releaseFiles } from './contract.js';

const root = join(import.meta.dirname, '..');
const examplesDir = join(root, 'examples');
const STANDARD_CODES = new Set(['unsupported_question_type', 'unsupported_parameter']);
const IMAGE_MEDIA_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };
const TIMEOUT_MS = 120_000;

const { values: args } = parseArgs({
    options: {
        url: { type: 'string' },
        model: { type: 'string' },
        header: { type: 'string', multiple: true, default: [] },
        contract: { type: 'string' },
    },
});
if (!args.url || !args.model) {
    console.error('Usage: bun run conformance --url <endpoint> --model <model> [--header "Name: value"]... [--contract <file>]');
    process.exit(2);
}

const contract = args.contract ?? join(root, 'openapi', releaseFiles(root).at(-1));
const validators = createValidators(JSON.parse(readFileSync(contract, 'utf8')), [
    'SystemOneResponse',
    'SystemOneErrorResponse',
]);
const headers = Object.fromEntries(
    args.header.map(header => {
        const colon = header.indexOf(':');
        if (colon < 1) throw new Error(`Header must be "Name: value": ${header}`);
        return [header.slice(0, colon).trim(), header.slice(colon + 1).trim()];
    })
);

async function send(body, extraHeaders = {}) {
    const response = await fetch(args.url, {
        method: 'POST',
        headers: { 'User-Agent': 'open-systemone-conformance/1', ...headers, ...extraHeaders },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = await response.text();
    let json;
    try {
        json = JSON.parse(text);
    } catch {
        json = undefined;
    }
    return { status: response.status, json, text };
}

function sendJson(request, extraHeaders = {}) {
    return send(JSON.stringify(request), { 'Content-Type': 'application/json', ...extraHeaders });
}

function schemaProblems(name, value) {
    const validate = validators[name];
    return validate(value) ? [] : [`fails ${name}: ${validate.errors.map(e => `${e.instancePath} ${e.message}`).join('; ')}`];
}

// Whether a standard error's param names a field of the request, as the specification requires.
function namesRequestField(request, code, param) {
    if (typeof param !== 'string') return false;
    for (const [name, question] of Object.entries(request.questions)) {
        const prefix = `questions.${name}.`;
        if (!param.startsWith(prefix)) continue;
        const setting = param.slice(prefix.length);
        return code === 'unsupported_question_type' ? setting === 'type' : setting !== 'type' && Object.hasOwn(question, setting);
    }
    if (code !== 'unsupported_parameter') return false;
    for (const [placeholder, asset] of Object.entries(request.assets ?? {})) {
        const prefix = `assets.${placeholder}`;
        if (param === prefix) return true;
        if (param.startsWith(`${prefix}.`)) return Object.hasOwn(asset, param.slice(prefix.length + 1));
    }
    return !param.includes('.') && Object.hasOwn(request, param);
}

// Problems with a response to a request: valid answers, or a standard error naming a request field.
function outcome(request, response) {
    if (response.status === 200) {
        const problems = schemaProblems('SystemOneResponse', response.json);
        if (problems.length === 0) problems.push(...pairProblems(request, response.json));
        return { answered: problems.length === 0, problems, detail: 'answered' };
    }
    const error = response.json?.error;
    if (response.status === 400 && STANDARD_CODES.has(error?.code)) {
        const problems = schemaProblems('SystemOneErrorResponse', response.json);
        if (!namesRequestField(request, error.code, error.param)) {
            problems.push(`param ${JSON.stringify(error.param)} does not name a field of the request`);
        }
        return { answered: false, problems, detail: `rejected with ${error.code} at ${error.param}` };
    }
    if (response.status === 422 && error?.code === 'refused') {
        const problems = schemaProblems('SystemOneErrorResponse', response.json);
        const name = typeof error.param === 'string' ? error.param.replace(/^questions\./, '') : null;
        if (name !== null && (!error.param.startsWith('questions.') || !Object.hasOwn(request.questions, name))) {
            problems.push(`param ${JSON.stringify(error.param)} names no question of the request`);
        }
        return { answered: false, problems, detail: `refused${name ? ` at ${error.param}` : ''}` };
    }
    const reason = error ? `${error.code}: ${error.message}` : response.text.slice(0, 200);
    return { answered: false, problems: [`HTTP ${response.status}, ${reason}`], detail: '' };
}

function decodes(base64) {
    return /^[A-Za-z0-9+/]*={0,2}$/.test(base64) && base64.length % 4 === 0;
}

const results = [];
function record(status, name, detail) {
    results.push(status);
    console.log(`${status.padEnd(4)} ${name}${detail ? `: ${detail}` : ''}`);
}

async function test(name, run) {
    try {
        const problems = await run();
        if (typeof problems === 'string') record('SKIP', name, problems);
        else if (problems.length === 0) record('PASS', name);
        else record('FAIL', name, problems.join('; '));
    } catch (error) {
        record('FAIL', name, error instanceof Error ? error.message : String(error));
    }
}

console.log(`Open System One conformance: ${args.url}, model ${args.model}, contract ${relative(root, contract)}\n`);

// Examples: every valid request in examples/, with the given model.
const answered = [];
const examples = readdirSync(examplesDir).filter(file => file.endsWith('.request.json')).sort();
for (const file of examples) {
    const name = `examples/${file}`;
    const request = { ...JSON.parse(readFileSync(join(examplesDir, file), 'utf8')), model: args.model };
    if (Object.values(request.assets ?? {}).some(asset => !decodes(asset.data_base64 ?? ''))) {
        record('SKIP', name, 'its asset data is shortened');
        continue;
    }
    try {
        const result = outcome(request, await sendJson(request));
        if (result.answered) answered.push(request);
        if (result.problems.length === 0) record('PASS', name, result.detail);
        else record('FAIL', name, result.problems.join('; '));
    } catch (error) {
        record('FAIL', name, error instanceof Error ? error.message : String(error));
    }
}
console.log();

// Rules: built on the smallest answered example, so only the rule under test can fail.
const base = answered.toSorted((a, b) => JSON.stringify(a).length - JSON.stringify(b).length).find(r => !r.assets);
const noBase = 'the endpoint answered no example without assets';

async function answersLikeBase(response) {
    const result = outcome(base, response);
    return result.answered ? [] : result.problems.length > 0 ? result.problems : [result.detail];
}

await test('rejects an unknown extension type', async () => {
    if (!base) return noBase;
    const request = { ...base, questions: { ...base.questions, conformance_unknown: { type: 'conformance:unknown' } } };
    const response = await sendJson(request);
    const error = response.json?.error;
    const expected = 'questions.conformance_unknown.type';
    if (response.status === 400 && error?.code === 'unsupported_question_type' && error.param === expected) return [];
    return [`expected 400 unsupported_question_type at ${expected}, got HTTP ${response.status} ${error?.code} at ${error?.param}`];
});

await test('rejects a file asset it cannot read', async () => {
    if (!base) return noBase;
    const asset = { type: 'file', media_type: 'application/x-open-systemone-conformance', data_base64: 'AAAA' };
    const request = { ...base, assets: { 'conformance-asset': asset } };
    const response = await sendJson(request);
    const error = response.json?.error;
    const params = ['assets.conformance-asset.media_type', 'assets.conformance-asset.type'];
    if (response.status === 400 && error?.code === 'unsupported_parameter' && params.includes(error.param)) return [];
    return [`expected 400 unsupported_parameter at ${params.join(' or ')}, got HTTP ${response.status} ${error?.code} at ${error?.param}`];
});

for (const [encoding, compress] of [
    ['gzip', Bun.gzipSync],
    ['x-gzip', Bun.gzipSync],
    ['zstd', Bun.zstdCompressSync],
]) {
    await test(`accepts a ${encoding} body`, async () => {
        if (!base) return noBase;
        const body = compress(new TextEncoder().encode(JSON.stringify(base)));
        return answersLikeBase(await send(body, { 'Content-Type': 'application/json', 'Content-Encoding': encoding }));
    });
}

for (const [name, encoding, body] of [
    ['rejects an unknown Content-Encoding with 415', 'x-open-systemone-conformance', () => JSON.stringify(base)],
    ['rejects two encoding layers with 415', 'gzip, gzip', () => Bun.gzipSync(Bun.gzipSync(new TextEncoder().encode(JSON.stringify(base))))],
    ['rejects a body that does not decompress with 400', 'gzip', () => JSON.stringify(base)],
]) {
    const expected = name.endsWith('415') ? 415 : 400;
    await test(name, async () => {
        if (!base) return noBase;
        const response = await send(body(), { 'Content-Type': 'application/json', 'Content-Encoding': encoding });
        return response.status === expected ? [] : [`expected HTTP ${expected}, got ${response.status}`];
    });
}

await test('rejects a model it does not serve', async () => {
    if (!base) return noBase;
    const response = await sendJson({ ...base, model: 'open-systemone-conformance-unknown-model' });
    return response.status >= 400 && response.status < 500 ? [] : [`expected a 4xx error, got HTTP ${response.status}`];
});

await test('rejects a request without a model', async () => {
    if (!base) return noBase;
    const { model: _model, ...request } = base;
    const response = await sendJson(request);
    return response.status >= 400 && response.status < 500 ? [] : [`expected a 4xx error, got HTTP ${response.status}`];
});

await test('accepts assets as multipart', async () => {
    const withAssets = answered.find(request => request.assets);
    if (!withAssets) return 'the endpoint answered no example with assets';
    const form = new FormData();
    const assets = {};
    const files = [];
    Object.entries(withAssets.assets).forEach(([placeholder, { data_base64, ...asset }], i) => {
        const part = `asset-${i}`;
        assets[placeholder] = { ...asset, part };
        const type = asset.type === 'file' ? asset.media_type : IMAGE_MEDIA_TYPES[asset.format];
        files.push([part, new File([Buffer.from(data_base64, 'base64')], part, { type })]);
    });
    const request = { ...withAssets, assets };
    form.append('request', new Blob([JSON.stringify(request)], { type: 'application/json' }));
    for (const [part, file] of files) form.append(part, file);
    const result = outcome(request, await send(form));
    return result.answered ? [] : result.problems.length > 0 ? result.problems : [result.detail];
});

record('SKIP', 'returns refused when the model refuses', 'a refusal cannot be triggered on purpose');

const count = status => results.filter(result => result === status).length;
console.log(`\n${count('PASS')} passed, ${count('FAIL')} failed, ${count('SKIP')} skipped`);
if (count('FAIL') > 0) process.exit(1);
