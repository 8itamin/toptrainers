import {
  workoutAssignmentListParams,
  workoutAssignmentOperationPath,
} from './workout-assignments';

void workoutAssignmentOperationPath('list');
void workoutAssignmentOperationPath('get', 'assignment-id');
void workoutAssignmentListParams('2026-08-24');
