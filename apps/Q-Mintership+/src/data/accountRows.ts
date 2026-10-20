/**
 * The reads behind a list of accounts to pick from (the + Propose pages):
 * each row's account (level, blocks minted) and, where the list doesn't
 * already carry it, its primary name. Only for the rows on screen, six reads
 * at a time, each kept as Requested to join MINTER Group keeps its own
 * (10 minutes for an account), so scrolling back costs nothing.
 */
import { getAccount, getPrimaryName } from './accounts';
import { mapLimit } from './qdn';
import { fetchQuery } from './query';
import { READY_ACCOUNT_TTL_MS, READY_READS_AT_ONCE } from './readyToMint';

export async function loadAccountRows(
  addresses: readonly string[],
  options: { names?: boolean; signal?: AbortSignal } = {}
): Promise<void> {
  const reads = addresses.flatMap((address) => [
    () => getAccount(address, { ttlMs: READY_ACCOUNT_TTL_MS }),
    ...(options.names ? [() => getPrimaryName(address)] : []),
  ]);
  await mapLimit(reads, READY_READS_AT_ONCE, async (read) => {
    if (options.signal?.aborted) return;
    await read().catch(() => undefined);
  });
}

/** The key of the primary names of `addresses` (loadPrimaryNames). */
export function primaryNamesKey(addresses: readonly string[]): string {
  return `names:list:${addresses.join(',')}`;
}

/**
 * The primary names of a few accounts at once (each its own cached read,
 * four at a time): those a page labels but hasn't shown, such as the waiting
 * decisions an admin change would tip over (pages/decisions/propose/).
 */
export function loadPrimaryNames(
  addresses: readonly string[],
  options: { force?: boolean } = {}
): Promise<Record<string, string | null>> {
  return fetchQuery(
    primaryNamesKey(addresses),
    async () => {
      const names = await mapLimit([...addresses], 4, (address) =>
        getPrimaryName(address).catch(() => null)
      );
      return Object.fromEntries(addresses.map((address, i) => [address, names[i] ?? null]));
    },
    { ttlMs: 10 * 60_000, force: options.force }
  );
}
