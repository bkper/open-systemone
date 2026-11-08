// Renders OpenAPI schemas as short HTML type labels for the reference page.

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

function escape(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function code(text: string): string {
    return `<code>${escape(text)}</code>`;
}

/** A schema's type as HTML: referenced schemas link to their section on the page. */
export function typeLabel(schema: SchemaOrBoolean | undefined): string {
    if (schema === undefined || schema === true) return code('any');
    if (schema === false) return code('never');
    if (schema.$ref) {
        const name = schema.$ref.replace('#/components/schemas/', '');
        return `<a href="#${escape(name)}">${escape(name)}</a>`;
    }
    if (schema.const !== undefined) return code(JSON.stringify(schema.const));
    if (schema.enum) return schema.enum.map(value => code(JSON.stringify(value))).join(' | ');
    const union = schema.oneOf ?? schema.anyOf;
    if (union) return union.map(typeLabel).join(' | ');
    if (schema.allOf) return schema.allOf.map(typeLabel).join(' &amp; ');
    if (schema.type === 'array') return `array of ${typeLabel(schema.items)}`;
    if (schema.type === 'object' && typeof schema.additionalProperties === 'object') {
        return `map of ${typeLabel(schema.additionalProperties)}`;
    }
    const types = Array.isArray(schema.type) ? schema.type : [schema.type ?? 'any'];
    return types.map(code).join(' | ');
}
