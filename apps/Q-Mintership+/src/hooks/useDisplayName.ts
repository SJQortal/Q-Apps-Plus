import { displayName } from '../utils/format';
import { usePrimaryName } from './useData';

/** The name to show for an address: the given one, else the cached primary name. */
export function useDisplayName(
  address: string,
  known?: string | null
): { name: string | null; label: string } {
  const lookup = usePrimaryName(known === undefined ? address : null);
  const name = known === undefined ? (lookup.data ?? null) : known;
  return { name, label: displayName(name, address) };
}
