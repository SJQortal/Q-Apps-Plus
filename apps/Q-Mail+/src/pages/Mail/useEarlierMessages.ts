/**
 * The reader's earlier messages (earlierMessages.ts): every entry of the
 * message's `generalData.threadV2`, a window of the newest ones, and a load
 * state for each reference-only entry in the window. Nothing is fetched until
 * `open` (the reader's "Show earlier"), and only for the window, which grows
 * by EARLIER_PAGE_SIZE with `showOlder`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { shallowEqual, useSelector } from "react-redux";
import { RootState } from "../../state/store";
import {
  EARLIER_PAGE_SIZE,
  cachedEarlierMessage,
  earlierEntriesOf,
  earlierWindow,
  loadEarlierMessage,
  needsFetch,
  settledEarlierLoad,
  type EarlierEntry,
  type EarlierLoad,
} from "./earlierMessages";

export interface EarlierItem {
  entry: EarlierEntry;
  /** Null for an embedded copy; otherwise where the fetched message stands. */
  load: EarlierLoad | null;
}

const NO_CACHED: Record<string, any> = {};

export function useEarlierMessages(message: any, open: boolean) {
  const user = useSelector((state: RootState) => state.auth?.user);
  const ownNames = useMemo(
    () => [user?.name, ...(Array.isArray(user?.names) ? user.names.map(item => item?.name) : [])].filter(
      (name): name is string => typeof name === "string" && Boolean(name)
    ),
    [user]
  );

  const thread = message?.generalData?.threadV2;
  const messageId = message?.id;
  const messageUser = message?.user;
  const entries = useMemo(
    () => earlierEntriesOf({ id: messageId, user: messageUser, generalData: { threadV2: thread } }),
    [messageId, messageUser, thread]
  );

  // Window size and load results belong to one message: reset them when it changes.
  const messageKey = `${messageUser || ""}|${messageId || ""}`;
  const [forKey, setForKey] = useState(messageKey);
  const [count, setCount] = useState(EARLIER_PAGE_SIZE);
  const [loads, setLoads] = useState<Record<string, EarlierLoad>>({});
  const [retryToken, setRetryToken] = useState(0);
  if (forKey !== messageKey) {
    setForKey(messageKey);
    setCount(EARLIER_PAGE_SIZE);
    setLoads({});
  }

  const { visible, hidden } = useMemo(() => earlierWindow(entries, count), [entries, count]);

  // Only the decrypted copies of the references on screen, so the reader
  // does not re-render whenever any other message is decrypted (a search).
  const visibleRefIds = visible.filter(needsFetch).map(entry => entry.reference.identifier);
  const hashMap = useSelector((state: RootState) => {
    if (!open || !visibleRefIds.length) return NO_CACHED;
    const all = state.mail.hashMapMailMessages;
    const picked: Record<string, any> = {};
    visibleRefIds.forEach(id => {
      if (all[id]) picked[id] = all[id];
    });
    return picked;
  }, shallowEqual);

  const loadOf = useCallback(
    (entry: EarlierEntry): EarlierLoad | null => {
      if (!needsFetch(entry)) return null;
      const cached = cachedEarlierMessage(entry.reference, hashMap);
      if (cached) return { status: "loaded", message: cached };
      return loads[entry.key] || settledEarlierLoad(entry.reference) || { status: "loading" };
    },
    [hashMap, loads]
  );

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const startedRef = useRef<{ forKey: string; keys: Set<string> }>({ forKey: messageKey, keys: new Set() });
  const visibleKeys = visible.map(entry => entry.key).join("\n");
  useEffect(() => {
    if (!open) return;
    if (startedRef.current.forKey !== messageKey) startedRef.current = { forKey: messageKey, keys: new Set() };
    const started = startedRef.current;
    // Newest first: the reader opens the newest earlier message.
    const queue = visible
      .filter(needsFetch)
      .filter(entry => !started.keys.has(entry.key))
      .filter(entry => !cachedEarlierMessage(entry.reference, hashMap) && !settledEarlierLoad(entry.reference))
      .reverse();
    queue.forEach(entry => {
      started.keys.add(entry.key);
      void loadEarlierMessage(entry.reference, { ownNames }).then(result => {
        if (!mountedRef.current || startedRef.current !== started) return;
        setLoads(prev => ({ ...prev, [entry.key]: result }));
      });
    });
    // `visible` and `hashMap` are read through visibleKeys and the guard above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, messageKey, visibleKeys, retryToken]);

  const showOlder = useCallback(() => setCount(value => value + EARLIER_PAGE_SIZE), []);

  const retry = useCallback((key: string) => {
    startedRef.current.keys.delete(key);
    setLoads(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setRetryToken(value => value + 1);
  }, []);

  const items: EarlierItem[] = visible.map(entry => ({ entry, load: loadOf(entry) }));
  return { total: entries.length, items, hidden, showOlder, retry };
}
