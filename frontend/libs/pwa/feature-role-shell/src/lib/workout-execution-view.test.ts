import { describe, expect, it } from 'vitest';

import type {
  WorkoutAssignmentResponse,
  WorkoutExecutionResponse,
} from '@toptrainers/shared/contracts';

import {
  executionActionForResponse,
  playerQueryParams,
  toWorkoutExecutionPlan,
} from './workout-execution-view';

function assignmentFixture(status = 'PLANNED'): WorkoutAssignmentResponse {
  return {
    id: 'assignment-1',
    relationship_id: 'relationship-1',
    trainer_id: 'trainer-1',
    client_id: 'client-1',
    source_workout_id: 'live-template-id-that-must-not-render',
    request_id: 'request-1',
    scheduled_date: '2026-08-24',
    status,
    snapshot_schema_version: 1,
    workout_snapshot: {
      title: 'Frozen strength day',
      description: 'Frozen description',
      blocks: [
        {
          kind: 'main',
          position: 0,
          exercises: [
            {
              source_exercise_id: 'exercise-1',
              position: 0,
              title: 'Frozen squat',
              direction: 'strength',
              muscle_group: 'legs',
              instruction: 'Frozen instruction',
              sets: 3,
              reps: 8,
              weight_kg: 40,
            },
          ],
        },
      ],
    },
    created_at: '2026-08-24T00:00:00Z',
    updated_at: '2026-08-24T00:00:00Z',
  };
}

function executionFixture(status: WorkoutExecutionResponse['status']): WorkoutExecutionResponse {
  return {
    id: 'execution-1',
    assignment_id: 'assignment-1',
    status,
    started_at: '2026-08-24T01:00:00Z',
    completed_at: status === 'COMPLETED' ? '2026-08-24T02:00:00Z' : null,
  };
}

describe('workout execution player presentation', () => {
  it('preserves assignment_id in player URLs', () => {
    expect(playerQueryParams('assignment-1')).toEqual({ assignment_id: 'assignment-1' });
  });

  it('renders plan content only from the frozen Assignment snapshot', () => {
    const plan = toWorkoutExecutionPlan(assignmentFixture());

    expect(plan).toEqual({
      assignmentId: 'assignment-1',
      assignmentStatus: 'PLANNED',
      title: 'Frozen strength day',
      description: 'Frozen description',
      scheduledDate: '2026-08-24',
      blocks: assignmentFixture().workout_snapshot.blocks,
    });
    expect(JSON.stringify(plan)).not.toContain('live-template-id-that-must-not-render');
  });

  it('derives available lifecycle action from authoritative Assignment and Execution responses', () => {
    expect(executionActionForResponse('PLANNED', null)).toBe('start');
    expect(executionActionForResponse('IN_PROGRESS', executionFixture('IN_PROGRESS'))).toBe(
      'complete',
    );
    expect(executionActionForResponse('COMPLETED', executionFixture('COMPLETED'))).toBe('none');
  });

  it('does not offer Start for CANCELLED Assignment without an Execution', () => {
    const cancelledPlan = toWorkoutExecutionPlan(assignmentFixture('CANCELLED'));

    expect(cancelledPlan.assignmentStatus).toBe('CANCELLED');
    expect(executionActionForResponse(cancelledPlan.assignmentStatus, null)).toBe('none');
  });
});
