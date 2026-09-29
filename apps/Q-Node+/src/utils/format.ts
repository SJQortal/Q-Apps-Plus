/** "1d 2h 3m 4s" for a duration in seconds; empty for 0 or bad input. */
export function secondsToDhms(seconds: number | undefined | null): string {
  const total = Math.floor(Number(seconds));
  if (!Number.isFinite(total) || total <= 0) return '';

  const d = Math.floor(total / (3600 * 24));
  const h = Math.floor((total % (3600 * 24)) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  return [
    d > 0 ? `${d}d` : '',
    h > 0 ? `${h}h` : '',
    m > 0 ? `${m}m` : '',
    s > 0 ? `${s}s` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

/** "qortal-5.0.2" -> "v5.0.2"; anything else unchanged. */
export function formatCoreVersion(version: string | undefined | null): string {
  if (!version) return '';
  return version.replace(/^qortal-/, 'v');
}
