import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { RUNTIME_CONFIG, type RuntimeConfig } from '@toptrainers/shared/config';
import {
  CLIENTS_OPERATIONS,
  type ClientCardPage,
  type ClientCardResponse,
  type ClientCardWrite,
  type IssuedJoinInvitation,
  type JoinPreview,
  type RelationshipResponse,
  type TrainerClientSummary,
} from '@toptrainers/shared/contracts';
import { apiUrl } from './api-url';

export function clientOperationPath(
  operation: keyof typeof CLIENTS_OPERATIONS,
  id?: string,
): `/${string}` {
  const path: string = CLIENTS_OPERATIONS[operation].path;
  if (path.includes('{') && !id) throw new Error('Resource id is required');
  return path.replace(/\{[^}]+\}/g, encodeURIComponent(id || '')) as `/${string}`;
}

@Injectable({ providedIn: 'root' })
export class ClientsApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject<RuntimeConfig>(RUNTIME_CONFIG);
  private url(operation: keyof typeof CLIENTS_OPERATIONS, id?: string) {
    return apiUrl(this.config, clientOperationPath(operation, id));
  }
  list(group = 'all', query = '', cursor = '') {
    return this.http.get<ClientCardPage>(this.url('list'), {
      params: { group, query, cursor, limit: 30 },
    });
  }
  create(payload: ClientCardWrite) {
    return this.http.post<ClientCardResponse>(this.url('create'), payload);
  }
  update(id: string, payload: ClientCardWrite) {
    return this.http.patch<ClientCardResponse>(this.url('update', id), payload);
  }
  invite(id: string, email = false) {
    return this.http.post<IssuedJoinInvitation>(this.url(email ? 'email' : 'invite', id), {});
  }
  cancelInvite(id: string) {
    return this.http.post<void>(this.url('cancel', id), {});
  }
  preview(token: string) {
    return this.http.post<JoinPreview>(this.url('preview'), { token });
  }
  accept(token: string) {
    return this.http.post<RelationshipResponse>(this.url('accept'), { token });
  }
  terminate(id: string) {
    return this.http.post<RelationshipResponse>(this.url('terminate', id), {});
  }
  summary(id: string) {
    return this.http.get<TrainerClientSummary>(this.url('summary', id));
  }
}
