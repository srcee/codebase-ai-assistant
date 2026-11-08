const DAY_MS = 24 * 60 * 60 * 1000;

export function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/** Counts forward over working days only, which is how delivery dates are quoted. */
export function addBusinessDays(start: Date, days: number): Date {
  let current = new Date(start.getTime());
  let remaining = days;
  while (remaining > 0) {
    current = new Date(current.getTime() + DAY_MS);
    if (!isWeekend(current)) remaining--;
  }
  return current;
}

export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
