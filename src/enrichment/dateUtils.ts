export function toIsoDate(year: number, month: number, day: number): string | null {
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function toYearOnlyIso(year: number, minimumYear = 2000): string | null {
  const currentYear = new Date().getFullYear();
  if (year < minimumYear || year > currentYear) {
    return null;
  }

  return `${year}-01-01`;
}

export function julianToIsoDate(year: number, dayOfYear: number): string | null {
  if (dayOfYear < 1 || dayOfYear > 366) return null;
  const d = new Date(Date.UTC(year, 0, dayOfYear));
  if (d.getUTCFullYear() !== year) return null;
  return toIsoDate(year, d.getUTCMonth() + 1, d.getUTCDate());
}

export function toYearMonthIso(year: number, month: number, minimumYear = 2000): string | null {
  if (month < 1 || month > 12) {
    return null;
  }

  const yearOnly = toYearOnlyIso(year, minimumYear);
  if (!yearOnly) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-01`;
}
