import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

interface DebugRoleStore {
  debugRole: string | null;
}

@Injectable()
export class DebugRoleContextService {
  private readonly storage = new AsyncLocalStorage<DebugRoleStore>();

  run<T>(debugRole: string | null, callback: () => T): T {
    return this.storage.run({ debugRole }, callback);
  }

  getDebugRole() {
    return this.storage.getStore()?.debugRole ?? null;
  }
}
