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
const programOutputPath = resolve(generatedDirectory, 'programs.ts');

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

const PROGRAM_SCHEMA_NAMES = [
  'IssueProgramRequest',
  'ProgramAssignmentResponse',
  'ProgramCreate',
  'ProgramResponse',
  'ProgramSlotResponse',
  'ProgramSlotWrite',
  'RelationshipResponse',
  'RelationshipStatus',
  'WorkoutBlockResponse',
  'WorkoutExerciseResponse',
  'WorkoutResponse',
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

function assertArrayResponseRef(operation, statusCode, schemaName) {
  const response = operation.responses?.[statusCode];
  const schema = response?.content?.['application/json']?.schema;
  if (!isRecord(schema) || schema.type !== 'array' || refName(schema.items?.$ref) !== schemaName) {
    throw new Error(`Unexpected array response schema for ${operation.operationId} ${statusCode}`);
  }
}

function assertRequestRef(operation, schemaName) {
  const ref = operation.requestBody?.content?.['application/json']?.schema?.$ref;
  if (refName(ref) !== schemaName) {
    throw new Error(`Unexpected request schema for ${operation.operationId}`);
  }
}

function assertRequiredQueryParameter(operation, parameterName, format) {
  const parameter = operation.parameters?.find(
    (item) => item?.name === parameterName && item?.in === 'query',
  );
  if (
    !parameter ||
    parameter.required !== true ||
    !isRecord(parameter.schema) ||
    parameter.schema.type !== 'string' ||
    parameter.schema.format !== format
  ) {
    throw new Error(`Unexpected query parameter ${parameterName} for ${operation.operationId}`);
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

const listOperation = findOperation(document, 'listClientWorkoutAssignmentsByDate');
const getOperation = findOperation(document, 'getWorkoutAssignment');
const createOperation = findOperation(document, 'createWorkoutAssignment');
const rescheduleOperation = findOperation(document, 'rescheduleWorkoutAssignment');
const cancelOperation = findOperation(document, 'cancelWorkoutAssignment');
const listProgramsOperation = findOperation(document, 'list_programs_api_v1_programs_get');
const createProgramOperation = findOperation(document, 'create_program_api_v1_programs_post');
const replaceProgramOperation = findOperation(
  document,
  'replace_program_api_v1_programs__program_id__put',
);
const issueProgramOperation = findOperation(
  document,
  'issue_program_api_v1_programs__program_id__assignments_post',
);
const cancelProgramIssueOperation = findOperation(
  document,
  'cancel_program_assignment_api_v1_program_assignments__program_assignment_id__cancel_post',
);
const listActiveRelationshipsOperation = findOperation(
  document,
  'list_active_trainer_relationships_api_v1_clients_relationships_active_get',
);

assertRequiredQueryParameter(listOperation.operation, 'scheduled_date', 'date');
assertArrayResponseRef(listOperation.operation, '200', 'WorkoutAssignmentResponse');
assertResponseRef(getOperation.operation, '200', 'WorkoutAssignmentResponse');
assertRequestRef(createOperation.operation, 'CreateWorkoutAssignmentRequest');
assertResponseRef(createOperation.operation, '201', 'WorkoutAssignmentResponse');
assertRequestRef(rescheduleOperation.operation, 'RescheduleWorkoutAssignmentRequest');
assertResponseRef(rescheduleOperation.operation, '200', 'WorkoutAssignmentResponse');
assertResponseRef(cancelOperation.operation, '200', 'WorkoutAssignmentResponse');
assertResponseRef(createOperation.operation, '409', 'BusinessErrorResponse');
assertResponseRef(rescheduleOperation.operation, '409', 'BusinessErrorResponse');
assertResponseRef(cancelOperation.operation, '409', 'BusinessErrorResponse');
assertArrayResponseRef(listProgramsOperation.operation, '200', 'ProgramResponse');
assertRequestRef(createProgramOperation.operation, 'ProgramCreate');
assertResponseRef(createProgramOperation.operation, '201', 'ProgramResponse');
assertRequestRef(replaceProgramOperation.operation, 'ProgramCreate');
assertResponseRef(replaceProgramOperation.operation, '200', 'ProgramResponse');
assertRequestRef(issueProgramOperation.operation, 'IssueProgramRequest');
assertResponseRef(issueProgramOperation.operation, '201', 'ProgramAssignmentResponse');
assertResponseRef(cancelProgramIssueOperation.operation, '200', 'ProgramAssignmentResponse');
assertArrayResponseRef(listActiveRelationshipsOperation.operation, '200', 'RelationshipResponse');

const generatedSnapshot = [
  '/** This file is generated by tools/openapi/generate.mjs. Do not edit manually. */',
  `export const openApiDocument = ${JSON.stringify(document, null, 2)} as const;`,
  '',
  'export type OpenApiPath = keyof typeof openApiDocument.paths;',
  '',
].join('\n');

const assignmentOperations = {
  list: {
    method: listOperation.method,
    path: listOperation.path,
    relativePath: relativeAssignmentPath(listOperation.path),
    operationId: 'listClientWorkoutAssignmentsByDate',
    successStatus: 200,
  },
  get: {
    method: getOperation.method,
    path: getOperation.path,
    relativePath: relativeAssignmentPath(getOperation.path),
    operationId: 'getWorkoutAssignment',
    successStatus: 200,
  },
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
const generatedAssignments =
  [
    '/** This file is generated by tools/openapi/generate.mjs. Do not edit manually. */',
    `export const WORKOUT_ASSIGNMENT_OPERATIONS = ${JSON.stringify(assignmentOperations, null, 2)} as const;`,
    '',
    ...ASSIGNMENT_SCHEMA_NAMES.map((name) =>
      renderSchemaDeclaration(name, assignmentSchemas[name]),
    ),
    '',
  ]
    .join('\n\n')
    .trimEnd() + '\n';

const programOperations = {
  list: {
    method: listProgramsOperation.method,
    path: listProgramsOperation.path,
    relativePath: relativeAssignmentPath(listProgramsOperation.path),
  },
  create: {
    method: createProgramOperation.method,
    path: createProgramOperation.path,
    relativePath: relativeAssignmentPath(createProgramOperation.path),
  },
  replace: {
    method: replaceProgramOperation.method,
    path: replaceProgramOperation.path,
    relativePath: relativeAssignmentPath(replaceProgramOperation.path),
  },
  issue: {
    method: issueProgramOperation.method,
    path: issueProgramOperation.path,
    relativePath: relativeAssignmentPath(issueProgramOperation.path),
  },
  cancelIssue: {
    method: cancelProgramIssueOperation.method,
    path: cancelProgramIssueOperation.path,
    relativePath: relativeAssignmentPath(cancelProgramIssueOperation.path),
  },
  listActiveRelationships: {
    method: listActiveRelationshipsOperation.method,
    path: listActiveRelationshipsOperation.path,
    relativePath: relativeAssignmentPath(listActiveRelationshipsOperation.path),
  },
};

const programSchemas = document.components.schemas;
const generatedPrograms =
  [
    '/** This file is generated by tools/openapi/generate.mjs. Do not edit manually. */',
    `export const PROGRAM_OPERATIONS = ${JSON.stringify(programOperations, null, 2)} as const;`,
    '',
    ...PROGRAM_SCHEMA_NAMES.map((name) => renderSchemaDeclaration(name, programSchemas[name])),
    '',
  ]
    .join('\n\n')
    .trimEnd() + '\n';

await mkdir(generatedDirectory, { recursive: true });
await writeFile(snapshotOutputPath, generatedSnapshot, 'utf8');
await writeFile(assignmentOutputPath, generatedAssignments, 'utf8');
await writeFile(programOutputPath, generatedPrograms, 'utf8');
console.info(`Generated OpenAPI contract snapshot: ${snapshotOutputPath}`);
console.info(`Generated workout assignment contract: ${assignmentOutputPath}`);
console.info(`Generated program contract: ${programOutputPath}`);
