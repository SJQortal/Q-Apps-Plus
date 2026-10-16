/**
 * "Sent by this account, waiting to be confirmed": what the account sent
 * that isn't in a block yet, read from the node's mempool by its public key
 * (data/explorer/accountTx.ts, 20 s, never polled), in the family picked.
 * Nothing shows when there is none. What others sent to it can't be found
 * until it is in a block (Core records who a transaction involves only at
 * confirmation), and the section says so.
 */
import { Typography } from '@mui/material';
import { Section } from '../../../../components/common/Section';
import { TxList } from '../../../../components/explorer/TxListRow';
import { getUnconfirmedOf, unconfirmedKey } from '../../../../data/explorer/accountTx';
import { useQuery } from '../../../../hooks/useQuery';
import { typesFor, type TxFamilyKey } from '../../../../rules/explorer/txFamilies';

export const WAITING_TITLE = 'Sent by this account, waiting to be confirmed';

export function WaitingSection({
  address,
  publicKey,
  family,
}: {
  address: string;
  publicKey: string;
  family: TxFamilyKey;
}) {
  const waiting = useQuery(unconfirmedKey(publicKey), (force) =>
    getUnconfirmedOf(publicKey, { force })
  );
  const types: readonly string[] = typesFor(family);
  const rows = (waiting.data ?? []).filter((tx) => !types.length || types.includes(tx.type));
  if (!rows.length) return null;
  return (
    <Section title={WAITING_TITLE} id="explorer-account-waiting" count={rows.length}>
      <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
        Your node holds these until a block takes them. Transactions sent to this account show only
        once they are in a block.
      </Typography>
      <TxList rows={rows} viewpoint={address} label={WAITING_TITLE} />
    </Section>
  );
}
