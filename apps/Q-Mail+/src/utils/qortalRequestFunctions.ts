import type { NameRecord } from '../state/features/authSlice';

export async function getAccountNames(address: string): Promise<NameRecord[]> {
  try {
    const list = await qortalRequest({
      action: 'GET_ACCOUNT_NAMES',
      address,
    });
    if (Array.isArray(list) && list.length) return list;
    return [{ name: '', owner: address }];
  } catch {
    return [{ name: '', owner: address }];
  }
}

export async function getPrimaryAccountName(address: string): Promise<string> {
  try {
    const res = await qortalRequest({
      action: 'GET_PRIMARY_NAME',
      address,
    });
    return typeof res === 'string' ? res : '';
  } catch {
    return '';
  }
}
