// Checks shared by validate.js and conformance.js: the contract's JSON Schemas, and the rules
// JSON Schema cannot express, which compare a response with its request.

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const VALUE_TYPES = new Set(['text', 'number', 'date', 'time', 'datetime', 'duration']);
const DEFAULT_NULL_THRESHOLD = 0.5;

export function createValidators(document, names) {
    // strictRequired is off because a conditional `then` requires properties declared by its parent schema.
    const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
    addFormats(ajv);
    // OpenAPI annotation: oneOf plus a const type already selects the branch.
    ajv.addKeyword('discriminator');
    // Lets refs like #/components/schemas/X resolve inside the wrapper schema.
    ajv.addKeyword('components');
    ajv.addSchema({ $id: 'contract', components: document.components });

    const validators = {};
    for (const name of names) {
        validators[name] = ajv.getSchema(`contract#/components/schemas/${name}`);
        if (!validators[name]) throw new Error(`Schema ${name} not found`);
    }
    // Compile every component so unused ones are checked too.
    for (const name of Object.keys(document.components.schemas)) {
        ajv.getSchema(`contract#/components/schemas/${name}`);
    }
    return validators;
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
    const { value, median, p10, p90, mean, quantiles = [] } = distribution;
    for (const v of [value, median, p10, p90, ...quantiles]) {
        if (typeof v !== typeof min || v < min || v > max) problems.push(`${v} is outside [${min}, ${max}]`);
    }
    if (mean !== undefined && typeof mean !== typeof min) problems.push(`mean ${mean} is not of the same kind as min`);
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
            if (span) problems.push(...spanProblems(span, textItems ? answer.value[i] : undefined, text));
        });
    }
    if (answer.type === 'estimate') {
        problems.push(...distributionProblems(question, answer));
        if (Boolean(answer.quantiles) !== (question.quantiles === true)) {
            problems.push('quantiles must be present exactly when the question sets quantiles to true');
        }
    }
    if (answer.type === 'forecast') {
        if (answer.steps.length !== question.horizon) {
            problems.push(`${answer.steps.length} steps, expected horizon ${question.horizon}`);
        }
        for (const step of answer.steps) {
            problems.push(...distributionProblems(question, step));
            if (step.quantiles !== undefined) problems.push('forecast steps have no quantiles');
        }
    }
    return problems;
}

export function pairProblems(request, response) {
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
