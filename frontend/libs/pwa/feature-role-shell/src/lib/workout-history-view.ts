import type { WorkoutHistoryItem, WorkoutHistoryPage } from '@toptrainers/shared/contracts';

export interface WorkoutHistoryAppendResult {
  items: WorkoutHistoryItem[];
  nextCursor: string | null;
}

export function appendWorkoutHistoryPage(
  currentItems: readonly WorkoutHistoryItem[],
  page: WorkoutHistoryPage,
): WorkoutHistoryAppendResult {
  return {
    items: [...currentItems, ...page.items],
    nextCursor: page.next_cursor ?? null,
  };
}

export function isWorkoutHistoryEmpty(
  items: readonly WorkoutHistoryItem[],
  loading: boolean,
): boolean {
  return !loading && items.length === 0;
}

export function historyAssignmentQueryParams(
  item: Pick<WorkoutHistoryItem, 'assignment_id'>,
): { assignment_id: string } {
  return { assignment_id: item.assignment_id };
}
