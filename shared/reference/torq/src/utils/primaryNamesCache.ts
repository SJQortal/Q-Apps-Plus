import localforage from 'localforage';

// Configure localforage for primary names cache
const primaryNamesCache = localforage.createInstance({
  name: 'Quitter-App',
  storeName: 'primaryNames',
  description: 'Caches primary names by address',
});

export interface CachedPrimaryName {
  address: string;
  name: string | null;
  timestamp: number; // When it was cached
}

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Gets the cached primary name for an address if not expired
 */
export async function getCachedPrimaryName(
  address: string
): Promise<string | null | undefined> {
  try {
    const cached = await primaryNamesCache.getItem<CachedPrimaryName>(address);

    if (!cached) {
      return undefined; // Not in cache
    }

    const now = Date.now();
    const age = now - cached.timestamp;

    if (age > CACHE_DURATION) {
      // Cache expired, remove it
      await primaryNamesCache.removeItem(address);
      return undefined;
    }

    // Return cached name (could be null if user has no primary name)
    return cached.name;
  } catch (error) {
    console.error(`Error getting cached primary name for ${address}:`, error);
    return undefined;
  }
}

/**
 * Caches a primary name for an address
 */
export async function setCachedPrimaryName(
  address: string,
  name: string | null
): Promise<void> {
  try {
    const cached: CachedPrimaryName = {
      address,
      name,
      timestamp: Date.now(),
    };
    await primaryNamesCache.setItem(address, cached);
  } catch (error) {
    console.error(`Error caching primary name for ${address}:`, error);
  }
}

/**
 * Clears all cached primary names
 */
export async function clearPrimaryNamesCache(): Promise<void> {
  try {
    await primaryNamesCache.clear();
  } catch (error) {
    console.error('Error clearing primary names cache:', error);
  }
}

/**
 * Removes expired entries from the cache
 */
export async function cleanupExpiredPrimaryNames(): Promise<void> {
  try {
    const now = Date.now();
    const keys = await primaryNamesCache.keys();

    for (const key of keys) {
      const cached = await primaryNamesCache.getItem<CachedPrimaryName>(key);
      if (cached && now - cached.timestamp > CACHE_DURATION) {
        await primaryNamesCache.removeItem(key);
      }
    }
  } catch (error) {
    console.error('Error cleaning up expired primary names:', error);
  }
}
