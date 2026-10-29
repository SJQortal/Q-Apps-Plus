/**
 * Finding the people a discount is for (Simon, 2026-10-25: "a qortal name
 * helper while typing … a bunch of names from a certain Q-Chat Group (also
 * add group helper)"), from the node's own lists:
 *
 * - names that start with what's typed: `GET /names/search?prefix=true`,
 *   one page of 10 (Core 6.1.9's parameters, as Q-Mintership+ uses them);
 * - the seller's own groups (`GET /groups/member/{address}`, one read), and
 *   every group, 100 a page, read once when a group is first searched for;
 * - a group's members with their primary names (`GET /groups/members/{id}`,
 *   100 a page, at most MEMBER_PAGES pages).
 *
 * Every answer is kept for the session and shared while in flight.
 */
type Fetch = (url: string) => Promise<Response>;
const plainFetch: Fetch = (url) => fetch(url);

export const NAME_SEARCH_MIN = 2;
const NAME_SEARCH_LIMIT = 10;
const GROUP_PAGE = 100;
const GROUP_PAGES = 30;
const MEMBER_PAGES = 10;

const cache = new Map<string, Promise<unknown>>();
function once<T>(key: string, load: () => Promise<T>): Promise<T> {
  let hit = cache.get(key) as Promise<T> | undefined;
  if (!hit) {
    hit = load();
    cache.set(key, hit);
    hit.catch(() => cache.delete(key));
  }
  return hit;
}

async function getJson(url: string, get: Fetch): Promise<unknown> {
  const res = await get(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

/** Names that start with `text` (any case): the exact one first, then shorter ones, then A–Z. */
export function searchNames(text: string, get: Fetch = plainFetch): Promise<string[]> {
  const q = text.trim();
  if (q.length < NAME_SEARCH_MIN || q.length > 40) return Promise.resolve([]);
  return once(`names:${q.toLowerCase()}`, async () => {
    const rows = await getJson(`/names/search?query=${encodeURIComponent(q)}&prefix=true&limit=${NAME_SEARCH_LIMIT}&offset=0`, get);
    const names = [...new Set((Array.isArray(rows) ? rows : []).map((r) => (r as { name?: unknown })?.name).filter((n): n is string => typeof n === "string" && n.length > 0))];
    const lower = q.toLowerCase();
    return names.sort((a, b) => Number(b.toLowerCase() === lower) - Number(a.toLowerCase() === lower) || a.length - b.length || a.localeCompare(b));
  });
}

export interface QortalGroup {
  id: number;
  name: string;
  memberCount?: number;
}

function groupOf(row: unknown): QortalGroup | null {
  const r = row as { groupId?: unknown; groupName?: unknown; memberCount?: unknown } | null;
  const id = Number(r?.groupId);
  if (!Number.isInteger(id) || id <= 0 || typeof r?.groupName !== "string" || !r.groupName) return null;
  return { id, name: r.groupName, ...(typeof r.memberCount === "number" && { memberCount: r.memberCount }) };
}

/** The groups an account is in (Q-Chat's groups). */
export function groupsOf(address: string, get: Fetch = plainFetch): Promise<QortalGroup[]> {
  if (!address) return Promise.resolve([]);
  return once(`groupsof:${address}`, async () => {
    const rows = await getJson(`/groups/member/${encodeURIComponent(address)}`, get);
    return (Array.isArray(rows) ? rows : []).map(groupOf).filter((g): g is QortalGroup => !!g);
  });
}

/** Every group on the chain, read once a session (100 a page). */
export function allGroups(get: Fetch = plainFetch): Promise<QortalGroup[]> {
  return once("groups:all", async () => {
    const out: QortalGroup[] = [];
    for (let page = 0; page < GROUP_PAGES; page++) {
      const rows = await getJson(`/groups?limit=${GROUP_PAGE}&offset=${page * GROUP_PAGE}`, get);
      const list = Array.isArray(rows) ? rows : [];
      for (const row of list) {
        const group = groupOf(row);
        if (group) out.push(group);
      }
      if (list.length < GROUP_PAGE) break;
    }
    return out;
  });
}

/** Groups whose name contains `text`, those that start with it first. */
export function matchGroups(groups: readonly QortalGroup[], text: string): QortalGroup[] {
  const q = text.trim().toLowerCase();
  if (!q) return [...groups];
  const hits = groups.filter((g) => g.name.toLowerCase().includes(q));
  return hits.sort((a, b) => Number(b.name.toLowerCase().startsWith(q)) - Number(a.name.toLowerCase().startsWith(q)) || a.name.localeCompare(b.name));
}

export interface GroupNames {
  /** The members' primary names. */
  names: string[];
  /** Members without a name (a discount can't be for them). */
  withoutName: number;
  /** The group has more members than were read. */
  truncated: boolean;
}

/** A group's members' primary names (at most MEMBER_PAGES × 100 members read). */
export function groupMemberNames(groupId: number, get: Fetch = plainFetch): Promise<GroupNames> {
  return once(`members:${groupId}`, async () => {
    const names = new Set<string>();
    let withoutName = 0;
    let truncated = false;
    for (let page = 0; page < MEMBER_PAGES; page++) {
      const body = (await getJson(`/groups/members/${groupId}?limit=${GROUP_PAGE}&offset=${page * GROUP_PAGE}`, get)) as { members?: unknown } | null;
      const rows = Array.isArray(body?.members) ? body.members : [];
      for (const row of rows) {
        const name = (row as { primaryName?: unknown })?.primaryName;
        if (typeof name === "string" && name) names.add(name);
        else withoutName += 1;
      }
      if (rows.length < GROUP_PAGE) break;
      if (page === MEMBER_PAGES - 1) truncated = true;
    }
    return { names: [...names], withoutName, truncated };
  });
}

/** For tests. */
export function resetPeopleCaches(): void {
  cache.clear();
}
