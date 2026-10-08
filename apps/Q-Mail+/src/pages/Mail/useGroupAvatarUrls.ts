/**
 * The avatar URLs of the groups shown with threads (the rail and the Threads
 * list), by group id: "" for a group without an avatar. Each group is asked
 * once per session (fetchGroupAvatarUrl), three at a time, and each answer
 * shows as soon as it arrives.
 *
 * A lookup that fails (null) is not stored: the groups that failed are asked
 * again after GROUP_AVATAR_RETRY_DELAYS_MS, after every other group, so they
 * never hold up the rest; then again only when the list of groups changes.
 * Answers arriving do not restart the run, so a failing group is asked at
 * most 1 + the retries per list of groups.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { fetchGroupAvatarUrl, mapWithConcurrency } from "../../utils/mailInbox";

/** Waits before asking the groups whose lookup failed again. */
export const GROUP_AVATAR_RETRY_DELAYS_MS = [5_000, 20_000];

const hasOwn = (record: Record<string, string>, key: string) => Object.prototype.hasOwnProperty.call(record, key);

export function useGroupAvatarUrls(groupIds: Array<string | number>, enabled: boolean): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  // Read by the run below, which must not restart for every answer it stores.
  const urlsRef = useRef(urls);
  useEffect(() => {
    urlsRef.current = urls;
  }, [urls]);

  const ids = useMemo(
    () => Array.from(new Set(groupIds.map(id => String(id ?? "").trim()).filter(Boolean))),
    [groupIds]
  );
  const idsKey = ids.join(",");

  useEffect(() => {
    if (!enabled) return;
    let pending = ids.filter(id => !hasOwn(urlsRef.current, id));
    if (!pending.length) return;
    let cancelled = false;
    const askAll = async (groupIds: string[]): Promise<string[]> => {
      const failed: string[] = [];
      await mapWithConcurrency(groupIds, 3, async groupId => {
        if (cancelled) return;
        const url = await fetchGroupAvatarUrl(groupId);
        if (cancelled) return;
        if (url === null) {
          failed.push(groupId);
          return;
        }
        setUrls(previous => (hasOwn(previous, groupId) ? previous : { ...previous, [groupId]: url }));
      });
      return failed;
    };
    void (async () => {
      pending = await askAll(pending);
      for (const delay of GROUP_AVATAR_RETRY_DELAYS_MS) {
        if (cancelled || !pending.length) return;
        await new Promise(resolve => setTimeout(resolve, delay));
        if (cancelled) return;
        pending = await askAll(pending);
      }
    })();
    return () => {
      cancelled = true;
    };
    // `ids` is read through idsKey: a new array with the same ids is no change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, idsKey]);

  return urls;
}
