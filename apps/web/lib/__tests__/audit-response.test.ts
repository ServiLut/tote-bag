import { normalizeAuditResponse } from '@/lib/audit-response';

describe('normalizeAuditResponse', () => {
  it('normalizes interceptor-wrapped payloads', () => {
    const result = normalizeAuditResponse({
      data: {
        data: [{ id: '1', action: 'POST' }],
        meta: { total: 1, skip: 0, take: 20 },
      },
    });

    expect(result.logs).toEqual([{ id: '1', action: 'POST' }]);
    expect(result.meta).toEqual({ total: 1, skip: 0, take: 20 });
  });

  it('normalizes direct payloads without interceptor wrapper', () => {
    const result = normalizeAuditResponse({
      data: [{ id: '2', action: 'PATCH' }],
      meta: { total: 1, skip: 0, take: 50 },
    });

    expect(result.logs).toEqual([{ id: '2', action: 'PATCH' }]);
    expect(result.meta).toEqual({ total: 1, skip: 0, take: 50 });
  });

  it('returns safe fallbacks for unknown shapes', () => {
    const result = normalizeAuditResponse({ foo: 'bar' });

    expect(result.logs).toEqual([]);
    expect(result.meta).toBeNull();
  });
});
