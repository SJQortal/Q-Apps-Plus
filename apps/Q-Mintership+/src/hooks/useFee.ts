import { getFee } from '../data/accounts';
import type { GroupTxType } from '../data/types';
import { useQuery } from './useQuery';

/** Core's fee for one transaction type (cached 30 minutes). */
export function useFee(txType: GroupTxType | 'ARBITRARY') {
  return useQuery(`fee:${txType}`, () => getFee(txType));
}
