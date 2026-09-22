import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';

import { RUNTIME_CONFIG, type RuntimeConfig } from '@toptrainers/shared/config';
import {
  TASK_OPERATIONS,
  type SubmitTaskResultRequest,
  type MediaReadUrlResponse,
  type TaskAssignmentResponse,
  type TaskResultVersionResponse,
  type TaskTemplateResponse,
  type TaskTemplateWrite,
} from '@toptrainers/shared/contracts';

import { apiUrl } from './api-url';

function taskPath(
  operation: keyof typeof TASK_OPERATIONS,
  assignmentId?: string,
): `/${string}` {
  const path = TASK_OPERATIONS[operation].relativePath;
  return assignmentId
    ? (path.replace('{assignment_id}', encodeURIComponent(assignmentId)) as `/${string}`)
    : path;
}

@Injectable({ providedIn: 'root' })
export class TasksApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject<RuntimeConfig>(RUNTIME_CONFIG);

  listTemplates(): Observable<TaskTemplateResponse[]> {
    return this.http.get<TaskTemplateResponse[]>(apiUrl(this.config, taskPath('listTemplates')));
  }

  createTemplate(payload: TaskTemplateWrite): Observable<TaskTemplateResponse> {
    return this.http.post<TaskTemplateResponse>(
      apiUrl(this.config, taskPath('createTemplate')),
      payload,
    );
  }

  listClientByDate(scheduledDate: string): Observable<TaskAssignmentResponse[]> {
    return this.http.get<TaskAssignmentResponse[]>(
      apiUrl(this.config, taskPath('listAssignments')),
      { params: { scheduled_date: scheduledDate } },
    );
  }

  submitResult(
    assignmentId: string,
    payload: SubmitTaskResultRequest,
  ): Observable<TaskResultVersionResponse> {
    return this.http.post<TaskResultVersionResponse>(
      apiUrl(this.config, taskPath('submitResult', assignmentId)),
      payload,
    );
  }

  listResults(assignmentId: string): Observable<TaskResultVersionResponse[]> {
    return this.http.get<TaskResultVersionResponse[]>(
      apiUrl(this.config, taskPath('listResults', assignmentId)),
    );
  }

  createResultMediaReadUrl(
    assignmentId: string,
    mediaId: string,
  ): Observable<MediaReadUrlResponse> {
    const path = taskPath('createResultMediaReadUrl', assignmentId).replace(
      '{media_id}',
      encodeURIComponent(mediaId),
    ) as `/${string}`;
    return this.http.post<MediaReadUrlResponse>(apiUrl(this.config, path), null);
  }
}
