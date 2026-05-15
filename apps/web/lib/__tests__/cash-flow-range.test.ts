import { buildCashFlowDateRange } from '../cash-flow-range';

describe('buildCashFlowDateRange', () => {
  it('uses the Bogota business date for the rolling 30-day preset', () => {
    expect(
      buildCashFlowDateRange('30_DAYS', new Date('2026-03-01T02:00:00.000Z')),
    ).toEqual({
      startDate: '2026-01-30',
      endDate: '2026-02-28',
    });
  });

  it('builds the 6-month preset from the Bogota current month', () => {
    expect(
      buildCashFlowDateRange('6_MONTHS', new Date('2026-01-01T02:00:00.000Z')),
    ).toEqual({
      startDate: '2025-07-01',
      endDate: '2025-12-31',
    });
  });

  it('keeps the 12-month preset aligned to the Bogota calendar year window', () => {
    expect(
      buildCashFlowDateRange('YEAR', new Date('2026-01-01T02:00:00.000Z')),
    ).toEqual({
      startDate: '2025-01-01',
      endDate: '2025-12-31',
    });
  });
});
