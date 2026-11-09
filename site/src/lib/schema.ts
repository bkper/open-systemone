// Renders OpenAPI schemas for the reference page, as HTML and as Markdown.

export interface Schema {
    $ref?: string;
    type?: string | string[];
    title?: string;
    description?: string;
    const?: unknown;
    enum?: unknown[];
    oneOf?: SchemaOrBoolean[];
    anyOf?: SchemaOrBoolean[];
    allOf?: SchemaOrBoolean[];
    items?: SchemaOrBoolean;
    properties?: Record<string, Schema>;
    required?: string[];
    additionalProperties?: SchemaOrBoolean;
}

type SchemaOrBoolean = Schema | boolean;

export interface Contract {
    info: { version: string };
    components: { schemas: Record<string, Schema> };
}

interface Format {
    code(text: string): string;
    link(name: string): string;
    or: string;
    and: string;
}

function escape(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const HTML: Format = {
    code: text => `<code>${escape(text)}</code>`,
    link: name => `<a href="#${escape(name)}">${escape(name)}</a>`,
    or: ' | ',
    and: ' &amp; ',
};

// Markdown labels go in table cells, where a pipe would end the cell, so unions use "or".
const MARKDOWN: Format = {
    code: text => `\`${text.replace(/\|/g, '\\|')}\``,
    link: name => `[${name}](#${name.toLowerCase()})`,
    or: ' or ',
    and: ' and ',
};

function label(schema: SchemaOrBoolean | undefined, format: Format): string {
    if (schema === undefined || schema === true) return format.code('any');
    if (schema === false) return format.code('never');
    if (schema.$ref) return format.link(schema.$ref.replace('#/components/schemas/', ''));
    if (schema.const !== undefined) return format.code(JSON.stringify(schema.const));
    if (schema.enum) return schema.enum.map(value => format.code(JSON.stringify(value))).join(format.or);
    const union = schema.oneOf ?? schema.anyOf;
    if (union) return union.map(item => label(item, format)).join(format.or);
    if (schema.allOf) return schema.allOf.map(item => label(item, format)).join(format.and);
    if (schema.type === 'array') return `array of ${label(schema.items, format)}`;
    if (schema.type === 'object' && typeof schema.additionalProperties === 'object') {
        return `map of ${label(schema.additionalProperties, format)}`;
    }
    const types = Array.isArray(schema.type) ? schema.type : [schema.type ?? 'any'];
    return types.map(format.code).join(format.or);
}

/** A schema's type as HTML: referenced schemas link to their section on the page. */
export function typeLabel(schema: SchemaOrBoolean | undefined): string {
    return label(schema, HTML);
}

function cell(text: string): string {
    return text.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');
}

/** The reference page as Markdown: every schema of a release, with its properties as a table. */
export function referenceMarkdown(contract: Contract, siteUrl: string): string {
    const version = contract.info.version;
    const sections = Object.entries(contract.components.schemas).map(([name, schema]) => {
        const lines = [`### ${name}`, ''];
        if (schema.description) lines.push(schema.description, '');
        if (schema.properties) {
            lines.push('| Property | Type | Required | Description |', '| --- | --- | --- | --- |');
            for (const [property, value] of Object.entries(schema.properties)) {
                const required = schema.required?.includes(property) ? 'yes' : '';
                lines.push(`| \`${property}\` | ${label(value, MARKDOWN)} | ${required} | ${cell(value.description ?? '')} |`);
            }
        } else {
            lines.push(`Type: ${label(schema, MARKDOWN)}`);
        }
        return lines.join('\n');
    });
    return [
        '# Reference',
        '',
        `The schemas of the **${version}** release. Download it as [openapi/${version}.json](${siteUrl}/openapi/${version}.json), or see the [working draft](${siteUrl}/openapi/draft.json).`,
        '',
        ...sections.map(section => `${section}\n`),
    ].join('\n');
}
