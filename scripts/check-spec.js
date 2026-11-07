// Checks that SPEC.md and the OpenAPI contract agree: the draft, and the release it is identical
// to when it names one.
//
// - The question types table (header starting with "Type") lists exactly the question and
//   answer types of SystemOneQuestion and SystemOneAnswer (including nested unions such as
//   SystemOneCoreQuestion), with their schema names and
//   their required and optional settings.
// - A table whose first header cell is a schema name, such as `SystemOneRequest`, lists
//   exactly that schema's properties, with "yes" in its Required column for required ones.
// - Every core type is named in the answer guarantees section.
// - Every schema name SPEC.md mentions exists in components.schemas.

import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { contractPaths } from './contract.js';

const root = join(import.meta.dirname, '..');
const specPath = join(root, 'SPEC.md');
const EXTENSION_TYPE = 'owner:type';

const spec = readFileSync(specPath, 'utf8');
// The contract being checked; set for each contract before calling checkSpec.
let schemas;
let failures;

function codes(text) {
    return [...text.matchAll(/`([^`]+)`/g)].map(match => match[1]);
}

function sameSet(a, b) {
    return a.length === b.length && [...a].sort().join() === [...b].sort().join();
}

function schemaName(ref) {
    return ref.replace('#/components/schemas/', '');
}

function cells(line) {
    return line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
}

function tables(markdown) {
    const result = [];
    const lines = markdown.split('\n');
    for (let i = 0; i < lines.length - 1; i++) {
        if (!lines[i].startsWith('|') || !/^\|[\s|:-]+\|$/.test(lines[i + 1].trim())) continue;
        const rows = [];
        let j = i + 2;
        while (j < lines.length && lines[j].startsWith('|')) rows.push(cells(lines[j++]));
        result.push({ header: cells(lines[i]), rows });
        i = j - 1;
    }
    return result;
}

function section(markdown, heading) {
    const start = markdown.indexOf(`\n## ${heading}\n`);
    if (start === -1) return '';
    const end = markdown.indexOf('\n## ', start + 1);
    return markdown.slice(start, end === -1 ? undefined : end);
}

// Maps each union member's type name (owner:type for extensions) to its schema name,
// descending into members that are unions themselves.
function typesOf(unionName) {
    return new Map(
        schemas[unionName].oneOf.flatMap(({ $ref }) => {
            const name = schemaName($ref);
            if (schemas[name].oneOf) return [...typesOf(name)];
            const type = schemas[name].properties.type;
            return [[type.const ?? (type.$ref && EXTENSION_TYPE), name]];
        }),
    );
}

function settingsOf(name) {
    const schema = schemas[name];
    const settings = Object.keys(schema.properties).filter(key => key !== 'type');
    const required = settings.filter(key => schema.required?.includes(key));
    return { required, optional: settings.filter(key => !required.includes(key)) };
}

function checkTypesTable(table) {
    const questions = typesOf('SystemOneQuestion');
    const answers = typesOf('SystemOneAnswer');
    const column = label => table.header.indexOf(label);
    const listed = table.rows.map(row => codes(row[0])[0]);

    if (!sameSet(listed, [...questions.keys()])) {
        failures.push(`types table lists [${listed}], SystemOneQuestion has [${[...questions.keys()]}]`);
    }
    if (!sameSet(listed, [...answers.keys()])) {
        failures.push(`types table lists [${listed}], SystemOneAnswer has [${[...answers.keys()]}]`);
    }
    for (const row of table.rows) {
        const type = codes(row[0])[0];
        const question = codes(row[column('Question')])[0];
        const answer = codes(row[column('Answer')])[0];
        if (questions.has(type) && questions.get(type) !== question) {
            failures.push(`type ${type}: question schema is ${questions.get(type)}, SPEC.md says ${question}`);
        }
        if (answers.has(type) && answers.get(type) !== answer) {
            failures.push(`type ${type}: answer schema is ${answers.get(type)}, SPEC.md says ${answer}`);
        }
        if (!schemas[question]) continue;
        const { required, optional } = settingsOf(question);
        const specRequired = codes(row[column('Required settings')]);
        const specOptional = codes(row[column('Optional settings')]);
        if (!sameSet(specRequired, required)) {
            failures.push(`type ${type}: required settings are [${required}], SPEC.md says [${specRequired}]`);
        }
        if (!sameSet(specOptional, optional)) {
            failures.push(`type ${type}: optional settings are [${optional}], SPEC.md says [${specOptional}]`);
        }
    }
    return listed;
}

function checkFieldsTable(table, name) {
    const schema = schemas[name];
    const required = table.header.indexOf('Required');
    const listed = table.rows.map(row => codes(row[0])[0]);
    const properties = Object.keys(schema.properties);
    if (!sameSet(listed, properties)) {
        failures.push(`${name} table lists [${listed}], the schema has [${properties}]`);
    }
    if (required === -1) return;
    for (const row of table.rows) {
        const field = codes(row[0])[0];
        const specRequired = row[required] === 'yes';
        if (specRequired !== Boolean(schema.required?.includes(field))) {
            failures.push(`${name}.${field}: SPEC.md says required is ${specRequired}, the schema disagrees`);
        }
    }
}

// Checks SPEC.md against the schemas set for the current contract, adding to failures.
function checkSpec() {
    let typesTable;
    for (const table of tables(spec)) {
        if (table.header[0] === 'Type') {
            typesTable = table;
            continue;
        }
        const name = codes(table.header[0])[0];
        if (!name) continue;
        if (!schemas[name]) failures.push(`table for unknown schema ${name}`);
        else checkFieldsTable(table, name);
    }

    if (!typesTable) {
        failures.push('SPEC.md has no question types table');
    } else {
        const guarantees = codes(section(spec, 'Answer guarantees'));
        for (const type of checkTypesTable(typesTable)) {
            if (type !== EXTENSION_TYPE && !guarantees.includes(type)) {
                failures.push(`type ${type} has no answer guarantee`);
            }
        }
    }

    for (const name of new Set(codes(spec).filter(code => /^[A-Z][A-Za-z]+$/.test(code)))) {
        if (!schemas[name]) failures.push(`SPEC.md mentions ${name}, which is not a schema`);
    }
}

let failed = false;
for (const contract of contractPaths(root)) {
    schemas = JSON.parse(readFileSync(contract, 'utf8')).components.schemas;
    failures = [];
    checkSpec();
    const name = relative(root, contract);
    if (failures.length > 0) {
        console.error(failures.map(failure => `SPEC.md (${name}): ${failure}`).join('\n'));
        failed = true;
    } else {
        console.log(`SPEC.md agrees with ${name}`);
    }
}
if (failed) process.exit(1);
