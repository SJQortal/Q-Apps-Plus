/**
 * Profile Cache Utilities
 * 
 * Manages temporary profile storage in IndexedDB to handle page refreshes
 * while blockchain confirmation is pending.
 * 
 * CACHE STRATEGY:
 * - When a user creates their profile, it's saved to the blockchain
 * - Blockchain confirmation can take time, so we cache the profile data locally
 * - Cache expires after 5 minutes
 * - Cache is stored per Qortal name to support multiple accounts
 * - On page refresh, if cache is valid and matches the current user, user can access the app immediately
 * - Once blockchain confirms, you should call clearProfileCache(qortalName) to remove temporary data
 * 
 * USAGE:
 * 1. After profile creation: await saveProfileToCache(qortalName, profileData)
 * 2. On app initialization: await loadProfileFromCache(qortalName) (automatically called in useInitializeProfile hook)
 * 3. After blockchain confirmation: await clearProfileCache(qortalName)
 */

const DB_NAME = 'qortal_social_db';
const STORE_NAME = 'profile_cache';
const CACHE_KEY_PREFIX = 'user_profile_';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Generate cache key for a specific Qortal name
 */
const getCacheKey = (qortalName: string): string => {
  return `${CACHE_KEY_PREFIX}${qortalName}`;
};

interface CachedProfile {
  bio: string;
  qortalName?: string;
  avatar?: string;
  timestamp: number;
}

/**
 * Initialize IndexedDB and return database instance
 */
const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

/**
 * Save profile data to IndexedDB with current timestamp
 * @param qortalName - The Qortal name of the user (used as cache key)
 * @param profileData - The profile data to cache
 */
export const saveProfileToCache = async (
  qortalName: string,
  profileData: Omit<CachedProfile, 'timestamp'>
): Promise<void> => {
  try {
    if (!qortalName) {
      console.error('Cannot save profile to cache without a Qortal name');
      return;
    }

    const db = await initDB();
    const cacheData: CachedProfile = {
      ...profileData,
      timestamp: Date.now(),
    };

    const cacheKey = getCacheKey(qortalName);
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put(cacheData, cacheKey);

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error('Failed to save profile to cache:', error);
  }
};

/**
 * Load profile data from IndexedDB if it exists and is within 5 minutes
 * Returns null if cache doesn't exist, has expired, or doesn't match the current user
 * @param qortalName - The Qortal name of the currently authenticated user
 */
export const loadProfileFromCache = async (qortalName?: string): Promise<Omit<CachedProfile, 'timestamp'> | null> => {
  try {
    if (!qortalName) {
      return null;
    }

    const db = await initDB();
    const cacheKey = getCacheKey(qortalName);
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(cacheKey);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        db.close();
        
        const cacheData = request.result as CachedProfile | undefined;
        
        if (!cacheData) {
          resolve(null);
          return;
        }

        const now = Date.now();
        const age = now - cacheData.timestamp;

        // Check if cache is still valid (within 5 minutes)
        if (age > CACHE_DURATION) {
          // Cache expired, remove it
          clearProfileCache(qortalName);
          resolve(null);
          return;
        }

        // Verify the cached profile matches the current user
        if (cacheData.qortalName !== qortalName) {
          resolve(null);
          return;
        }

        // Return cached data without timestamp
        const { timestamp, ...profileData } = cacheData;
        resolve(profileData);
      };

      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Failed to load profile from cache:', error);
    return null;
  }
};

/**
 * Clear the profile cache from IndexedDB for a specific user
 * @param qortalName - The Qortal name of the user whose cache should be cleared
 */
export const clearProfileCache = async (qortalName?: string): Promise<void> => {
  try {
    if (!qortalName) {
      return;
    }

    const db = await initDB();
    const cacheKey = getCacheKey(qortalName);
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.delete(cacheKey);

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    });
  } catch (error) {
    console.error('Failed to clear profile cache:', error);
  }
};

/**
 * Check if cached profile exists and is still valid for a specific user
 * @param qortalName - The Qortal name of the user to check
 */
export const hasCachedProfile = async (qortalName?: string): Promise<boolean> => {
  const cached = await loadProfileFromCache(qortalName);
  return cached !== null;
};


