import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, throwError, type Observable } from 'rxjs';

import { RUNTIME_CONFIG, type RuntimeConfig } from '@toptrainers/shared/config';
import {
  WORKOUT_ASSIGNMENT_OPERATIONS,
  type CreateWorkoutAssignmentRequest,
  type MediaReadUrlsRequest,
  type MediaReadUrlResponse,
  type RescheduleWorkoutAssignmentRequest,
  type WorkoutAssignmentResponse,
} from '@toptrainers/shared/contracts';

import { apiUrl } from './api-url';

export type WorkoutAssignmentOperation = keyof typeof WORKOUT_ASSIGNMENT_OPERATIONS;
export type WorkoutAssignmentMutation = 'create' | 'reschedule' | 'cancel';

export type WorkoutAssignmentMutationOutcome =
  | { kind: 'updated'; assignment: WorkoutAssignmentResponse }
  | { kind: 'conflict-refreshed'; assignment: WorkoutAssignmentResponse };

export function workoutAssignmentOperationPath(
  operation: WorkoutAssignmentOperation,
  assignmentId?: string,
  mediaId?: string,
): `/${string}` {
  const path = WORKOUT_ASSIGNMENT_OPERATIONS[operation].relativePath;

  if (operation === 'list' || operation === 'create') {
    return path;
  }

  if (!assignmentId) {
    throw new Error(`Assignment id is required for ${operation}`);
  }

  const withAssignmentId = path.replace('{assignment_id}', encodeURIComponent(assignmentId));
  if (operation !== 'createExerciseMediaReadUrl' && operation !== 'getExerciseStreamManifest') {
    return withAssignmentId as `/${string}`;
  }
  if (!mediaId) {
    throw new Error('Media id is required for exercise media access');
  }
  return withAssignmentId.replace('{media_id}', encodeURIComponent(mediaId)) as `/${string}`;
}

export function workoutAssignmentListParams(scheduledDate: string): { scheduled_date: string } {
  return { scheduled_date: scheduledDate };
}

export function canMutateWorkoutAssignment(
  assignment: Pick<WorkoutAssignmentResponse, 'status'>,
): boolean {
  return assignment.status === 'PLANNED';
}

export function isWorkoutAssignmentConflict(error: unknown): error is HttpErrorResponse {
  return error instanceof HttpErrorResponse && error.status === 409;
}

export function refreshWorkoutAssignmentAfterConflict(
  assignmentId: string,
  mutation: Observable<WorkoutAssignmentMutationOutcome>,
  getAssignment: (assignmentId: string) => Observable<WorkoutAssignmentResponse>,
): Observable<WorkoutAssignmentMutationOutcome> {
  return mutation.pipe(
    catchError((error: unknown) => {
      if (!isWorkoutAssignmentConflict(error)) {
        return throwError(() => error);
      }
      return getAssignment(assignmentId).pipe(
        map((assignment) => ({ kind: 'conflict-refreshed', assignment }) as const),
      );
    }),
  );
}

@Injectable({ providedIn: 'root' })
export class WorkoutAssignmentsApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject<RuntimeConfig>(RUNTIME_CONFIG);

  listClientByDate(scheduledDate: string): Observable<WorkoutAssignmentResponse[]> {
    return this.http.get<WorkoutAssignmentResponse[]>(
      apiUrl(this.config, workoutAssignmentOperationPath('list')),
      { params: workoutAssignmentListParams(scheduledDate) },
    );
  }

  get(assignmentId: string): Observable<WorkoutAssignmentResponse> {
    return this.http.get<WorkoutAssignmentResponse>(
      apiUrl(this.config, workoutAssignmentOperationPath('get', assignmentId)),
    );
  }

  createExerciseMediaReadUrl(
    assignmentId: string,
    mediaId: string,
  ): Observable<MediaReadUrlResponse> {
    return this.http.post<MediaReadUrlResponse>(
      apiUrl(this.config, workoutAssignmentOperationPath('createExerciseMediaReadUrl', assignmentId, mediaId)),
      null,
    );
  }

  createExerciseThumbnailReadUrls(
    assignmentId: string,
    mediaIds: string[],
  ): Observable<MediaReadUrlResponse[]> {
    const payload: MediaReadUrlsRequest = { media_ids: mediaIds };
    return this.http.post<MediaReadUrlResponse[]>(
      apiUrl(
        this.config,
        workoutAssignmentOperationPath('createExerciseThumbnailReadUrls', assignmentId),
      ),
      payload,
    );
  }

  exerciseStreamManifestUrl(assignmentId: string, mediaId: string): string {
    return apiUrl(
      this.config,
      workoutAssignmentOperationPath('getExerciseStreamManifest', assignmentId, mediaId),
    );
  }

  create(payload: CreateWorkoutAssignmentRequest): Observable<WorkoutAssignmentResponse> {
    return this.http.post<WorkoutAssignmentResponse>(
      apiUrl(this.config, workoutAssignmentOperationPath('create')),
      payload,
    );
  }

  reschedule(
    assignmentId: string,
    payload: RescheduleWorkoutAssignmentRequest,
  ): Observable<WorkoutAssignmentMutationOutcome> {
    const mutation = this.http
      .post<WorkoutAssignmentResponse>(
        apiUrl(this.config, workoutAssignmentOperationPath('reschedule', assignmentId)),
        payload,
      )
      .pipe(map((assignment) => ({ kind: 'updated', assignment }) as const));

    return refreshWorkoutAssignmentAfterConflict(
      assignmentId,
      mutation,
      (id) => this.get(id),
    );
  }

  cancel(assignmentId: string): Observable<WorkoutAssignmentMutationOutcome> {
    const mutation = this.http
      .post<WorkoutAssignmentResponse>(
        apiUrl(this.config, workoutAssignmentOperationPath('cancel', assignmentId)),
        null,
      )
      .pipe(map((assignment) => ({ kind: 'updated', assignment }) as const));

    return refreshWorkoutAssignmentAfterConflict(
      assignmentId,
      mutation,
      (id) => this.get(id),
    );
  }
}
