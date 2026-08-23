import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const toolDirectory = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(toolDirectory, '../..');
const defaultSchemaPath = resolve(frontendRoot, '../backend/openapi/openapi.json');
const requestedSchemaPath = process.argv[2];
const schemaPath = requestedSchemaPath
  ? resolve(process.cwd(), requestedSchemaPath)
  : defaultSchemaPath;
const generatedDirectory = resolve(frontendRoot, 'libs/shared/contracts/src/generated');
const outputPath = resolve(generatedDirectory, 'workout-executions.ts');

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function refName(ref) {
  const prefix = '#/components/schemas/';
  if (typeof ref !== 'string' || !ref.startsWith(prefix)) {
    throw new Error(`Unsupported OpenAPI reference: ${String(ref)}`);
  }
  return ref.slice(prefix.length);
}

function findOperation(document, operationId) {
  for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
    if (!isRecord(pathItem)) continue;
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!isRecord(operation)) continue;
      if (operation.operationId === operationId) {
        return { method: method.toUpperCase(), path, operation };
      }
    }
  }
  throw new Error(`OpenAPI operation not found: ${operationId}`);
}

function assertResponseRef(operation, statusCode, schemaName) {
  const response = operation.responses?.[statusCode];
  const ref = response?.content?.['application/json']?.schema?.$ref;
  if (refName(ref) !== schemaName) {
    throw new Error(`Unexpected response schema for ${operation.operationId} ${statusCode}`);
  }
}

function assertNoRequestBody(operation) {
  if ('requestBody' in operation) {
    throw new Error(`Execution operation must not have request body: ${operation.operationId}`);
  }
}

function relativeAssignmentPath(path) {
  const apiPrefix = '/api/v1';
  if (!path.startsWith(`${apiPrefix}/`)) {
    throw new Error(`Execution path is outside the configured API prefix: ${path}`);
  }
  return path.slice(apiPrefix.length);
}

function renderSchemaType(schema) {
  if (!isRecord(schema)) return 'unknown';
  if ('$ref' in schema) return refName(schema.$ref);
  if (Array.isArray(schema.anyOf)) {
    return schema.anyOf.map((item) => renderSchemaType(item)).join(' | ');
  }
  if (Array.isArray(schema.enum)) {
    return schema.enum.map((value) => JSON.stringify(value)).join(' | ');
  }
  switch (schema.type) {
    case 'string':
      return 'string';
    case 'integer':
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'null':
      return 'null';
    case 'array':
      return `Array<${renderSchemaType(schema.items)}>`;
    case 'object':
      return 'Record<string, unknown>';
    default:
      return 'unknown';
  }
}

function renderSchemaDeclaration(name, schema) {
  if (!isRecord(schema) || schema.type !== 'object' || !isRecord(schema.properties)) {
    throw new Error(`Missing object OpenAPI schema: ${name}`);
  }
  const required = new Set(Array.isArray(schema.required) ? schema.required : []);
  const properties = Object.entries(schema.properties).map(([propertyName, propertySchema]) => {
    const optional = required.has(propertyName) ? '' : '?';
    return `  ${propertyName}${optional}: ${renderSchemaType(propertySchema)};`;
  });
  return [`export interface ${name} {`, ...properties, '}'].join('\n');
}

let source;
try {
  source = await readFile(schemaPath, 'utf8');
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  throw new Error(`Cannot read OpenAPI schema at ${schemaPath}. ${reason}`);
}

const document = JSON.parse(source);
if (!isRecord(document) || !isRecord(document.paths) || !isRecord(document.components?.schemas)) {
  throw new Error('The input is not a valid OpenAPI document with paths and schemas.');
}

const startOperation = findOperation(document, 'startWorkoutExecution');
const getOperation = findOperation(document, 'getWorkoutExecution');
const completeOperation = findOperation(document, 'completeWorkoutExecution');

for (const { operation } of [startOperation, getOperation, completeOperation]) {
  assertResponseRef(operation, '200', 'WorkoutExecutionResponse');
  assertResponseRef(operation, '403', 'BusinessErrorResponse');
  assertResponseRef(operation, '404', 'BusinessErrorResponse');
}
assertResponseRef(startOperation.operation, '409', 'BusinessErrorResponse');
assertResponseRef(completeOperation.operation, '409', 'BusinessErrorResponse');
assertNoRequestBody(startOperation.operation);
assertNoRequestBody(completeOperation.operation);

const responseSchema = document.components.schemas.WorkoutExecutionResponse;
if (
  !isRecord(responseSchema) ||
  !isRecord(responseSchema.properties?.status) ||
  JSON.stringify(responseSchema.properties.status.enum) !== JSON.stringify(['IN_PROGRESS', 'COMPLETED'])
) {
  throw new Error('Unexpected WorkoutExecutionResponse status contract.');
}

const operations = {
  start: {
    method: startOperation.method,
    path: startOperation.path,
    relativePath: relativeAssignmentPath(startOperation.path),
    operationId: 'startWorkoutExecution',
    successStatus: 200,
  },
  get: {
    method: getOperation.method,
    path: getOperation.path,
    relativePath: relativeAssignmentPath(getOperation.path),
    operationId: 'getWorkoutExecution',
    successStatus: 200,
  },
  complete: {
    method: completeOperation.method,
    path: completeOperation.path,
    relativePath: relativeAssignmentPath(completeOperation.path),
    operationId: 'completeWorkoutExecution',
    successStatus: 200,
  },
};

const generated = [
  '/** This file is generated by tools/openapi/generate-executions.mjs. Do not edit manually. */',
  `export const WORKOUT_EXECUTION_OPERATIONS = ${JSON.stringify(operations, null, 2)} as const;`,
  '',
  renderSchemaDeclaration('WorkoutExecutionResponse', responseSchema),
  '',
].join('\n\n');

await mkdir(generatedDirectory, { recursive: true });
await writeFile(outputPath, generated, 'utf8');
console.info(`Generated workout execution contract: ${outputPath}`);
