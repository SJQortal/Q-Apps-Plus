const AUTO_APPLY_QDN_STATE_STORAGE_PREFIX = "qmail_auto_apply_qdn_state_";

const normalizeAddress = (address?: string | null): string => {
  return typeof address === "string" ? address.trim().toLowerCase() : "";
};

export const getAutoApplyQdnStateStorageKey = (
  address?: string | null
): string => {
  const normalizedAddress = normalizeAddress(address);
  return normalizedAddress
    ? `${AUTO_APPLY_QDN_STATE_STORAGE_PREFIX}${normalizedAddress}`
    : "";
};

export const readAutoApplyQdnState = (address?: string | null): boolean => {
  const storageKey = getAutoApplyQdnStateStorageKey(address);
  if (!storageKey) return false;

  try {
    const rawValue = localStorage.getItem(storageKey);
    if (rawValue === null) return false;
    return JSON.parse(rawValue) === true;
  } catch {
    return false;
  }
};

export const writeAutoApplyQdnState = (
  address?: string | null,
  value?: boolean
): void => {
  const storageKey = getAutoApplyQdnStateStorageKey(address);
  if (!storageKey) return;

  try {
    localStorage.setItem(storageKey, JSON.stringify(Boolean(value)));
  } catch {
    // Ignore storage failures.
  }
};
