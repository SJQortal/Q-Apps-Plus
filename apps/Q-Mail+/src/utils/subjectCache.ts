/**
 * Decrypted subjects for list rows, shared by every row and by search.
 *
 * The original app keeps the subject of every message it has opened in
 * localStorage (`qmail_persistance_<name>`), encrypted to the user with
 * ENCRYPT_DATA (src/utils/fetchMail.ts). Rows decrypt those lazily with
 * DECRYPT_DATA. This module keeps that work to one request per subject per
 * session, runs the requests one at a time (no storm when a long list
 * mounts), remembers failures, and never hands the ciphertext back as a
 * subject (Bugs #18).
 */
import { useEffect, useState } from "react";
import { base64ToUint8Array, uint8ArrayToObject } from "./toBase64";

/** encrypted subject → decrypted text ("" when the decrypt failed). */
const decrypted = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();
const listeners = new Set<(encrypted: string, subject: string) => void>();
let queue: Promise<unknown> = Promise.resolve();
let stats = { requests: 0, hits: 0, failures: 0 };

/** What is already known: the subject, or undefined when never decrypted. */
export function peekDecryptedSubject(encrypted: string | undefined | null): string | undefined {
  if (!encrypted) return "";
  return decrypted.get(encrypted);
}

/** Record a subject learnt elsewhere (e.g. from a decrypted message). */
export function primeDecryptedSubject(encrypted: string, subject: string): void {
  if (!encrypted) return;
  if (decrypted.get(encrypted) === subject) return;
  decrypted.set(encrypted, subject);
  listeners.forEach(listener => listener(encrypted, subject));
}

async function decryptNow(encrypted: string): Promise<string> {
  stats.requests += 1;
  try {
    const result = await qortalRequest({
      action: "DECRYPT_DATA",
      encryptedData: encrypted,
    } as any);
    const value = uint8ArrayToObject(base64ToUint8Array(result));
    if (typeof value === "string") return value;
    if (value === null || value === undefined) return "";
    return String(value);
  } catch {
    stats.failures += 1;
    return "";
  }
}

/** The decrypted subject, one DECRYPT_DATA per ciphertext per session, run one at a time. */
export function decryptSubject(encrypted: string | undefined | null): Promise<string> {
  if (!encrypted) return Promise.resolve("");
  const known = decrypted.get(encrypted);
  if (known !== undefined) {
    stats.hits += 1;
    return Promise.resolve(known);
  }
  const running = inFlight.get(encrypted);
  if (running) return running;
  const task = queue.then(() => decryptNow(encrypted)).then(subject => {
    decrypted.set(encrypted, subject);
    listeners.forEach(listener => listener(encrypted, subject));
    return subject;
  });
  queue = task.catch(() => undefined);
  inFlight.set(encrypted, task);
  task.finally(() => inFlight.delete(encrypted)).catch(() => undefined);
  return task;
}

export function subscribeSubjects(listener: (encrypted: string, subject: string) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function subjectCacheStats() {
  return { ...stats, known: decrypted.size, inFlight: inFlight.size };
}

export function resetSubjectCache(): void {
  decrypted.clear();
  inFlight.clear();
  listeners.clear();
  queue = Promise.resolve();
  stats = { requests: 0, hits: 0, failures: 0 };
}

/**
 * The decrypted subject for a saved (encrypted) subject: `null` while unknown,
 * "" for no subject or a failed decrypt, else the text.
 */
export function useDecryptedSubject(
  encrypted: string | undefined | null,
  /** False until the row is on screen: a known subject still shows, nothing is decrypted. */
  enabled = true
): string | null {
  const [subject, setSubject] = useState<string | null>(() => {
    if (encrypted === undefined || encrypted === null) return null;
    const known = peekDecryptedSubject(encrypted);
    return known === undefined ? null : known;
  });

  useEffect(() => {
    if (encrypted === undefined || encrypted === null) {
      setSubject(null);
      return;
    }
    const known = peekDecryptedSubject(encrypted);
    if (known !== undefined) {
      setSubject(known);
      return;
    }
    setSubject(null);
    if (!enabled) return;
    let cancelled = false;
    void decryptSubject(encrypted).then(value => {
      if (!cancelled) setSubject(value);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, encrypted]);

  return subject;
}
