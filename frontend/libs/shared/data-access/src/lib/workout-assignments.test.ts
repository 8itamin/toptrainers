import '@angular/compiler';

import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';

import type { WorkoutAssignmentResponse } from '@toptrainers/shared/contracts';

import {
  canMutateWorkoutAssignment,
  refreshWorkoutAssignmentAfterConflict,
  workoutAssignmentListParams,
  workoutAssignmentOperationPath,
} from './workout-assignments';

function assignmentFixture(): WorkoutAssignmentResponse {
  return {
    id: 'assignment-1',
    relationship_id: 'relationship-1',
    trainer_id: 'trainer-1',
    client_id: 'client-1',
    source_workout_id: 'workout-1',
    request_id: 'request-1',
    scheduled_date: '2026-08-24',
    status: 'PLANNED',
    snapshot_schema_version: 1,
    workout_snapshot: {
      title: 'Frozen workout',
      description: '',
      blocks: [],
    },
    created_at: '2026-08-23T10:00:00Z',
    updated_at: '2026-08-23T10:00:00Z',
  };
}

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

  it('performs authoritative Get by ID after a mutation 409', async () => {
    const refreshed = assignmentFixture();
    const requestedIds: string[] = [];

    const outcome = await firstValueFrom(
      refreshWorkoutAssignmentAfterConflict(
        'assignment-1',
        throwError(() => new HttpErrorResponse({ status: 409 })),
        (assignmentId) => {
          requestedIds.push(assignmentId);
          return of(refreshed);
        },
      ),
    );

    expect(requestedIds).toEqual(['assignment-1']);
    expect(outcome).toEqual({ kind: 'conflict-refreshed', assignment: refreshed });
  });

  it('does not refresh non-conflict mutation failures', async () => {
    const requestedIds: string[] = [];

    await expect(
      firstValueFrom(
        refreshWorkoutAssignmentAfterConflict(
          'assignment-1',
          throwError(() => new HttpErrorResponse({ status: 404 })),
          (assignmentId) => {
            requestedIds.push(assignmentId);
            return of(assignmentFixture());
          },
        ),
      ),
    ).rejects.toMatchObject({ status: 404 });

    expect(requestedIds).toEqual([]);
  });
});
