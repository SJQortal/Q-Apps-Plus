import { useAtomValue } from 'jotai';
import { displayName } from '../utils/format';
import { exchangeName } from '../rules/explorer/exchanges';
import { explorerAccessAtom, hasFullExplorer } from '../state/explorerAccess';
import { useSession } from '../state/session';
import { usePrimaryName } from './useData';

/**
 * The name to show for an address: the given one, else the cached primary
 * name; for a viewer who sees the Explorer's detailed parts
 * (rules/explorer/access.ts), an exchange's deposit account without one shows
 * the exchange ("TradeOgre", rules/explorer/exchanges.ts).
 */
export function useDisplayName(
  address: string,
  known?: string | null
): { name: string | null; label: string } {
  const lookup = usePrimaryName(known === undefined ? address : null);
  const access = useAtomValue(explorerAccessAtom);
  const viewer = useSession().address;
  const name = known === undefined ? (lookup.data ?? null) : known;
  const exchange = hasFullExplorer(access, viewer) ? exchangeName(address) : null;
  return {
    name,
    label: name ? displayName(name, address) : (exchange ?? displayName(name, address)),
  };
}
