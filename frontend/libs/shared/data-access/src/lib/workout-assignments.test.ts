import { describe, expect, it } from 'vitest';

import {
  canMutateWorkoutAssignment,
  workoutAssignmentListParams,
  workoutAssignmentOperationPath,
} from './workout-assignments';

describe('workout assignment data access', () => {
  it('uses generated relative paths for assignment reads and mutations', () => {
    expect(workoutAssignmentOperationPath('list')).toBe('/assignments');
    expect(workoutAssignmentOperationPath('get', 'assignment/id')).toBe(
      '/assignments/assignment%2Fid',
    );
    expect(workoutAssignmentOperationPath('create')).toBe('/assignments');
    expect(workoutAssignmentOperationPath('reschedule', 'assignment/id')).toBe(
      '/assignments/assignment%2Fid/reschedule',
    );
    expect(workoutAssignmentOperationPath('cancel', 'assignment/id')).toBe(
      '/assignments/assignment%2Fid/cancel',
    );
  });

  it('uses the exact scheduled_date query parameter for client discovery', () => {
    expect(workoutAssignmentListParams('2026-08-24')).toEqual({
      scheduled_date: '2026-08-24',
    });
  });

  it('allows trainer mutation controls only for PLANNED assignments', () => {
    expect(canMutateWorkoutAssignment({ status: 'PLANNED' })).toBe(true);
    expect(canMutateWorkoutAssignment({ status: 'IN_PROGRESS' })).toBe(false);
    expect(canMutateWorkoutAssignment({ status: 'COMPLETED' })).toBe(false);
    expect(canMutateWorkoutAssignment({ status: 'CANCELLED' })).toBe(false);
  });
});
