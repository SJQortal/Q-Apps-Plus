/**
 * "Sent by this account, waiting to be confirmed": what the account sent
 * that isn't in a block yet, read from the node's mempool by its public key
 * (data/explorer/accountTx.ts, 20 s, never polled), of the kind, type and
 * name picked (the tab leaves it out when the time picked ends before now).
 * Nothing shows when there is none. What others sent to it can't be found
 * until it is in a block (Core records who a transaction involves only at
 * confirmation), and the section says so.
 */
import { Typography } from '@mui/material';
import { Section } from '../../../../components/common/Section';
import { TxList } from '../../../../components/explorer/TxListRow';
import { useTxSearch } from '../../../../components/explorer/search/useTxSearch';
import { getUnconfirmedOf, unconfirmedKey } from '../../../../data/explorer/accountTx';
import { useQuery } from '../../../../hooks/useQuery';
import {
  isAboutName,
  typesToAsk,
  type TxFilters,
} from '../../../../rules/explorer/accountTxFilters';

export const WAITING_TITLE = 'Sent by this account, waiting to be confirmed';

export function WaitingSection({
  address,
  publicKey,
  filters,
  search = '',
}: {
  address: string;
  publicKey: string;
  filters: TxFilters;
  /** The tab's search: only the waiting ones it finds (matching or similar). */
  search?: string;
}) {
  const waiting = useQuery(unconfirmedKey(publicKey), (force) =>
    getUnconfirmedOf(publicKey, { force })
  );
  const types = typesToAsk(filters);
  const kept = (waiting.data ?? []).filter(
    (tx) =>
      types !== null &&
      (!types.length || types.includes(tx.type)) &&
      (!filters.name || isAboutName(tx, filters.name))
  );
  const { tiers } = useTxSearch(kept, address, search);
  const rows = tiers ? [...tiers.match, ...tiers.similar] : kept;
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
