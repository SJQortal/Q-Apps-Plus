import { QSHARE_FILE_BASE } from "../constants/Identifiers";
import { searchQdnAll } from "./qdnSearch";

/**
 * The network statistics that used to load on every visit to Home with an
 * unlimited search. They now load on demand from Settings, in bounded pages,
 * and are kept for an hour on this device.
 */
export const STATS_STORAGE_KEY = "qshareplus-share-stats";
export const STATS_TTL_MS = 60 * 60 * 1000;
export const STATS_MAX_ROWS = 3000;

export interface ShareStats {
  shares: number;
  publishers: number;
  /** false when the count stopped at STATS_MAX_ROWS */
  complete: boolean;
  at: number;
}

export function readCachedShareStats(now = Date.now()): ShareStats | null {
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ShareStats;
    if (typeof parsed?.at !== "number" || now - parsed.at > STATS_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function loadShareStats(fresh = false): Promise<ShareStats> {
  if (!fresh) {
    const cached = readCachedShareStats();
    if (cached) return cached;
  }
  const pageSize = 100;
  const { rows, complete } = await searchQdnAll(
    { service: "DOCUMENT", identifier: QSHARE_FILE_BASE, includemetadata: false },
    { pageSize, maxPages: STATS_MAX_ROWS / pageSize, fresh: true }
  );
  const stats: ShareStats = {
    shares: rows.length,
    publishers: new Set(rows.map((r) => r.name)).size,
    complete,
    at: Date.now(),
  };
  try {
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // storage may be unavailable; the numbers still show for this visit
  }
  return stats;
}
