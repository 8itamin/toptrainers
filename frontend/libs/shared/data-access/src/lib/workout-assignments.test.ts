import { describe, expect, it } from 'vitest';

import {
  canMutateWorkoutAssignment,
  workoutAssignmentOperationPath,
} from './workout-assignments';

describe('workout assignment data access', () => {
  it('uses generated relative paths for assignment mutations', () => {
    expect(workoutAssignmentOperationPath('create')).toBe('/assignments');
    expect(workoutAssignmentOperationPath('reschedule', 'assignment/id')).toBe(
      '/assignments/assignment%2Fid/reschedule',
    );
    expect(workoutAssignmentOperationPath('cancel', 'assignment/id')).toBe(
      '/assignments/assignment%2Fid/cancel',
    );
  });

  it('allows trainer mutation controls only for PLANNED assignments', () => {
    expect(canMutateWorkoutAssignment({ status: 'PLANNED' })).toBe(true);
    expect(canMutateWorkoutAssignment({ status: 'IN_PROGRESS' })).toBe(false);
    expect(canMutateWorkoutAssignment({ status: 'COMPLETED' })).toBe(false);
    expect(canMutateWorkoutAssignment({ status: 'CANCELLED' })).toBe(false);
  });
});
