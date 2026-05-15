import { HealthController } from './health.controller';
import {
  resetRuntimeDependencyState,
  setCacheRuntimeStatus,
} from './runtime-dependency-state';

describe('HealthController', () => {
  const prisma = {
    $queryRaw: jest.fn(),
  };

  const cacheManager = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  };

  let controller: HealthController;

  beforeEach(() => {
    jest.clearAllMocks();
    resetRuntimeDependencyState();
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    cacheManager.set.mockResolvedValue('ok');
    cacheManager.get.mockResolvedValue('probe-value');
    cacheManager.del.mockResolvedValue(true);
    controller = new HealthController(prisma as never, cacheManager as never);
  });

  afterEach(() => {
    resetRuntimeDependencyState();
  });

  it('keeps memory fallback degraded without probing the cache store', async () => {
    const result = await controller.getHealth();

    expect(result.status).toBe('degraded');
    expect(result.dependencies.cache).toEqual({
      status: 'degraded',
      mode: 'memory',
      configured: false,
      reason: 'missing_url',
    });
    expect(cacheManager.set).not.toHaveBeenCalled();
  });

  it('reports redis as down when runtime probing fails', async () => {
    setCacheRuntimeStatus({
      status: 'up',
      mode: 'redis',
      configured: true,
    });
    cacheManager.set.mockRejectedValue(new Error('redis unavailable'));

    const result = await controller.getHealth();

    expect(result.status).toBe('degraded');
    expect(result.dependencies.cache).toEqual({
      status: 'down',
      mode: 'redis',
      configured: true,
      reason: 'runtime_unavailable',
    });
  });
});
