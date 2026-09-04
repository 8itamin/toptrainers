import { describe, expect, it } from 'vitest';

import type { WorkoutHistoryPage } from '@toptrainers/shared/contracts';

import {
  appendWorkoutHistoryPage,
  historyAssignmentQueryParams,
  isWorkoutHistoryEmpty,
} from './workout-history-view';

function page(
  items: WorkoutHistoryPage['items'],
  nextCursor: string | null,
): WorkoutHistoryPage {
  return { items, next_cursor: nextCursor };
}

function item(assignmentId: string, relationshipId: string): WorkoutHistoryPage['items'][number] {
  return {
    assignment_id: assignmentId,
    relationship_id: relationshipId,
    trainer_id: 'trainer-1',
    client_id: 'client-1',
    workout_title: `Workout ${assignmentId}`,
    scheduled_date: '2026-09-01',
    started_at: '2026-09-01T08:00:00Z',
    completed_at: '2026-09-01T09:00:00Z',
  };
}

describe('workout history presentation', () => {
  it('shows empty state only after an empty first page', () => {
    expect(isWorkoutHistoryEmpty([], false)).toBe(true);
    expect(isWorkoutHistoryEmpty([], true)).toBe(false);
  });

  it('appends pages exactly as returned without relationship grouping or filtering', () => {
    const first = page([item('a-1', 'relationship-old')], 'cursor-2');
    const second = page(
      [item('a-2', 'relationship-new'), item('a-3', 'relationship-old')],
      null,
    );

    const afterFirst = appendWorkoutHistoryPage([], first);
    const afterSecond = appendWorkoutHistoryPage(afterFirst.items, second);

    expect(afterSecond.items.map((entry) => [entry.assignment_id, entry.relationship_id])).toEqual([
      ['a-1', 'relationship-old'],
      ['a-2', 'relationship-new'],
      ['a-3', 'relationship-old'],
    ]);
    expect(afterSecond.nextCursor).toBeNull();
  });

  it('opens existing Assignment detail by assignment_id', () => {
    expect(historyAssignmentQueryParams(item('assignment-42', 'relationship-old'))).toEqual({
      assignment_id: 'assignment-42',
    });
  });
});
