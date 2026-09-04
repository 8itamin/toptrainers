import '@angular/compiler';

import { describe, expect, it } from 'vitest';

import {
  workoutHistoryOperationPath,
  workoutHistoryQueryParams,
} from './workout-history';

describe('workout history data access', () => {
  it('uses generated Client self-history path without client_id', () => {
    expect(workoutHistoryOperationPath('client')).toBe('/workout-history');
  });

  it('uses target client context only for Trainer history', () => {
    expect(workoutHistoryOperationPath('trainer', 'client/id')).toBe(
      '/clients/client%2Fid/workout-history',
    );
  });

  it('passes cursor pagination without inventing filters', () => {
    expect(workoutHistoryQueryParams()).toEqual({ limit: 20 });
    expect(workoutHistoryQueryParams('next-cursor')).toEqual({
      limit: 20,
      cursor: 'next-cursor',
    });
  });
});
