import type {
  WorkoutAssignmentResponse,
  WorkoutExecutionResponse,
} from '@toptrainers/shared/contracts';

export interface WorkoutExecutionPlan {
  assignmentId: string;
  title: string;
  description: string;
  scheduledDate: string;
  blocks: WorkoutAssignmentResponse['workout_snapshot']['blocks'];
}

export type WorkoutExecutionAction = 'start' | 'complete' | 'none';

export function playerQueryParams(assignmentId: string): { assignment_id: string } {
  return { assignment_id: assignmentId };
}

export function toWorkoutExecutionPlan(assignment: WorkoutAssignmentResponse): WorkoutExecutionPlan {
  return {
    assignmentId: assignment.id,
    title: assignment.workout_snapshot.title,
    description: assignment.workout_snapshot.description,
    scheduledDate: assignment.scheduled_date,
    blocks: assignment.workout_snapshot.blocks,
  };
}

export function executionActionForResponse(
  execution: WorkoutExecutionResponse | null,
): WorkoutExecutionAction {
  if (!execution) return 'start';
  if (execution.status === 'IN_PROGRESS') return 'complete';
  return 'none';
}
