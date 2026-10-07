/**
 * The earlier messages of a conversation, read from a message's
 * `generalData.threadV2` (docs/apps/Q-Mail+.md → Data contract §3a).
 *
 * An entry is one of two kinds:
 * - embedded: `{ reference, data }`, how the original Q-Mail and Q-Mail+
 *   1.0.0 write replies. `data` is a copy the sender put in their own mail,
 *   so it is shown as quoted and not verified;
 * - a reference only: `{ reference }`, how Q-Mail+ writes replies from 1.0.1
 *   on, so a reply does not grow with the conversation. The message is
 *   fetched from QDN under the reference's name (its publisher) and
 *   decrypted, only when the reader opens "Show earlier", a page at a time.
 *
 * A message the user already opened comes from the decrypted-message cache
 * (`hashMapMailMessages`, read only: what lands there feeds the read state
 * and the published state document). Everything else is fetched at most
 * EARLIER_FETCH_CONCURRENCY at a time, identical fetches in flight are
 * merged, and settled outcomes (loaded, deleted, not sent to you) are kept
 * here for the session. The original app skips entries without `data` (its
 * ShowMessageV2.tsx:332), so it shows a reference-only reply on its own.
 */
import { MAIL_SERVICE_TYPE } from "../../constants/mail";
import { fetchAndEvaluateMail, type FetchMailOptions } from "../../utils/fetchMail";
import { isLocalReadMarkerEntry } from "../../utils/mailCompose";
import { parseSentRecipientFromIdentifier } from "./mailIdentifier";

/** How many earlier messages "Show earlier" opens with, and each "Show older" adds. */
export const EARLIER_PAGE_SIZE = 5;
/** At most this many earlier messages are fetched at once. */
export const EARLIER_FETCH_CONCURRENCY = 2;
/** Not-yet-available retries per fetch (2 s and 4 s), then "Not available" with Retry. */
export const EARLIER_FETCH_RETRIES = 2;

export interface EarlierReference {
  name: string;
  identifier: string;
  service: string;
}

export interface EarlierEntry {
  /** Stable React key: `<name>|<identifier>` lowercased name, or `embedded:<index>`. */
  key: string;
  /** Where the message lives on QDN, when the entry says so. */
  reference: EarlierReference | null;
  /** The copy the sender embedded, if any. */
  data: any | null;
}

export type EarlierLoad =
  | { status: "loading" }
  | { status: "loaded"; message: any }
  | { status: "deleted" }
  | { status: "unableToDecrypt" }
  | { status: "unavailable" }
  | { status: "failed" };

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

export const referenceKey = (reference: Pick<EarlierReference, "name" | "identifier">): string =>
  `${reference.name.toLowerCase()}|${reference.identifier}`;

/** A reference the reader can fetch: a name, an identifier, and MAIL_PRIVATE (or no service). */
export function usableReference(value: any): EarlierReference | null {
  if (!value || typeof value !== "object") return null;
  const name = text(value.name);
  const identifier = text(value.identifier);
  const service = text(value.service) || MAIL_SERVICE_TYPE;
  if (!name || !identifier || service !== MAIL_SERVICE_TYPE) return null;
  return { name, identifier, service };
}

const usableData = (data: any): boolean =>
  Boolean(data && typeof data === "object" && !Array.isArray(data) && (data.user || data.subject || data.textContentV2));

/**
 * The entries worth showing, in conversation order: local read markers, the
 * message's own reference, unusable entries and repeats are dropped. Entries
 * keep their array order (both apps append, oldest first); when every entry
 * embeds a dated copy they are sorted by date, as the reader always did.
 */
export function earlierEntriesOf(message: any): EarlierEntry[] {
  const thread: any[] = Array.isArray(message?.generalData?.threadV2) ? message.generalData.threadV2 : [];
  const ownId = text(message?.id);
  const ownName = text(message?.user).toLowerCase();
  const entries: EarlierEntry[] = [];
  const byKey = new Map<string, EarlierEntry>();

  thread.forEach((raw, index) => {
    if (!raw || typeof raw !== "object" || isLocalReadMarkerEntry(raw)) return;
    const reference = usableReference(raw.reference);
    const data = usableData(raw.data) ? raw.data : null;
    if (!reference && !data) return;
    if (reference && reference.identifier === ownId && reference.name.toLowerCase() === ownName) return;
    if (reference) {
      const key = referenceKey(reference);
      const seen = byKey.get(key);
      if (seen) {
        if (!seen.data && data) seen.data = data;
        return;
      }
      const entry = { key, reference, data };
      byKey.set(key, entry);
      entries.push(entry);
      return;
    }
    entries.push({ key: `embedded:${index}`, reference: null, data });
  });

  const allDated = entries.length > 0 && entries.every(entry => Number(entry.data?.createdAt) > 0);
  if (allDated) {
    return [...entries].sort((a, b) => Number(a.data.createdAt) - Number(b.data.createdAt));
  }
  return entries;
}

/** The newest `count` entries (the ones on screen) and how many older ones are hidden. */
export function earlierWindow(entries: EarlierEntry[], count: number): { visible: EarlierEntry[]; hidden: number } {
  const shown = Math.max(0, Math.min(entries.length, count));
  return { visible: entries.slice(entries.length - shown), hidden: entries.length - shown };
}

/** The entries that need a fetch: a reference and no embedded copy. */
export const needsFetch = (entry: EarlierEntry): entry is EarlierEntry & { reference: EarlierReference } =>
  Boolean(entry.reference && !entry.data);

/** A decrypted copy from the session cache, only if it is this publisher's (pitfall 15). */
export function cachedEarlierMessage(reference: EarlierReference, hashMap: Record<string, any> | undefined): any | null {
  const cached = hashMap?.[reference.identifier];
  if (!cached?.isValid || cached.unableToDecrypt) return null;
  if (text(cached.user).toLowerCase() !== reference.name.toLowerCase()) return null;
  return cached;
}

/**
 * Names to decrypt with, for mail encrypted before group encryption (Hub's
 * DECRYPT_DATA ignores the key for group-encrypted mail): the publisher, and
 * for mail one of our own names sent, the recipient from the identifier first.
 */
export function decryptCandidates(reference: EarlierReference, ownNames: string[]): string[] {
  const own = new Set(ownNames.map(name => text(name).toLowerCase()).filter(Boolean));
  const candidates: string[] = [];
  if (own.has(reference.name.toLowerCase())) {
    const { recipientName } = parseSentRecipientFromIdentifier(reference.identifier);
    if (recipientName) candidates.push(recipientName);
  }
  candidates.push(reference.name);
  return Array.from(new Set(candidates));
}

const settled = new Map<string, EarlierLoad>();
const inflight = new Map<string, Promise<EarlierLoad>>();

// A slot is handed straight to the next waiter, so no more than the limit
// ever run, whichever reader asked.
let activeFetches = 0;
const waitingFetches: Array<() => void> = [];
const acquireFetchSlot = (): Promise<void> => {
  if (activeFetches < EARLIER_FETCH_CONCURRENCY) {
    activeFetches += 1;
    return Promise.resolve();
  }
  return new Promise(resolve => waitingFetches.push(resolve));
};
const releaseFetchSlot = (): void => {
  const next = waitingFetches.shift();
  if (next) next();
  else activeFetches -= 1;
};

/** Tests only: forget settled outcomes, fetches in flight and the queue. */
export function resetEarlierMessagesCache(): void {
  settled.clear();
  inflight.clear();
  activeFetches = 0;
  waitingFetches.length = 0;
}

/** An outcome settled earlier in the session (loaded, deleted, or not sent to you). */
export const settledEarlierLoad = (reference: EarlierReference): EarlierLoad | undefined =>
  settled.get(referenceKey(reference));

export interface LoadEarlierOptions extends FetchMailOptions {
  ownNames?: string[];
}

/**
 * Fetches and decrypts one referenced message with the original app's call
 * shapes (fetchAndEvaluateMail: FETCH_QDN_RESOURCE base64, the publisher's
 * key from the name cache, DECRYPT_DATA). Never throws. No subject is
 * written to the list cache, so it costs no ENCRYPT_DATA.
 */
export function loadEarlierMessage(reference: EarlierReference, options: LoadEarlierOptions = {}): Promise<EarlierLoad> {
  const key = referenceKey(reference);
  const known = settled.get(key);
  if (known) return Promise.resolve(known);
  const running = inflight.get(key);
  if (running) return running;

  const run = (async (): Promise<EarlierLoad> => {
    await acquireFetchSlot();
    let outcome: EarlierLoad = { status: "failed" };
    try {
      outcome = await fetchEarlierMessage(reference, options);
    } finally {
      releaseFetchSlot();
    }
    if (outcome.status !== "unavailable" && outcome.status !== "failed") settled.set(key, outcome);
    return outcome;
  })();

  inflight.set(key, run);
  void run.finally(() => {
    if (inflight.get(key) === run) inflight.delete(key);
  });
  return run;
}

async function fetchEarlierMessage(reference: EarlierReference, options: LoadEarlierOptions): Promise<EarlierLoad> {
  let outcome: EarlierLoad = { status: "failed" };
  for (const otherUser of decryptCandidates(reference, options.ownNames || [])) {
    const res: any = await fetchAndEvaluateMail(
      { user: reference.name, messageIdentifier: reference.identifier, content: {}, otherUser },
      undefined,
      undefined,
      { retries: options.retries ?? EARLIER_FETCH_RETRIES, sleep: options.sleep }
    );
    if (res?.deleted) {
      outcome = { status: "deleted" };
      break;
    }
    if (res?.isValid) {
      outcome = { status: "loaded", message: res };
      break;
    }
    if (res?.unableToDecrypt) {
      outcome = { status: "unableToDecrypt" };
      continue;
    }
    outcome = res?.notAvailable ? { status: "unavailable" } : { status: "failed" };
    break;
  }
  return outcome;
}
