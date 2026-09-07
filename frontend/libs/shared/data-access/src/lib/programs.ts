import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable } from 'rxjs';

import { RUNTIME_CONFIG, type RuntimeConfig } from '@toptrainers/shared/config';
import {
  PROGRAM_OPERATIONS,
  type IssueProgramRequest,
  type ProgramAssignmentResponse,
  type ProgramCreate,
  type ProgramResponse,
  type ProgramSlotWrite,
  type RelationshipResponse,
} from '@toptrainers/shared/contracts';

import { apiUrl } from './api-url';

export type ProgramOperation = keyof typeof PROGRAM_OPERATIONS;

export function programOperationPath(
  operation: ProgramOperation,
  resourceId?: string,
): `/${string}` {
  const path = PROGRAM_OPERATIONS[operation].relativePath;

  if (operation === 'list' || operation === 'create' || operation === 'listActiveRelationships') {
    return path;
  }

  if (!resourceId) {
    throw new Error(`Resource id is required for ${operation}`);
  }

  return path
    .replace('{program_id}', encodeURIComponent(resourceId))
    .replace('{program_assignment_id}', encodeURIComponent(resourceId)) as `/${string}`;
}

export function replaceProgramSlot(
  slots: readonly ProgramSlotWrite[],
  nextSlot: ProgramSlotWrite,
): ProgramSlotWrite[] {
  return [
    ...slots.filter(
      (slot) =>
        slot.week_number !== nextSlot.week_number || slot.day_number !== nextSlot.day_number,
    ),
    nextSlot,
  ].sort(
    (left, right) => left.week_number - right.week_number || left.day_number - right.day_number,
  );
}

export function canIssueProgram(program: Pick<ProgramResponse, 'slots'>): boolean {
  return program.slots.length > 0;
}

@Injectable({ providedIn: 'root' })
export class ProgramsApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject<RuntimeConfig>(RUNTIME_CONFIG);

  list(): Observable<ProgramResponse[]> {
    return this.http.get<ProgramResponse[]>(apiUrl(this.config, programOperationPath('list')));
  }

  create(payload: ProgramCreate): Observable<ProgramResponse> {
    return this.http.post<ProgramResponse>(
      apiUrl(this.config, programOperationPath('create')),
      payload,
    );
  }

  replace(programId: string, payload: ProgramCreate): Observable<ProgramResponse> {
    return this.http.put<ProgramResponse>(
      apiUrl(this.config, programOperationPath('replace', programId)),
      payload,
    );
  }

  issue(programId: string, payload: IssueProgramRequest): Observable<ProgramAssignmentResponse> {
    return this.http.post<ProgramAssignmentResponse>(
      apiUrl(this.config, programOperationPath('issue', programId)),
      payload,
    );
  }

  cancelIssue(programAssignmentId: string): Observable<ProgramAssignmentResponse> {
    return this.http.post<ProgramAssignmentResponse>(
      apiUrl(this.config, programOperationPath('cancelIssue', programAssignmentId)),
      null,
    );
  }

  listActiveRelationships(): Observable<RelationshipResponse[]> {
    return this.http.get<RelationshipResponse[]>(
      apiUrl(this.config, programOperationPath('listActiveRelationships')),
    );
  }
}
