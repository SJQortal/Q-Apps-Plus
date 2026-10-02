/**
 * Search over a list of mail rows (N8, Bugs #23, UX #21).
 *
 * Phase 1 is instant and free: it matches what is already known for every
 * row (sender/recipient, the decrypted subject from the hash map or the
 * saved-subject cache, QDN metadata title/description, and the full text of
 * messages that were decrypted earlier). It runs 300 ms after the last key.
 *
 * Phase 2 is explicit: `bodyLimit` says how many rows that have never been
 * decrypted may be fetched and decrypted for this query (newest first, three
 * at a time). The bar raises it in steps when the user presses "Search
 * message bodies", so typing never starts a decrypt storm. Decrypted results
 * go into the Redux hash map, so the search warms the reader too.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { addToHashMapMail } from "../../state/features/mailSlice";
import { RootState } from "../../state/store";
import { fetchAndEvaluateMail } from "../../utils/fetchMail";
import { peekDecryptedSubject, subscribeSubjects } from "../../utils/subjectCache";
import {
  buildFullSearchText,
  buildMetaSearchText,
  getDecryptCandidates,
  getSearchTerms,
  includesAllTerms,
  mailboxRefOf,
  mailboxTypeForRef,
  toMessageId,
  type MailboxType,
} from "./mailSearch";

interface UseMailboxSearchArgs {
  messages: any[];
  query: string;
  /** The mailbox the rows belong to; rows tagged for the cross-mailbox search override it. */
  mailboxType?: MailboxType;
  username?: string;
  hashMapMailMessages?: Record<string, any>;
  enabled?: boolean;
  /** How many never-decrypted rows may be decrypted for the current query (0 = none). */
  bodyLimit?: number;
  debounceMs?: number;
}

interface SearchCacheEntry {
  text: string;
  isComplete: boolean;
}

export interface MailboxSearchStatus {
  /** A body scan is running. */
  active: boolean;
  /** Nothing is pending and no scan runs. */
  complete: boolean;
  /** Rows matched against their full text (decrypted). */
  scanned: number;
  total: number;
  matches: number;
  /** Rows whose body has not been searched (never decrypted). */
  pending: number;
  /** More rows remain than `bodyLimit` allowed this time. */
  capped: boolean;
  /** The terms of the debounced query (empty = no search). */
  terms: string[];
  /** Progress of the running body scan. */
  scanProgress: { done: number; of: number } | null;
}

export const SEARCH_CONCURRENCY = 3;
export const SEARCH_DEBOUNCE_MS = 300;
export const BODY_SEARCH_STEP = 40;

export const idleSearchStatus = (total = 0): MailboxSearchStatus => ({
  active: false,
  complete: true,
  scanned: total,
  total,
  matches: total,
  pending: 0,
  capped: false,
  terms: [],
  scanProgress: null,
});

const isDecryptedCopy = (candidate: any): boolean => {
  return Boolean(candidate?.isValid && !candidate?.unableToDecrypt);
};

export const useMailboxSearch = ({
  messages,
  query,
  mailboxType = "inbox",
  username,
  hashMapMailMessages,
  enabled = true,
  bodyLimit = 0,
  debounceMs = SEARCH_DEBOUNCE_MS,
}: UseMailboxSearchArgs) => {
  const dispatch = useDispatch();
  const storeHashMap = useSelector((state: RootState) => state.mail.hashMapMailMessages);
  const savedSubjects = useSelector((state: RootState) => state.mail.hashMapSavedSubjects);
  const hashMap = hashMapMailMessages || storeHashMap;

  const runIdRef = useRef(0);
  const cacheRef = useRef<Map<string, SearchCacheEntry>>(new Map());
  const hashMapRef = useRef(hashMap);
  const decryptedForQueryRef = useRef<{ query: string; count: number }>({ query: "", count: 0 });
  const [results, setResults] = useState<any[]>(messages);
  const [status, setStatus] = useState<MailboxSearchStatus>(() => idleSearchStatus(messages.length));
  const [debouncedQuery, setDebouncedQuery] = useState(query.trim());
  const [subjectsVersion, setSubjectsVersion] = useState(0);

  useEffect(() => {
    hashMapRef.current = hashMap;
  }, [hashMap]);

  // 300 ms after the last keystroke (clearing is immediate).
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setDebouncedQuery("");
      return;
    }
    const timer = setTimeout(() => setDebouncedQuery(trimmed), debounceMs);
    return () => clearTimeout(timer);
  }, [debounceMs, query]);

  // Subjects decrypt lazily as rows render; fold them in without a storm.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeSubjects(() => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        setSubjectsVersion(v => v + 1);
      }, 250);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, []);

  const terms = useMemo(() => getSearchTerms(debouncedQuery), [debouncedQuery]);

  useEffect(() => {
    const total = messages.length;
    const runId = ++runIdRef.current;

    if (!enabled || !terms.length) {
      setResults(messages);
      setStatus(idleSearchStatus(total));
      return;
    }

    if (decryptedForQueryRef.current.query !== debouncedQuery) {
      decryptedForQueryRef.current = { query: debouncedQuery, count: 0 };
    }

    const typeOf = (message: any): MailboxType => {
      const ref = mailboxRefOf(message);
      return ref ? mailboxTypeForRef(ref) : mailboxType;
    };

    const matchedIds = new Set<string>();
    const pendingMessages: any[] = [];
    let scanned = 0;

    messages.forEach(message => {
      const messageId = toMessageId(message);
      if (!messageId) return;
      const type = typeOf(message);
      const cached = cacheRef.current.get(messageId);
      const knownDecrypted = hashMapRef.current[messageId];

      let text: string;
      let isComplete: boolean;
      if (cached?.isComplete) {
        text = cached.text;
        isComplete = true;
      } else if (isDecryptedCopy(knownDecrypted)) {
        text = buildFullSearchText(message, type, knownDecrypted);
        isComplete = true;
      } else if (isDecryptedCopy(message)) {
        text = buildFullSearchText(message, type, message);
        isComplete = true;
      } else {
        const saved = savedSubjects?.[messageId]?.subject;
        const subject = typeof saved === "string" ? peekDecryptedSubject(saved) : undefined;
        text = buildMetaSearchText(message, type, subject);
        isComplete = false;
      }
      cacheRef.current.set(messageId, { text, isComplete });

      if (includesAllTerms(text, terms)) matchedIds.add(messageId);
      if (isComplete) scanned += 1;
      else pendingMessages.push(message);
    });

    const allowed = Math.max(0, bodyLimit - decryptedForQueryRef.current.count);
    const toDecrypt = pendingMessages.slice(0, allowed);
    const capped = pendingMessages.length > toDecrypt.length;
    let done = 0;

    const applyState = (active: boolean) => {
      setResults(messages.filter(message => matchedIds.has(toMessageId(message))));
      const pending = pendingMessages.length - done;
      setStatus({
        active,
        complete: !active && pending === 0,
        scanned,
        total,
        matches: matchedIds.size,
        pending,
        capped: active ? capped : pending > 0,
        terms,
        scanProgress: active ? { done, of: toDecrypt.length } : null,
      });
    };

    applyState(toDecrypt.length > 0);
    if (!toDecrypt.length) return;

    const resolveMessage = async (message: any): Promise<SearchCacheEntry> => {
      const messageId = toMessageId(message);
      const type = typeOf(message);
      const knownDecrypted = hashMapRef.current[messageId];
      if (isDecryptedCopy(knownDecrypted)) {
        return { text: buildFullSearchText(message, type, knownDecrypted), isComplete: true };
      }
      let decryptedPayload: any = null;
      for (const otherUser of getDecryptCandidates(message, type)) {
        try {
          const result = await fetchAndEvaluateMail(
            { user: message?.user, messageIdentifier: messageId, content: message, otherUser },
            undefined,
            username
          );
          if (result?.id) dispatch(addToHashMapMail(result));
          if (isDecryptedCopy(result)) {
            decryptedPayload = result;
            break;
          }
        } catch {
          // Try the next candidate; the row keeps its metadata text.
        }
      }
      return {
        text: buildFullSearchText(message, type, decryptedPayload || undefined),
        isComplete: true,
      };
    };

    let queueIndex = 0;
    const worker = async () => {
      while (runIdRef.current === runId) {
        const nextIndex = queueIndex++;
        if (nextIndex >= toDecrypt.length) return;
        const message = toDecrypt[nextIndex];
        const messageId = toMessageId(message);
        const resolved = await resolveMessage(message);
        if (runIdRef.current !== runId) return;
        cacheRef.current.set(messageId, resolved);
        decryptedForQueryRef.current.count += 1;
        done += 1;
        scanned += 1;
        if (includesAllTerms(resolved.text, terms)) matchedIds.add(messageId);
        else matchedIds.delete(messageId);
        applyState(done < toDecrypt.length);
      }
    };

    void Promise.all(
      Array.from({ length: Math.min(SEARCH_CONCURRENCY, toDecrypt.length) }, () => worker())
    ).then(() => {
      if (runIdRef.current === runId) applyState(false);
    });

    return () => {
      if (runIdRef.current === runId) runIdRef.current += 1;
    };
    // savedSubjects/subjectsVersion: re-run when more subjects are known.
  }, [
    bodyLimit,
    debouncedQuery,
    dispatch,
    enabled,
    mailboxType,
    messages,
    savedSubjects,
    subjectsVersion,
    terms,
    username,
  ]);

  return { results, status, terms };
};
