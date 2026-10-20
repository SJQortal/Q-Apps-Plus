/**
 * The account page's Refresh: every read about this one account is marked
 * stale (the views on screen reload theirs; the rest reload when next
 * read). Shared reads (the online list, the member list, names of other
 * accounts) are left alone. Each Explorer loader keyed by address uses one
 * of these prefixes, followed by the address; the reads keyed by one of its
 * names (its record, what it published on QDN) are reached through the
 * account's names already in the store.
 */
import type { NamesOf } from '../../../data/explorer/account';
import { invalidate, peekQuery } from '../../../data/query';

export const ACCOUNT_KEY_PREFIXES = [
  // The Explorer's own reads (x…:<address>).
  'xacct:',
  'xnames:',
  'xgroups:',
  'xfirst:',
  'xsigned:',
  'xbusy:',
  'xlinks:',
  'xpay:',
  'xassets:',
  'xtx:',
  'xnamehist:',
  'xmade:',
  'xanswers:',
  'xsponsor:',
  'xfunded:',
  'xlastsent:',
  'xlegacyby:',
  'xpollvotes:',
  // The app's reads it shares.
  'account:',
  'name:',
  'status:',
  'balance:',
  'membership:',
  'history:',
  'nominations:for:',
  'declinemarks:',
  'legacy:for:',
  'communityvotes:nominee:',
] as const;

/**
 * The Explorer's reads keyed by a name, followed by the name: its record
 * (`/names/{name}`) and what it published on QDN.
 */
export const NAME_KEY_PREFIXES = ['xnamedata:', 'xqdnname:'] as const;

export function refreshAccount(address: string, publicKey?: string): void {
  for (const prefix of ACCOUNT_KEY_PREFIXES) invalidate(`${prefix}${address}`);
  // The account's names as last read (Refresh reads the list again too).
  const names = peekQuery<NamesOf>(`xnames:${address}`)?.names ?? [];
  for (const name of names) for (const prefix of NAME_KEY_PREFIXES) invalidate(`${prefix}${name}`);
  if (publicKey) invalidate(`xunconf:${publicKey}`);
}
