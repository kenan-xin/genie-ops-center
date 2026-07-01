const RTF = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Compact "last active" phrasing — native Intl, no date library. Shared by
 * account sessions (ticket 05) and the admin People directory (ticket 06).
 */
export function relativeTime(when: string | Date): string {
  const diff = new Date(when).getTime() - Date.now();
  const abs = Math.abs(diff);
  if (abs < HOUR) return RTF.format(Math.round(diff / MINUTE), "minute");
  if (abs < DAY) return RTF.format(Math.round(diff / HOUR), "hour");
  return RTF.format(Math.round(diff / DAY), "day");
}
