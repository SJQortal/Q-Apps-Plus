/**
 * The account page's Refresh: every read about this one account is marked
 * stale (the views on screen reload theirs; the rest reload when next
 * read). Shared reads (the online list, the member list, names of other
 * accounts) are left alone. Each Explorer loader keyed by address uses one
 * of these prefixes, followed by the address.
 */
import { invalidate } from '../../../data/query';

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
  'xqdn:',
  'xmade:',
  'xanswers:',
  'xsponsor:',
  'xfunded:',
  // The app's reads it shares.
  'account:',
  'name:',
  'status:',
  'balance:',
  'membership:',
] as const;

export function refreshAccount(address: string, publicKey?: string): void {
  for (const prefix of ACCOUNT_KEY_PREFIXES) invalidate(`${prefix}${address}`);
  if (publicKey) invalidate(`xunconf:${publicKey}`);
}
