/**
 * A transaction's raw API response as the Explorer shows it (in a list
 * row's "Raw API response" and on its own page): Core's JSON, with what
 * must never show taken out: what a message says, and what identifies an
 * encrypted QDN resource.
 */
import type { TxRow } from '../../data/types';
import { isPrivateService, serviceName } from './qdnServices';

export const NOT_SHOWN = '(not shown)';

/** The fields of an encrypted resource's transaction that would tell what it holds. */
const PRIVATE_QDN_FIELDS = ['identifier', 'data', 'secret', 'metadataHash'];

/**
 * The transaction as raw data for the screen: Core's JSON, less a message's
 * content and an encrypted resource's identifier and data.
 */
export function rawForDisplay(tx: TxRow): Record<string, unknown> {
  const shown: Record<string, unknown> = { ...tx };
  if ((tx.type === 'MESSAGE' || tx.type === 'CHAT') && 'data' in shown) shown.data = NOT_SHOWN;
  if (tx.type === 'ARBITRARY' && isPrivateService(serviceName(tx.service)))
    for (const key of PRIVATE_QDN_FIELDS) if (key in shown) shown[key] = NOT_SHOWN;
  return shown;
}
