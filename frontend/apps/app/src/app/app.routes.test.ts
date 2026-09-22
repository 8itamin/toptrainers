import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

function routeBlock(path: string): string {
  const source = readFileSync(new URL('./app.routes.ts', import.meta.url), 'utf8');
  const match = source.match(new RegExp(`path: '${path}'[\\s\\S]*?\\n  },`));
  if (!match) {
    throw new Error(`Route ${path} must be declared`);
  }

  return match[0];
}

describe('trainer program routes', () => {
  it('opens the program library at the canonical Programs address', () => {
    expect(routeBlock('trainer/programs')).toContain('module.LibraryHubComponent');
  });

  it('keeps the existing program builder at its explicit address', () => {
    expect(routeBlock('trainer/programs/builder')).toContain('module.ProgramBuilderComponent');
  });
});
