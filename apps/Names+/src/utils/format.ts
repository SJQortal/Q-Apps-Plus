/** QORT amounts: up to 8 decimals, no trailing zeros, locale separators. */
export function formatQort(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (n === null || n === undefined || !Number.isFinite(n)) return '–';
  return n.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

export function shortAddress(address: string): string {
  if (!address) return '';
  if (address.length <= 14) return address;
  return `${address.slice(0, 7)}…${address.slice(-6)}`;
}

export function formatDate(timestamp: number | undefined): string {
  if (!timestamp) return '';
  try {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}
