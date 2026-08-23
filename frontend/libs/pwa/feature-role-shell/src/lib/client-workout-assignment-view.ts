import type {
  WorkoutAssignmentResponse,
  WorkoutSnapshotBlockV1,
} from '@toptrainers/shared/contracts';

export interface ClientWorkoutAssignmentCard {
  id: string;
  status: string;
  title: string;
  exerciseCount: number;
}

export interface ClientWorkoutAssignmentDetails {
  id: string;
  status: string;
  scheduledDate: string;
  title: string;
  description: string;
  exerciseCount: number;
  blocks: WorkoutSnapshotBlockV1[];
}

export type ClientAssignmentReadErrorKind = 'forbidden' | 'not-found' | 'network' | 'other';

function exerciseCount(assignment: WorkoutAssignmentResponse): number {
  return assignment.workout_snapshot.blocks.reduce(
    (total, block) => total + block.exercises.length,
    0,
  );
}

export function toClientAssignmentCards(
  assignments: readonly WorkoutAssignmentResponse[],
): ClientWorkoutAssignmentCard[] {
  return assignments.map((assignment) => ({
    id: assignment.id,
    status: assignment.status,
    title: assignment.workout_snapshot.title,
    exerciseCount: exerciseCount(assignment),
  }));
}

export function toClientAssignmentDetails(
  assignment: WorkoutAssignmentResponse,
): ClientWorkoutAssignmentDetails {
  return {
    id: assignment.id,
    status: assignment.status,
    scheduledDate: assignment.scheduled_date,
    title: assignment.workout_snapshot.title,
    description: assignment.workout_snapshot.description,
    exerciseCount: exerciseCount(assignment),
    blocks: assignment.workout_snapshot.blocks,
  };
}

export function clientAssignmentDetailsQueryParams(
  assignmentId: string,
): { assignment_id: string } {
  return { assignment_id: assignmentId };
}

export function assignmentIdFromQueryParam(value: string | null): string | null {
  return value && value.length > 0 ? value : null;
}

export function clientAssignmentReadErrorKind(error: unknown): ClientAssignmentReadErrorKind {
  if (typeof error !== 'object' || error === null || !('status' in error)) {
    return 'other';
  }

  const status = (error as { status?: unknown }).status;
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not-found';
  if (status === 0) return 'network';
  return 'other';
}

export function clientAssignmentReadErrorMessage(error: unknown): string {
  switch (clientAssignmentReadErrorKind(error)) {
    case 'forbidden':
      return 'Нет доступа к назначенной тренировке.';
    case 'not-found':
      return 'Назначенная тренировка не найдена.';
    case 'network':
      return 'Нет соединения. Проверьте сеть и повторите попытку.';
    case 'other':
      return 'Не удалось загрузить назначенную тренировку.';
  }
}
