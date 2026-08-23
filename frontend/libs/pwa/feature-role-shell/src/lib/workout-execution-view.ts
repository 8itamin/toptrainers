import type {
  WorkoutAssignmentResponse,
  WorkoutExecutionResponse,
} from '@toptrainers/shared/contracts';

export interface WorkoutExecutionPlan {
  assignmentId: string;
  assignmentStatus: string;
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
    assignmentStatus: assignment.status,
    title: assignment.workout_snapshot.title,
    description: assignment.workout_snapshot.description,
    scheduledDate: assignment.scheduled_date,
    blocks: assignment.workout_snapshot.blocks,
  };
}

export function executionActionForResponse(
  assignmentStatus: string,
  execution: WorkoutExecutionResponse | null,
): WorkoutExecutionAction {
  if (execution?.status === 'IN_PROGRESS') return 'complete';
  if (execution?.status === 'COMPLETED') return 'none';
  return assignmentStatus === 'PLANNED' ? 'start' : 'none';
}
