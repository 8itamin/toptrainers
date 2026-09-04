import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { authorizedSurfaceForUrl } from './authorized-surface';

describe('authorized account access placement', () => {
  it('exposes account access across Client routes', () => {
    expect(authorizedSurfaceForUrl('/client')).toBe('client');
    expect(authorizedSurfaceForUrl('/client/history')).toBe('client');
    expect(authorizedSurfaceForUrl('/client/workout?assignment_id=1')).toBe('client');
  });

  it('exposes account access across Trainer routes', () => {
    expect(authorizedSurfaceForUrl('/trainer')).toBe('trainer');
    expect(authorizedSurfaceForUrl('/trainer/clients')).toBe('trainer');
    expect(authorizedSurfaceForUrl('/trainer/programs/library')).toBe('trainer');
  });

  it('does not expose account access in the unauthenticated flow', () => {
    expect(authorizedSurfaceForUrl('/auth')).toBeNull();
    expect(authorizedSurfaceForUrl('/auth/reset-password')).toBeNull();
  });

  it('keeps Trainer More through 1079px and switches to avatar at the 1080px role-shell breakpoint', () => {
    const source = readFileSync(new URL('./app.component.ts', import.meta.url), 'utf8');

    expect(source).toContain('@media (min-width: 1080px)');
    expect(source).not.toContain('@media (min-width: 980px)');
  });
});
