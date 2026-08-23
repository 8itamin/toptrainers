import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { RUNTIME_CONFIG, type RuntimeConfig } from '@toptrainers/shared/config';
import {
  WORKOUT_EXECUTION_OPERATIONS,
  type WorkoutExecutionResponse,
} from '@toptrainers/shared/contracts';

import { apiUrl } from './api-url';

export type WorkoutExecutionOperation = keyof typeof WORKOUT_EXECUTION_OPERATIONS;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function workoutExecutionOperationPath(
  operation: WorkoutExecutionOperation,
  assignmentId: string,
): `/${string}` {
  const path = WORKOUT_EXECUTION_OPERATIONS[operation].relativePath;
  return path.replace('{assignment_id}', encodeURIComponent(assignmentId)) as `/${string}`;
}

export function isWorkoutExecutionNotFound(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse) || error.status !== 404 || !isRecord(error.error)) {
    return false;
  }
  const detail = error.error['detail'];
  return isRecord(detail) && detail['code'] === 'EXECUTION_NOT_FOUND';
}

@Injectable({ providedIn: 'root' })
export class WorkoutExecutionsApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject<RuntimeConfig>(RUNTIME_CONFIG);

  start(assignmentId: string): Observable<WorkoutExecutionResponse> {
    return this.http.post<WorkoutExecutionResponse>(
      apiUrl(this.config, workoutExecutionOperationPath('start', assignmentId)),
      null,
    );
  }

  get(assignmentId: string): Observable<WorkoutExecutionResponse> {
    return this.http.get<WorkoutExecutionResponse>(
      apiUrl(this.config, workoutExecutionOperationPath('get', assignmentId)),
    );
  }

  complete(assignmentId: string): Observable<WorkoutExecutionResponse> {
    return this.http.post<WorkoutExecutionResponse>(
      apiUrl(this.config, workoutExecutionOperationPath('complete', assignmentId)),
      null,
    );
  }
}
