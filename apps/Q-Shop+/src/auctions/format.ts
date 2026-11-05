const WHEN = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** "Sun, Oct 25, 8:00 PM", in this device's time ("" for a time no date can show). */
export function whenText(ms: number): string {
  try {
    return WHEN.format(new Date(ms));
  } catch {
    return "";
  }
}

/** "just now", "5 min ago", "3 h ago", then the date. */
export function agoText(ms: number, now: number): string {
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return whenText(ms);
}
