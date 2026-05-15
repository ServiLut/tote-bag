export type CashFlowRangePreset = '30_DAYS' | '6_MONTHS' | 'YEAR';

type CalendarDate = {
  year: number;
  month: number;
  day: number;
};

function getBogotaCalendarDate(now: Date): CalendarDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);

  return { year, month, day };
}

function formatUtcDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildUtcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

export function buildCashFlowDateRange(
  timeRange: CashFlowRangePreset,
  now = new Date(),
) {
  const today = getBogotaCalendarDate(now);
  const currentMonthStart = buildUtcDate(today.year, today.month, 1);
  const currentMonthEnd = new Date(Date.UTC(today.year, today.month, 0));

  if (timeRange === '30_DAYS') {
    const endDate = buildUtcDate(today.year, today.month, today.day);
    const startDate = new Date(endDate);
    startDate.setUTCDate(startDate.getUTCDate() - 29);

    return {
      startDate: formatUtcDate(startDate),
      endDate: formatUtcDate(endDate),
    };
  }

  const startDate = new Date(currentMonthStart);
  startDate.setUTCMonth(
    startDate.getUTCMonth() - (timeRange === '6_MONTHS' ? 5 : 11),
  );

  return {
    startDate: formatUtcDate(startDate),
    endDate: formatUtcDate(currentMonthEnd),
  };
}
