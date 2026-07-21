/**
 * Placeholder generated contract. Run `python scripts/export_openapi.py` in backend,
 * then `pnpm api:generate` in frontend to replace this file. Do not edit request/response
 * DTOs manually in frontend features.
 */
export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'TopTrainers API (pending export)',
    version: '0.0.0',
  },
  paths: {},
} as const;

export type OpenApiPath = keyof typeof openApiDocument.paths;
