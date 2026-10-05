/**
 * On-demand loading of the mailbox indexes the "All mail" search needs that
 * no list component has loaded yet this session. Each index is fetched at
 * most once (in-flight calls merge) and published to the shared store.
 */
import { fetchAliasInboxPage } from "../../utils/aliasInbox";
import { fetchSentIndex, readDeletedSentIdsForNames } from "../../utils/sentIndex";
import { aliasIndexKey, getMailIndex, publishMailIndex, sentIndexKey } from "./mailIndexStore";

/** How much of each alias inbox the cross-mailbox search loads on its own. */
export const ALIAS_SEARCH_PAGE = 100;

const inFlight = new Map<string, Promise<any[]>>();

function once(key: string, load: () => Promise<any[]>, walked = false): Promise<any[]> {
  const known = getMailIndex(key);
  if (known) return Promise.resolve(known);
  const running = inFlight.get(key);
  if (running) return running;
  const task = load()
    .then(rows => {
      publishMailIndex(key, rows, walked ? { walkedAt: Date.now() } : undefined);
      return rows;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, task);
  return task;
}

export function ensureSentIndex(names: string[]): Promise<any[]> {
  const cleaned = names.map(name => name.trim()).filter(Boolean);
  if (!cleaned.length) return Promise.resolve([]);
  // Keyed by these names: only an index of exactly them counts as complete.
  return once(sentIndexKey(cleaned), () => fetchSentIndex(cleaned, readDeletedSentIdsForNames(cleaned)), true);
}

export function ensureAliasIndex(alias: string, ownerAddress: string): Promise<any[]> {
  if (!alias || !ownerAddress) return Promise.resolve([]);
  return once(aliasIndexKey(alias), async () => {
    const page = await fetchAliasInboxPage(alias, ownerAddress, 0, ALIAS_SEARCH_PAGE);
    return page.rows;
  });
}

export function resetMailIndexLoads(): void {
  inFlight.clear();
}
