import {
  formatBogotaDate,
  getBogotaMonthKey,
  toBogotaDateInputValue,
} from '../bogota-date';

describe('bogota-date helpers', () => {
  it('uses the Bogota business date for date inputs', () => {
    expect(toBogotaDateInputValue(new Date('2026-03-01T02:00:00.000Z'))).toBe(
      '2026-02-28',
    );
  });

  it('builds month comparisons using the Bogota calendar', () => {
    expect(getBogotaMonthKey(new Date('2026-03-01T02:00:00.000Z'))).toBe(
      '2026-02',
    );
  });

  it('formats transaction dates in the Bogota timezone', () => {
    expect(formatBogotaDate(new Date('2026-03-01T02:00:00.000Z'))).toBe(
      '28/02/2026',
    );
  });
});
