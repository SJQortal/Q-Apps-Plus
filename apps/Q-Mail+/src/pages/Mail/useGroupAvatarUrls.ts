/**
 * The avatar URLs of the groups shown with threads (the rail and the Threads
 * list), by group id: "" for a group without an avatar. Each group is asked
 * once per session (fetchGroupAvatarUrl), three at a time, and each answer
 * shows as soon as it arrives. A lookup that failed (null, after its own
 * retries) is not stored, so the group is asked again the next time the
 * list of groups or avatars changes, instead of showing no avatar until a
 * reload.
 */
import { useEffect, useMemo, useState } from "react";
import { fetchGroupAvatarUrl, mapWithConcurrency } from "../../utils/mailInbox";

const hasOwn = (record: Record<string, string>, key: string) => Object.prototype.hasOwnProperty.call(record, key);

export function useGroupAvatarUrls(groupIds: Array<string | number>, enabled: boolean): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const missing = useMemo(
    () =>
      Array.from(new Set(groupIds.map(id => String(id ?? "").trim()).filter(Boolean))).filter(id => !hasOwn(urls, id)),
    [groupIds, urls]
  );
  const missingKey = missing.join(",");

  useEffect(() => {
    if (!enabled || !missing.length) return;
    let cancelled = false;
    void mapWithConcurrency(missing, 3, async groupId => {
      if (cancelled) return;
      const url = await fetchGroupAvatarUrl(groupId);
      if (cancelled || url === null) return;
      setUrls(previous => (hasOwn(previous, groupId) ? previous : { ...previous, [groupId]: url }));
    });
    return () => {
      cancelled = true;
    };
    // `missing` is read through missingKey: a new array with the same ids is no change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, missingKey]);

  return urls;
}
