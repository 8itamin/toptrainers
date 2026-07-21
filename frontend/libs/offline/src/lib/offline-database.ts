import Dexie, { type EntityTable } from 'dexie';

export interface PendingMutation {
  id: string;
  endpoint: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  payload: Record<string, unknown>;
  clientOperationId: string;
  createdAt: string;
}

/**
 * The PWA creates this database only in the browser. SSR must never import this
 * library; Nx tags enforce that separation.
 */
export class TopTrainersOfflineDatabase extends Dexie {
  readonly mutationQueue!: EntityTable<PendingMutation, 'id'>;

  public constructor() {
    super('toptrainers-offline');
    this.version(1).stores({
      mutationQueue: 'id, createdAt, endpoint, clientOperationId',
    });
  }
}

export function createOfflineDatabase(): TopTrainersOfflineDatabase {
  return new TopTrainersOfflineDatabase();
}
