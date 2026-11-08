import type { APIRoute, GetStaticPaths } from 'astro';

// The OpenAPI files, served as they are in the repository: clients that vendor a release
// with a checksum must get the same bytes.
const contracts = import.meta.glob<string>('../../../../openapi/*.json', {
    query: '?raw',
    import: 'default',
    eager: true,
});

export const getStaticPaths = (() => Object.entries(contracts).map(([path, body]) => ({
    params: { file: path.split('/').at(-1) },
    props: { body },
}))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
    new Response(String(props.body), { headers: { 'Content-Type': 'application/json' } });
