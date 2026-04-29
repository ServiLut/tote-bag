export type RuntimeDependencyStatus = 'up' | 'degraded' | 'down';

export type CacheRuntimeStatus = {
  status: Extract<RuntimeDependencyStatus, 'up' | 'degraded'>;
  mode: 'redis' | 'memory';
  configured: boolean;
  reason?: 'missing_url' | 'connection_failed';
};

const defaultCacheRuntimeStatus: CacheRuntimeStatus = {
  status: 'degraded',
  mode: 'memory',
  configured: false,
  reason: 'missing_url',
};

let cacheRuntimeStatus: CacheRuntimeStatus = {
  ...defaultCacheRuntimeStatus,
};

export function getCacheRuntimeStatus(): CacheRuntimeStatus {
  return {
    ...cacheRuntimeStatus,
  };
}

export function setCacheRuntimeStatus(status: CacheRuntimeStatus) {
  cacheRuntimeStatus = {
    ...status,
  };
}

export function resetRuntimeDependencyState() {
  cacheRuntimeStatus = {
    ...defaultCacheRuntimeStatus,
  };
}
