import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  GROUP_MEMBERS_MAX_AGE_MS,
  getGroupMemberAddresses,
  getGroupMembers,
  peekGroupMemberCount,
  peekGroupMembers,
  toMembersByName,
  type GroupMember,
  type GroupMembersByName,
} from '../utils/groupMembersCache';
import { usePolling } from './usePolling';

export interface UseGroupMembersResult {
  members: GroupMember[];
  /** The `{[name]: {publicKey, address}}` map the thread composer expects; `null` until loaded. */
  membersByName: GroupMembersByName | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * A group's members from the session cache. Shows a cached list at once,
 * fetches when there is none, and refreshes at most every 10 minutes while
 * the tab is visible (docs/QORTAL.md → Efficiency rule 7).
 */
export function useGroupMembers(groupId: string | number | null | undefined, enabled = true): UseGroupMembersResult {
  const normalizedGroupId = String(groupId ?? '').trim();
  const [members, setMembers] = useState<GroupMember[]>(() =>
    normalizedGroupId ? peekGroupMembers(normalizedGroupId)?.members ?? [] : []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (force: boolean) => {
      if (!normalizedGroupId || !enabled) return;
      const cached = peekGroupMembers(normalizedGroupId);
      if (!cached || force) setIsLoading(!cached);
      try {
        const result = await getGroupMembers(normalizedGroupId, { force });
        setMembers(result.members);
        setError(null);
      } catch (loadError: any) {
        setError(typeof loadError?.message === 'string' ? loadError.message : 'Could not load group members');
      } finally {
        setIsLoading(false);
      }
    },
    [enabled, normalizedGroupId]
  );

  useEffect(() => {
    const cached = normalizedGroupId ? peekGroupMembers(normalizedGroupId) : null;
    setMembers(cached?.members ?? []);
    setError(null);
    void load(false);
  }, [load, normalizedGroupId]);

  usePolling(() => load(false), {
    intervalMs: GROUP_MEMBERS_MAX_AGE_MS,
    enabled: enabled && Boolean(normalizedGroupId),
    maxIntervalMs: GROUP_MEMBERS_MAX_AGE_MS * 4,
  });

  const membersByName = useMemo(() => (members.length ? toMembersByName(members) : null), [members]);

  return {
    members,
    membersByName,
    isLoading,
    error,
    refresh: () => load(true),
  };
}

/**
 * How many members a group has, from the member pages alone: no name or
 * public-key lookups (those wait until the list is shown or a post is sent).
 * `null` until known.
 */
export function useGroupMemberCount(groupId: string | number | null | undefined): number | null {
  const normalizedGroupId = String(groupId ?? '').trim();
  const [count, setCount] = useState<number | null>(() =>
    normalizedGroupId ? peekGroupMemberCount(normalizedGroupId) : null
  );

  const load = useCallback(async () => {
    if (!normalizedGroupId) return;
    try {
      const members = await getGroupMemberAddresses(normalizedGroupId);
      setCount(members.length);
    } catch {
      // Keep what is shown; the next refresh tries again.
    }
  }, [normalizedGroupId]);

  useEffect(() => {
    setCount(normalizedGroupId ? peekGroupMemberCount(normalizedGroupId) : null);
    void load();
  }, [load, normalizedGroupId]);

  usePolling(load, {
    intervalMs: GROUP_MEMBERS_MAX_AGE_MS,
    enabled: Boolean(normalizedGroupId),
    maxIntervalMs: GROUP_MEMBERS_MAX_AGE_MS * 4,
  });

  return count;
}
