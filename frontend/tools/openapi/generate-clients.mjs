import { readFile, writeFile } from 'node:fs/promises';
const schema = JSON.parse(
  await readFile(new URL('../../../backend/openapi/openapi.json', import.meta.url), 'utf8'),
);
const names = [
  'ClientCardWrite',
  'ClientCardResponse',
  'ClientCardPage',
  'JoinTokenRequest',
  'JoinPreview',
  'IssuedJoinInvitation',
  'ClientProgramSummary',
  'TrainerClientSummary',
];
function type(s) {
  if (s.$ref) return s.$ref.split('/').at(-1);
  if (s.anyOf) return s.anyOf.map(type).join(' | ');
  if (s.enum) return s.enum.map((v) => JSON.stringify(v)).join(' | ');
  if (s.type === 'array') return `Array<${type(s.items)}>`;
  if (s.type === 'object')
    return `Record<string, ${typeof s.additionalProperties === 'object' ? type(s.additionalProperties) : 'unknown'}>`;
  return (
    { string: 'string', integer: 'number', number: 'number', boolean: 'boolean', null: 'null' }[
      s.type
    ] ?? 'unknown'
  );
}
let output = '// Generated from backend OpenAPI. Do not edit.\n';
for (const name of names) {
  const s = schema.components.schemas[name];
  if (!s) throw new Error(`Missing schema ${name}`);
  output +=
    `export interface ${name} {\n` +
    Object.entries(s.properties)
      .map(([key, value]) => `  ${key}${s.required?.includes(key) ? '' : '?'}: ${type(value)};`)
      .join('\n') +
    '\n}\n';
}
const operations = {};
const paths = {
  list: ['get', '/clients/cards'],
  create: ['post', '/clients/cards'],
  update: ['patch', '/clients/cards/{card_id}'],
  invite: ['post', '/clients/cards/{card_id}/invite'],
  email: ['post', '/clients/cards/{card_id}/invite/email'],
  cancel: ['post', '/clients/cards/{card_id}/invite/cancel'],
  preview: ['post', '/clients/join/preview'],
  accept: ['post', '/clients/join/accept'],
  terminate: ['post', '/clients/relationships/{relationship_id}/terminate'],
  summary: ['get', '/clients/{client_id}/training-summary'],
};
for (const [name, [method, path]] of Object.entries(paths)) {
  const operation = schema.paths['/api/v1' + path]?.[method];
  if (!operation) throw new Error(`Missing client operation ${method} ${path}`);
  operations[name] = { method: method.toUpperCase(), path, operationId: operation.operationId };
}
output += `export const CLIENTS_OPERATIONS = ${JSON.stringify(operations, null, 2)} as const;\n`;
await writeFile(
  new URL('../../libs/shared/contracts/src/generated/clients.ts', import.meta.url),
  output,
);
