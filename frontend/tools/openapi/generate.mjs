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
const snapshotOutputPath = resolve(generatedDirectory, 'openapi-schema.ts');
const assignmentOutputPath = resolve(generatedDirectory, 'workout-assignments.ts');

const ASSIGNMENT_SCHEMA_NAMES = [
  'BusinessErrorDetail',
  'BusinessErrorResponse',
  'CreateWorkoutAssignmentRequest',
  'RescheduleWorkoutAssignmentRequest',
  'WorkoutAssignmentResponse',
  'WorkoutSnapshotBlockV1',
  'WorkoutSnapshotExerciseV1',
  'WorkoutSnapshotV1',
];

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertOpenApiDocument(value) {
  if (
    !isRecord(value) ||
    typeof value.openapi !== 'string' ||
    value.openapi.length === 0 ||
    !isRecord(value.info) ||
    typeof value.info.title !== 'string' ||
    !isRecord(value.paths) ||
    !isRecord(value.components) ||
    !isRecord(value.components.schemas)
  ) {
    throw new Error('The input is not a valid OpenAPI JSON document.');
  }
}

function refName(ref) {
  const prefix = '#/components/schemas/';
  if (typeof ref !== 'string' || !ref.startsWith(prefix)) {
    throw new Error(`Unsupported OpenAPI reference: ${String(ref)}`);
  }
  return ref.slice(prefix.length);
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
  if (!isRecord(schema)) {
    throw new Error(`Missing OpenAPI schema: ${name}`);
  }

  if (schema.type !== 'object' || !isRecord(schema.properties)) {
    return `export type ${name} = ${renderSchemaType(schema)};`;
  }

  const required = new Set(Array.isArray(schema.required) ? schema.required : []);
  const properties = Object.entries(schema.properties).map(([propertyName, propertySchema]) => {
    const optional = required.has(propertyName) ? '' : '?';
    return `  ${propertyName}${optional}: ${renderSchemaType(propertySchema)};`;
  });

  return [`export interface ${name} {`, ...properties, '}'].join('\n');
}

function findOperation(document, operationId) {
  for (const [path, pathItem] of Object.entries(document.paths)) {
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

function assertRequestRef(operation, schemaName) {
  const ref = operation.requestBody?.content?.['application/json']?.schema?.$ref;
  if (refName(ref) !== schemaName) {
    throw new Error(`Unexpected request schema for ${operation.operationId}`);
  }
}

function relativeAssignmentPath(path) {
  const apiPrefix = '/api/v1';
  if (!path.startsWith(`${apiPrefix}/`)) {
    throw new Error(`Assignment path is outside the configured API prefix: ${path}`);
  }
  return path.slice(apiPrefix.length);
}

let source;
try {
  source = await readFile(schemaPath, 'utf8');
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  throw new Error(
    `Cannot read OpenAPI schema at ${schemaPath}. Export FastAPI OpenAPI first. ${reason}`,
  );
}

let document;
try {
  document = JSON.parse(source);
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  throw new Error(`OpenAPI schema is not valid JSON: ${reason}`);
}

assertOpenApiDocument(document);

const createOperation = findOperation(document, 'createWorkoutAssignment');
const rescheduleOperation = findOperation(document, 'rescheduleWorkoutAssignment');
const cancelOperation = findOperation(document, 'cancelWorkoutAssignment');

assertRequestRef(createOperation.operation, 'CreateWorkoutAssignmentRequest');
assertResponseRef(createOperation.operation, '201', 'WorkoutAssignmentResponse');
assertRequestRef(rescheduleOperation.operation, 'RescheduleWorkoutAssignmentRequest');
assertResponseRef(rescheduleOperation.operation, '200', 'WorkoutAssignmentResponse');
assertResponseRef(cancelOperation.operation, '200', 'WorkoutAssignmentResponse');
assertResponseRef(createOperation.operation, '409', 'BusinessErrorResponse');
assertResponseRef(rescheduleOperation.operation, '409', 'BusinessErrorResponse');
assertResponseRef(cancelOperation.operation, '409', 'BusinessErrorResponse');

const generatedSnapshot = [
  '/** This file is generated by tools/openapi/generate.mjs. Do not edit manually. */',
  `export const openApiDocument = ${JSON.stringify(document, null, 2)} as const;`,
  '',
  'export type OpenApiPath = keyof typeof openApiDocument.paths;',
  '',
].join('\n');

const assignmentOperations = {
  create: {
    method: createOperation.method,
    path: createOperation.path,
    relativePath: relativeAssignmentPath(createOperation.path),
    operationId: 'createWorkoutAssignment',
    successStatus: 201,
  },
  reschedule: {
    method: rescheduleOperation.method,
    path: rescheduleOperation.path,
    relativePath: relativeAssignmentPath(rescheduleOperation.path),
    operationId: 'rescheduleWorkoutAssignment',
    successStatus: 200,
  },
  cancel: {
    method: cancelOperation.method,
    path: cancelOperation.path,
    relativePath: relativeAssignmentPath(cancelOperation.path),
    operationId: 'cancelWorkoutAssignment',
    successStatus: 200,
  },
};

const assignmentSchemas = document.components.schemas;
const generatedAssignments = [
  '/** This file is generated by tools/openapi/generate.mjs. Do not edit manually. */',
  `export const WORKOUT_ASSIGNMENT_OPERATIONS = ${JSON.stringify(assignmentOperations, null, 2)} as const;`,
  '',
  ...ASSIGNMENT_SCHEMA_NAMES.map((name) => renderSchemaDeclaration(name, assignmentSchemas[name])),
  '',
].join('\n\n');

await mkdir(generatedDirectory, { recursive: true });
await writeFile(snapshotOutputPath, generatedSnapshot, 'utf8');
await writeFile(assignmentOutputPath, generatedAssignments, 'utf8');
console.info(`Generated OpenAPI contract snapshot: ${snapshotOutputPath}`);
console.info(`Generated workout assignment contract: ${assignmentOutputPath}`);
