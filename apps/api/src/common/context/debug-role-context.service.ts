import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Role } from '../../generated/client/enums';

interface DebugRoleStore {
  debugRole: Role | null;
}

@Injectable()
export class DebugRoleContextService {
  private readonly storage = new AsyncLocalStorage<DebugRoleStore>();

  run<T>(debugRole: Role | null, callback: () => T): T {
    return this.storage.run({ debugRole }, callback);
  }

  getDebugRole(): Role | null {
    return this.storage.getStore()?.debugRole ?? null;
  }
}
