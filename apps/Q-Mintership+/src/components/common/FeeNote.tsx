/** "Fee: 0.01 QORT" for one transaction type, from Core's unitfee (cached). */
import { Typography } from '@mui/material';
import { formatQort } from '../../data/accounts';
import type { GroupTxType } from '../../data/types';
import { useFee } from '../../hooks/useFee';

export function FeeNote({
  txType,
  times = 1,
  prefix = 'Fee',
}: {
  txType: GroupTxType | 'ARBITRARY';
  times?: number;
  prefix?: string;
}) {
  const fee = useFee(txType);
  const qort = (fee.data?.qort ?? 0.01) * times;
  return (
    <Typography component="span" variant="body2" color="text.secondary">
      {prefix}: {formatQort(qort)}
      {times > 1 ? ` (${times} × ${formatQort(fee.data?.qort ?? 0.01)})` : ''}
      {fee.data?.estimated ? ' (estimated)' : ''}
    </Typography>
  );
}
