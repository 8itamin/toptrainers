import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { RUNTIME_CONFIG, type RuntimeConfig } from '@toptrainers/shared/config';
import {
  WORKOUT_HISTORY_OPERATIONS,
  type WorkoutHistoryPage,
} from '@toptrainers/shared/contracts';

import { apiUrl } from './api-url';

export type WorkoutHistoryOperation = keyof typeof WORKOUT_HISTORY_OPERATIONS;

export function workoutHistoryOperationPath(
  operation: WorkoutHistoryOperation,
  clientId?: string,
): `/${string}` {
  const path = WORKOUT_HISTORY_OPERATIONS[operation].relativePath;
  if (operation === 'client') return path;
  if (!clientId) throw new Error('Client id is required for Trainer workout history');
  return path.replace('{client_id}', encodeURIComponent(clientId)) as `/${string}`;
}

export function workoutHistoryQueryParams(
  cursor?: string,
  limit = 20,
): { limit: number; cursor?: string } {
  return cursor ? { limit, cursor } : { limit };
}

@Injectable({ providedIn: 'root' })
export class WorkoutHistoryApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject<RuntimeConfig>(RUNTIME_CONFIG);

  listClient(cursor?: string, limit = 20): Observable<WorkoutHistoryPage> {
    return this.http.get<WorkoutHistoryPage>(
      apiUrl(this.config, workoutHistoryOperationPath('client')),
      { params: workoutHistoryQueryParams(cursor, limit) },
    );
  }

  listTrainerClient(
    clientId: string,
    cursor?: string,
    limit = 20,
  ): Observable<WorkoutHistoryPage> {
    return this.http.get<WorkoutHistoryPage>(
      apiUrl(this.config, workoutHistoryOperationPath('trainer', clientId)),
      { params: workoutHistoryQueryParams(cursor, limit) },
    );
  }
}
