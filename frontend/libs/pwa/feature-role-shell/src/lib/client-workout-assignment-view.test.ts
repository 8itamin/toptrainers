import { describe, expect, it } from 'vitest';

import type { WorkoutAssignmentResponse } from '@toptrainers/shared/contracts';

import {
  assignmentIdFromQueryParam,
  clientAssignmentDetailsQueryParams,
  clientAssignmentReadErrorKind,
  toClientAssignmentCards,
  toClientAssignmentDetails,
} from './client-workout-assignment-view';

function assignmentFixture(
  overrides: Partial<WorkoutAssignmentResponse> = {},
): WorkoutAssignmentResponse {
  return {
    id: 'assignment-1',
    relationship_id: 'relationship-1',
    trainer_id: 'trainer-1',
    client_id: 'client-1',
    source_workout_id: 'workout-live-id',
    request_id: 'request-1',
    scheduled_date: '2026-08-24',
    status: 'PLANNED',
    snapshot_schema_version: 1,
    workout_snapshot: {
      title: 'Frozen workout title',
      description: 'Frozen workout description',
      blocks: [
        {
          kind: 'main',
          position: 0,
          exercises: [
            {
              source_exercise_id: 'exercise-live-id',
              position: 0,
              title: 'Frozen squat',
              direction: 'strength',
              muscle_group: 'legs',
              instruction: 'Frozen instruction',
              weight_kg: 80,
              sets: 4,
              reps: 8,
            },
          ],
        },
      ],
    },
    created_at: '2026-08-23T10:00:00Z',
    updated_at: '2026-08-23T10:00:00Z',
    ...overrides,
  };
}

describe('client workout assignment presentation', () => {
  it('keeps discovery empty when backend returns 200 []', () => {
    expect(toClientAssignmentCards([])).toEqual([]);
  });

  it('keeps every same-day assignment in backend order without selecting a primary one', () => {
    const first = assignmentFixture({ id: 'assignment-1', status: 'PLANNED' });
    const second = assignmentFixture({ id: 'assignment-2', status: 'CANCELLED' });

    expect(toClientAssignmentCards([first, second])).toEqual([
      {
        id: 'assignment-1',
        status: 'PLANNED',
        title: 'Frozen workout title',
        exerciseCount: 1,
      },
      {
        id: 'assignment-2',
        status: 'CANCELLED',
        title: 'Frozen workout title',
        exerciseCount: 1,
      },
    ]);
  });

  it('preserves historical assignment statuses for client rendering', () => {
    const completed = assignmentFixture({ status: 'COMPLETED' });

    expect(toClientAssignmentCards([completed])[0]?.status).toBe('COMPLETED');
  });

  it('builds and restores a reload-safe assignment_id navigation contract', () => {
    expect(clientAssignmentDetailsQueryParams('assignment/id')).toEqual({
      assignment_id: 'assignment/id',
    });
    expect(assignmentIdFromQueryParam('assignment/id')).toBe('assignment/id');
    expect(assignmentIdFromQueryParam(null)).toBeNull();
    expect(assignmentIdFromQueryParam('')).toBeNull();
  });

  it('renders details only from the frozen assignment snapshot', () => {
    const assignment = assignmentFixture();
    const details = toClientAssignmentDetails(assignment);

    expect(details.title).toBe('Frozen workout title');
    expect(details.description).toBe('Frozen workout description');
    expect(details.blocks).toBe(assignment.workout_snapshot.blocks);
    expect(details.exerciseCount).toBe(1);
    expect(details.sourceWorkoutId).toBeUndefined();
  });

  it('classifies forbidden, missing, network and generic read failures without changing domain state', () => {
    expect(clientAssignmentReadErrorKind({ status: 403 })).toBe('forbidden');
    expect(clientAssignmentReadErrorKind({ status: 404 })).toBe('not-found');
    expect(clientAssignmentReadErrorKind({ status: 0 })).toBe('network');
    expect(clientAssignmentReadErrorKind({ status: 500 })).toBe('other');
  });
});
