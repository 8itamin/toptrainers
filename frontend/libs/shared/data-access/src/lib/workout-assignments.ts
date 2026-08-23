import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { RUNTIME_CONFIG, type RuntimeConfig } from '@toptrainers/shared/config';
import {
  WORKOUT_ASSIGNMENT_OPERATIONS,
  type CreateWorkoutAssignmentRequest,
  type RescheduleWorkoutAssignmentRequest,
  type WorkoutAssignmentResponse,
} from '@toptrainers/shared/contracts';

import { apiUrl } from './api-url';

export type WorkoutAssignmentMutation = keyof typeof WORKOUT_ASSIGNMENT_OPERATIONS;

export function workoutAssignmentOperationPath(
  operation: WorkoutAssignmentMutation,
  assignmentId?: string,
): `/${string}` {
  const path = WORKOUT_ASSIGNMENT_OPERATIONS[operation].relativePath;

  if (operation === 'create') {
    return path;
  }

  if (!assignmentId) {
    throw new Error(`Assignment id is required for ${operation}`);
  }

  return path.replace('{assignment_id}', encodeURIComponent(assignmentId)) as `/${string}`;
}

export function canMutateWorkoutAssignment(
  assignment: Pick<WorkoutAssignmentResponse, 'status'>,
): boolean {
  return assignment.status === 'PLANNED';
}

export function isWorkoutAssignmentConflict(error: unknown): error is HttpErrorResponse {
  return error instanceof HttpErrorResponse && error.status === 409;
}

@Injectable({ providedIn: 'root' })
export class WorkoutAssignmentsApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject<RuntimeConfig>(RUNTIME_CONFIG);

  create(payload: CreateWorkoutAssignmentRequest): Observable<WorkoutAssignmentResponse> {
    return this.http.post<WorkoutAssignmentResponse>(
      apiUrl(this.config, workoutAssignmentOperationPath('create')),
      payload,
    );
  }

  reschedule(
    assignmentId: string,
    payload: RescheduleWorkoutAssignmentRequest,
  ): Observable<WorkoutAssignmentResponse> {
    return this.http.post<WorkoutAssignmentResponse>(
      apiUrl(this.config, workoutAssignmentOperationPath('reschedule', assignmentId)),
      payload,
    );
  }

  cancel(assignmentId: string): Observable<WorkoutAssignmentResponse> {
    return this.http.post<WorkoutAssignmentResponse>(
      apiUrl(this.config, workoutAssignmentOperationPath('cancel', assignmentId)),
      null,
    );
  }
}
