import { displayName } from '../utils/format';
import { exchangeName } from '../rules/explorer/exchanges';
import { usePrimaryName } from './useData';

/**
 * The name to show for an address: the given one, else the cached primary
 * name; an exchange's deposit account without one shows the exchange
 * ("TradeOgre", rules/explorer/exchanges.ts).
 */
export function useDisplayName(
  address: string,
  known?: string | null
): { name: string | null; label: string } {
  const lookup = usePrimaryName(known === undefined ? address : null);
  const name = known === undefined ? (lookup.data ?? null) : known;
  return {
    name,
    label: name
      ? displayName(name, address)
      : (exchangeName(address) ?? displayName(name, address)),
  };
}
