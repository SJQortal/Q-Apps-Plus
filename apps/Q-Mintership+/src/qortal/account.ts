/**
 * Accounts, names and public keys (legacy QortalApi.js "USER-RELATED QORTAL
 * CALLS"). Everything read here is public, so it comes from Core's REST API
 * and is cached for the session.
 */
import { coreGet, coreJson, coreText, qortal, safeText } from './client';
import { memoizeAsync } from './cache';
import { isQortalAddress, trimString } from './util';

export interface AddressInfo {
  address: string;
  reference: string;
  publicKey: string;
  defaultGroupId: number;
  flags: number;
  level: number;
  blocksMinted: number;
  blocksMintedAdjustment: number;
  blocksMintedPenalty: number;
}

export interface NameInfo {
  name: string;
  reducedName: string;
  owner: string;
  data: string;
  registered: number;
  updated?: number;
  isForSale: boolean;
  salePrice?: string | number | null;
}

export interface AssetBalance {
  assetId: number;
  assetName?: string;
  balance: string;
  address?: string;
}

export interface UserAccount {
  address: string;
  publicKey: string;
}

export interface AccountName {
  name: string;
  owner?: string;
}

const addressInfoCache = new Map<string, AddressInfo | null>();
const addressInfoInflight = new Map<string, Promise<AddressInfo | null>>();
const nameInfoCache = new Map<string, NameInfo | null>();
const nameInfoInflight = new Map<string, Promise<NameInfo | null>>();
const nameToAddressCache = new Map<string, string | null>();
const nameToAddressInflight = new Map<string, Promise<string | null>>();
const publicKeyAddressCache = new Map<string, string | null>();
const publicKeyAddressInflight = new Map<string, Promise<string | null>>();
const addressNamesCache = new Map<string, string>();
const addressNamesInflight = new Map<string, Promise<string>>();

export function resetAccountCaches(): void {
  addressInfoCache.clear();
  nameInfoCache.clear();
  nameToAddressCache.clear();
  publicKeyAddressCache.clear();
  addressNamesCache.clear();
}

/** GET_USER_ACCOUNT: the logged-in address and public key. */
export async function getUserAccount(): Promise<UserAccount> {
  const account = await qortal<UserAccount | null>({ action: 'GET_USER_ACCOUNT' });
  if (!account?.address) throw new Error('No Qortal account is logged in.');
  return account;
}

export async function getUserAddress(): Promise<string> {
  return (await getUserAccount()).address;
}

/** GET_ACCOUNT_NAMES: every registered name on an address (the first is the account name). */
export async function getAccountNames(address: string): Promise<AccountName[]> {
  const names = await qortal<AccountName[] | null>({ action: 'GET_ACCOUNT_NAMES', address });
  return Array.isArray(names) ? names : [];
}

/**
 * `/addresses/{address}`. Returns null for an invalid address (the legacy
 * function returned the input string in that case) and throws on a network
 * error.
 */
export async function getAddressInfo(address: string): Promise<AddressInfo | null> {
  const normalized = trimString(address);
  if (!isQortalAddress(normalized)) return null;
  const data = await coreJson<Record<string, unknown>>(`/addresses/${normalized}`);
  return {
    address: String(data.address ?? normalized),
    reference: String(data.reference ?? ''),
    publicKey: String(data.publicKey ?? ''),
    defaultGroupId: Number(data.defaultGroupId ?? 0),
    flags: Number(data.flags ?? 0),
    level: Number(data.level ?? 0),
    blocksMinted: Number(data.blocksMinted ?? 0),
    blocksMintedAdjustment: Number(data.blocksMintedAdjustment ?? 0),
    blocksMintedPenalty: Number(data.blocksMintedPenalty ?? 0),
  };
}

export function getAddressInfoCached(address: string): Promise<AddressInfo | null> {
  const key = trimString(address);
  return memoizeAsync(addressInfoCache, addressInfoInflight, key, () => getAddressInfo(key));
}

/** `/addresses/balance/{address}` as text; null when the address is invalid or the call fails. */
export async function getAddressBalance(address: string): Promise<string | null> {
  const normalized = trimString(address);
  if (!isQortalAddress(normalized)) return null;
  try {
    const text = (await coreText(`/addresses/balance/${normalized}`)).trim();
    return text || null;
  } catch {
    return null;
  }
}

/** `/assets/balances?address=…` (all assets for one address). Empty on failure. */
export async function getAddressAssetBalances(address: string): Promise<AssetBalance[]> {
  const normalized = trimString(address);
  if (!isQortalAddress(normalized)) return [];
  try {
    const data = await coreJson<AssetBalance[] | { balances?: AssetBalance[] }>(
      `/assets/balances?address=${encodeURIComponent(normalized)}&ordering=ASSET_BALANCE_ACCOUNT&limit=0`
    );
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.balances)) return data.balances;
    return [];
  } catch {
    return [];
  }
}

/** `/names/{name}`: null when the name does not exist or the call fails. */
export async function getNameInfo(name: string): Promise<NameInfo | null> {
  try {
    const response = await coreGet(`/names/${encodeURIComponent(name)}`);
    if (!response.ok) return null;
    const data = (await response.json()) as Record<string, unknown>;
    if (!data?.name) return null;
    return {
      name: String(data.name),
      reducedName: String(data.reducedName ?? ''),
      owner: String(data.owner ?? ''),
      data: String(data.data ?? ''),
      registered: Number(data.registered ?? 0),
      updated: data.updated === undefined ? undefined : Number(data.updated),
      isForSale: Boolean(data.isForSale),
      salePrice: (data.salePrice as string | number | null | undefined) ?? null,
    };
  } catch {
    return null;
  }
}

export function getNameInfoCached(name: string): Promise<NameInfo | null> {
  return memoizeAsync(nameInfoCache, nameInfoInflight, name, () => getNameInfo(name));
}

/** The owner address of a registered name, or null. */
export async function fetchOwnerAddressFromName(name: string): Promise<string | null> {
  try {
    const response = await coreGet(`/names/${encodeURIComponent(name)}`);
    const data = (await response.json()) as { owner?: string };
    return data?.owner ?? null;
  } catch {
    return null;
  }
}

export function fetchOwnerAddressFromNameCached(name: string): Promise<string | null> {
  return memoizeAsync(nameToAddressCache, nameToAddressInflight, name, () =>
    fetchOwnerAddressFromName(name)
  );
}

export async function getPublicKeyFromAddress(address: string): Promise<string | null> {
  try {
    const data = await coreJson<{ publicKey?: string }>(`/addresses/${address}`);
    return data.publicKey ?? null;
  } catch {
    return null;
  }
}

export async function getPublicKeyByName(name: string): Promise<string | null> {
  const info = await getNameInfo(name);
  if (!info?.owner) return null;
  return getPublicKeyFromAddress(info.owner);
}

/** `/addresses/convert/{publicKey}`; cached, null on failure. */
export function getAddressFromPublicKey(publicKey: string): Promise<string | null> {
  const normalized = trimString(publicKey);
  if (!normalized) return Promise.resolve(null);
  return memoizeAsync(publicKeyAddressCache, publicKeyAddressInflight, normalized, async () => {
    try {
      const response = await coreGet(`/addresses/convert/${normalized}`, 'text/plain');
      const text = trimString(await safeText(response));
      return text || null;
    } catch {
      return null;
    }
  });
}

/** The first registered name on an address, or the address itself when it has none. */
export function getNameFromAddress(address: string): Promise<string> {
  const normalized = trimString(address);
  if (!normalized) return Promise.resolve('');
  return memoizeAsync(addressNamesCache, addressNamesInflight, normalized, async () => {
    try {
      const names = await coreJson<Array<{ name: string }>>(
        `/names/address/${normalized}?limit=20`
      );
      return Array.isArray(names) && names.length > 0 ? names[0].name : normalized;
    } catch {
      return normalized;
    }
  });
}
