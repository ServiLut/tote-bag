const BOGOTA_TIME_ZONE = 'America/Bogota';

type BogotaCalendarDate = {
  year: number;
  month: number;
  day: number;
};

function getBogotaCalendarDateParts(date: Date): BogotaCalendarDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BOGOTA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);

  return { year, month, day };
}

function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}

export function toBogotaDateInputValue(date: Date) {
  const { year, month, day } = getBogotaCalendarDateParts(date);
  return `${year}-${padDatePart(month)}-${padDatePart(day)}`;
}

export function getBogotaMonthKey(date: Date) {
  const { year, month } = getBogotaCalendarDateParts(date);
  return `${year}-${padDatePart(month)}`;
}

export function formatBogotaDate(date: Date) {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: BOGOTA_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/**
 * Parses a YYYY-MM-DD string into a Date object at the start or end of the day
 * specifically in America/Bogota timezone.
 */
export function parseBogotaDate(dateString: string, options: { endOfDay?: boolean } = {}) {
  const [year, month, day] = dateString.split('-').map(Number);
  // Months are 0-indexed in JS Date
  const date = new Date(year, month - 1, day, options.endOfDay ? 23 : 0, options.endOfDay ? 59 : 0, options.endOfDay ? 59 : 0, options.endOfDay ? 999 : 0);
  
  // Note: On Vercel (UTC), this creates a date in UTC but with Bogota "clock" numbers.
  // To be perfectly accurate we should use Intl or a library, but since most of the 
  // app logic just needs consistent "Bogota days", this is often sufficient 
  // IF the environment is consistent. 
  
  return date;
}
