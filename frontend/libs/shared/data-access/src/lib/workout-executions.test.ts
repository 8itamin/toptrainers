import '@angular/compiler';

import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import {
  isWorkoutExecutionNotFound,
  workoutExecutionOperationPath,
} from './workout-executions';

describe('workout execution data access', () => {
  it('uses generated relative paths for Start, Get, and Complete', () => {
    expect(workoutExecutionOperationPath('start', 'assignment/id')).toBe(
      '/assignments/assignment%2Fid/execution/start',
    );
    expect(workoutExecutionOperationPath('get', 'assignment/id')).toBe(
      '/assignments/assignment%2Fid/execution',
    );
    expect(workoutExecutionOperationPath('complete', 'assignment/id')).toBe(
      '/assignments/assignment%2Fid/execution/complete',
    );
  });

  it('treats only EXECUTION_NOT_FOUND as a not-started execution', () => {
    expect(
      isWorkoutExecutionNotFound(
        new HttpErrorResponse({
          status: 404,
          error: { detail: { code: 'EXECUTION_NOT_FOUND', message: 'Execution not found' } },
        }),
      ),
    ).toBe(true);

    expect(
      isWorkoutExecutionNotFound(
        new HttpErrorResponse({
          status: 404,
          error: { detail: { code: 'ASSIGNMENT_NOT_FOUND', message: 'Assignment not found' } },
        }),
      ),
    ).toBe(false);
    expect(isWorkoutExecutionNotFound(new HttpErrorResponse({ status: 403 }))).toBe(false);
  });
});
