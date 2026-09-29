import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';

import { RUNTIME_CONFIG, type RuntimeConfig } from '@toptrainers/shared/config';
import {
  WORKOUT_OPERATIONS,
  type WorkoutCreate,
  type WorkoutResponse,
} from '@toptrainers/shared/contracts';

import { apiUrl } from './api-url';

export type WorkoutOperation = keyof typeof WORKOUT_OPERATIONS;

export function workoutOperationPath(operation: WorkoutOperation, workoutId?: string): `/${string}` {
  const path = WORKOUT_OPERATIONS[operation].relativePath;
  if (operation !== 'replace') return path;
  if (!workoutId) throw new Error('Workout id is required for replace');
  return path.replace('{workout_id}', encodeURIComponent(workoutId)) as `/${string}`;
}

@Injectable({ providedIn: 'root' })
export class WorkoutsApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject<RuntimeConfig>(RUNTIME_CONFIG);

  list(): Observable<WorkoutResponse[]> {
    return this.http.get<WorkoutResponse[]>(apiUrl(this.config, workoutOperationPath('list')));
  }

  create(payload: WorkoutCreate): Observable<WorkoutResponse> {
    return this.http.post<WorkoutResponse>(apiUrl(this.config, workoutOperationPath('create')), payload);
  }

  replace(workoutId: string, payload: WorkoutCreate): Observable<WorkoutResponse> {
    return this.http.put<WorkoutResponse>(
      apiUrl(this.config, workoutOperationPath('replace', workoutId)), payload,
    );
  }
}
