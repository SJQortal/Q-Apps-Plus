/**
 * Recipient names for sent mail (I4). A sent identifier only carries the
 * first 20 characters of the recipient's name and the last 6 of their
 * address (`_mail_qortal_qmail_<name20>_<addr6>_mail_<id>`), or the alias
 * for alias mail. The real name comes from the decrypted message
 * (`recipient`) when the user has opened it; otherwise it is resolved once
 * per (prefix, suffix) group per session, never once per row:
 *
 * 1. GET_NAME_DATA for the prefix through nameCache (exact; right for every
 *    name of 20 characters or fewer) and a check that the owner ends with
 *    the address suffix;
 * 2. only then one SEARCH_NAMES {prefix: true, limit: 10} for longer names.
 */
import { useEffect, useState } from "react";
import { parseSentRecipientFromIdentifier } from "../pages/Mail/mailIdentifier";
import { lookupName, searchNamesQuery } from "./nameCache";

const resolved = new Map<string, string | null>();
const inFlight = new Map<string, Promise<string | null>>();
const listeners = new Set<(key: string, name: string | null) => void>();
let stats = { nameLookups: 0, searches: 0, hits: 0 };

export function sentRecipientKey(prefix: string, suffix: string): string {
  return `${prefix.trim().toLowerCase()}:${suffix.trim().toLowerCase()}`;
}

/** `string` = resolved, `null` = known miss, `undefined` = not asked yet. */
export function peekSentRecipientName(prefix: string, suffix: string): string | null | undefined {
  return resolved.get(sentRecipientKey(prefix, suffix));
}

async function resolveNow(prefix: string, suffix: string): Promise<string | null> {
  const normalizedSuffix = suffix.toLowerCase();
  try {
    stats.nameLookups += 1;
    const exact = await lookupName(prefix);
    if (exact.status === "found" && exact.address.toLowerCase().endsWith(normalizedSuffix)) {
      return exact.name;
    }
  } catch {
    // Transport error: fall through to the prefix search.
  }
  try {
    stats.searches += 1;
    const response = await qortalRequest({
      action: "SEARCH_NAMES",
      query: searchNamesQuery(prefix),
      prefix: true,
      limit: 10,
      reverse: false,
    } as any);
    const normalizedPrefix = prefix.toLowerCase();
    const match = (Array.isArray(response) ? response : []).find((item: any) => {
      const owner = typeof item?.owner === "string" ? item.owner.toLowerCase() : "";
      const candidate = typeof item?.name === "string" ? item.name.toLowerCase() : "";
      return owner.endsWith(normalizedSuffix) && candidate.startsWith(normalizedPrefix);
    });
    return typeof match?.name === "string" && match.name ? match.name : null;
  } catch {
    return null;
  }
}

/** The recipient's registered name for a (prefix, suffix) group, one lookup per group per session. */
export function resolveSentRecipientName(prefix: string, suffix: string): Promise<string | null> {
  const cleanPrefix = prefix.trim();
  const cleanSuffix = suffix.trim();
  if (!cleanPrefix || !cleanSuffix) return Promise.resolve(null);
  const key = sentRecipientKey(cleanPrefix, cleanSuffix);
  const known = resolved.get(key);
  if (known !== undefined) {
    stats.hits += 1;
    return Promise.resolve(known);
  }
  const running = inFlight.get(key);
  if (running) return running;
  const task = resolveNow(cleanPrefix, cleanSuffix).then(name => {
    resolved.set(key, name);
    listeners.forEach(listener => listener(key, name));
    return name;
  });
  inFlight.set(key, task);
  task.finally(() => inFlight.delete(key)).catch(() => undefined);
  return task;
}

export function sentRecipientCacheStats() {
  return { ...stats, known: resolved.size, inFlight: inFlight.size };
}

export function resetSentRecipientCache(): void {
  resolved.clear();
  inFlight.clear();
  listeners.clear();
  stats = { nameLookups: 0, searches: 0, hits: 0 };
}

export interface SentRecipient {
  /** The best name we have: decrypted, resolved, alias, or the identifier's prefix. */
  name: string;
  /** True for alias mail (no address suffix in the identifier). */
  isAlias: boolean;
  /** True once the name is exact (decrypted, resolved, or an alias). */
  isExact: boolean;
}

/**
 * The recipient of a sent identifier for display. `known` is the decrypted
 * `recipient` when the message was opened; it wins and costs nothing.
 */
export function useSentRecipient(
  identifier: string,
  known?: string,
  /** False until the row is on screen: a cached name still shows, nothing is looked up. */
  enabled = true
): SentRecipient {
  const { recipientName, recipientAddress } = parseSentRecipientFromIdentifier(identifier || "");
  const prefix = recipientName || "";
  const suffix = recipientAddress || "";
  const isAlias = Boolean(prefix) && !suffix;
  const knownName = typeof known === "string" ? known.trim() : "";
  const [resolvedName, setResolvedName] = useState<string | null | undefined>(() =>
    prefix && suffix ? peekSentRecipientName(prefix, suffix) : undefined
  );

  useEffect(() => {
    if (knownName || !prefix || !suffix) return;
    const peeked = peekSentRecipientName(prefix, suffix);
    if (peeked !== undefined) {
      setResolvedName(peeked);
      return;
    }
    if (!enabled) return;
    let cancelled = false;
    void resolveSentRecipientName(prefix, suffix).then(name => {
      if (!cancelled) setResolvedName(name);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, knownName, prefix, suffix]);

  if (knownName) return { name: knownName, isAlias: false, isExact: true };
  if (isAlias) return { name: prefix, isAlias: true, isExact: true };
  if (resolvedName) return { name: resolvedName, isAlias: false, isExact: true };
  return { name: prefix || (suffix ? `Address …${suffix}` : "Unknown recipient"), isAlias: false, isExact: false };
}
