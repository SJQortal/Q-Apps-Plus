/**
 * The new QDN records (docs/apps/Q-Mintership+.md → Data contract):
 * nomination, support, and a Minter Admin's Considering (further down).
 * They are additive: the original app never reads or writes these
 * identifiers, and the + app reads the original's cards only for History.
 *
 * Nomination  service JSON, identifier `qmp-nomination-<nomineeAddress>`,
 *             published by the nominator under their name.
 *             { v: 1, nomineeAddress, nomineeName?, reason, links[], createdHeight?, created? }
 * Support     service JSON, identifier `qmp-support-<nomineeAddress>`,
 *             published by a supporter.
 *             { v: 1, nomineeAddress, note? }
 *
 * JSON is Core's validated service for small JSON (valid JSON, at most
 * 25 KB). One identifier per nominee means a publisher has at most one
 * nomination (and one support) per person; publishing again replaces it.
 *
 * Nothing in a record is trusted on its own: the publisher comes from the
 * QDN search row, and is re-checked on every read (a MINTER member at level
 * 5+, or a Minter Admin, at the time of reading).
 */
import { base58Decode } from '../qortal/base58';
import { isAddress } from './accounts';

export const RECORD_SERVICE = 'JSON';
export const NOMINATION_PREFIX = 'qmp-nomination-';
export const SUPPORT_PREFIX = 'qmp-support-';

export const REASON_MIN = 20;
export const REASON_MAX = 600;
export const NOTE_MAX = 280;
export const LINKS_MAX = 5;
export const LINK_MAX = 300;
export const NOMINEE_NAME_MAX = 80;

export interface NominationRecord {
  v: 1;
  nomineeAddress: string;
  nomineeName?: string;
  reason: string;
  links: string[];
  /** The chain height when it was written (informational; the QDN row's time is what counts). */
  createdHeight?: number;
  /** ms, informational. */
  created?: number;
}

export interface SupportRecord {
  v: 1;
  nomineeAddress: string;
  note?: string;
}

export function nominationIdentifier(nomineeAddress: string): string {
  return `${NOMINATION_PREFIX}${nomineeAddress}`;
}

export function supportIdentifier(nomineeAddress: string): string {
  return `${SUPPORT_PREFIX}${nomineeAddress}`;
}

/** The nominee address an identifier is about, or null for a malformed identifier. */
export function nomineeFromIdentifier(identifier: string): string | null {
  const suffix = identifier.startsWith(NOMINATION_PREFIX)
    ? identifier.slice(NOMINATION_PREFIX.length)
    : identifier.startsWith(SUPPORT_PREFIX)
      ? identifier.slice(SUPPORT_PREFIX.length)
      : '';
  return isAddress(suffix) ? suffix : null;
}

/** A `qortal://` link of sensible length. Web links are refused: Hub's sandbox can't open them. */
export function isQortalLink(value: unknown): value is string {
  return (
    typeof value === 'string' && value.length <= LINK_MAX && /^qortal:\/\/[^\s]+$/i.test(value)
  );
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\r\n?/g, '\n').trim();
  return text.length > 0 && text.length <= max ? text : null;
}

/** Validate a nomination body read from QDN. Null when it is not a valid v1 record for `identifier`. */
export function parseNomination(body: unknown, identifier: string): NominationRecord | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (b.v !== 1) return null;
  const nominee = nomineeFromIdentifier(identifier);
  if (!nominee || b.nomineeAddress !== nominee) return null;
  const reason = cleanText(b.reason, REASON_MAX);
  if (!reason) return null;
  const links = Array.isArray(b.links) ? b.links.filter(isQortalLink).slice(0, LINKS_MAX) : [];
  const nomineeName = cleanText(b.nomineeName, NOMINEE_NAME_MAX) ?? undefined;
  return {
    v: 1,
    nomineeAddress: nominee,
    nomineeName,
    reason,
    links,
    createdHeight: Number.isSafeInteger(b.createdHeight) ? (b.createdHeight as number) : undefined,
    created: Number.isSafeInteger(b.created) ? (b.created as number) : undefined,
  };
}

/** Validate a support body read from QDN. */
export function parseSupport(body: unknown, identifier: string): SupportRecord | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (b.v !== 1) return null;
  const nominee = nomineeFromIdentifier(identifier);
  if (!nominee || b.nomineeAddress !== nominee || !identifier.startsWith(SUPPORT_PREFIX))
    return null;
  const note = cleanText(b.note, NOTE_MAX) ?? undefined;
  return { v: 1, nomineeAddress: nominee, note };
}

export interface NominationInput {
  nomineeAddress: string;
  nomineeName?: string | null;
  reason: string;
  links?: string[];
  createdHeight: number;
  created: number;
}

/** Problems with a nomination the user is writing, in plain words (empty when it is fine). */
export function nominationInputProblems(
  input: Pick<NominationInput, 'nomineeAddress' | 'reason' | 'links'>
): string[] {
  const problems: string[] = [];
  if (!isAddress(input.nomineeAddress))
    problems.push('Pick someone by name or a valid Qortal address.');
  const reason = input.reason.trim();
  if (reason.length < REASON_MIN)
    problems.push(`Write at least ${REASON_MIN} characters about why.`);
  if (reason.length > REASON_MAX) problems.push(`Keep the reason under ${REASON_MAX} characters.`);
  const links = (input.links ?? []).map((l) => l.trim()).filter(Boolean);
  if (links.length > LINKS_MAX) problems.push(`Add at most ${LINKS_MAX} links.`);
  if (links.some((l) => !isQortalLink(l)))
    problems.push('Links must start with qortal:// (web links can’t open inside Qortal).');
  return problems;
}

/** The record to publish. Throws when the input has problems. */
export function buildNomination(input: NominationInput): NominationRecord {
  const problems = nominationInputProblems(input);
  if (problems.length) throw new Error(problems.join(' '));
  const record: NominationRecord = {
    v: 1,
    nomineeAddress: input.nomineeAddress,
    reason: input.reason.trim(),
    links: (input.links ?? []).map((l) => l.trim()).filter(Boolean),
    createdHeight: input.createdHeight,
    created: input.created,
  };
  const name = input.nomineeName?.trim();
  if (name) record.nomineeName = name.slice(0, NOMINEE_NAME_MAX);
  return record;
}

export function buildSupport(nomineeAddress: string, note?: string): SupportRecord {
  if (!isAddress(nomineeAddress)) throw new Error('Not a valid Qortal address.');
  const record: SupportRecord = { v: 1, nomineeAddress };
  const text = note?.trim();
  if (text) {
    if (text.length > NOTE_MAX) throw new Error(`Keep the note under ${NOTE_MAX} characters.`);
    record.note = text;
  }
  return record;
}

// ---- Considering --------------------------------------------------------------

/**
 * Considering: a Minter Admin says "I've looked at this, not sure yet". It
 * changes nothing on chain. Service JSON, identifier
 * `qmp-considering-<key>`, published by the admin under their name:
 *
 *   key  the first 40 characters of the pending transaction's signature,
 *        or the nominee's address for a nomination still waiting for its
 *        first signature (the identifier stays within QDN's 64 characters)
 *   body { v: 1, pendingSignature?, nomineeAddress?, note? (≤ 280), cleared?: true }
 *
 * The latest publish per admin counts; "No longer considering" publishes it
 * again with `cleared: true`, since QDN can't delete. Readers re-check that
 * the publisher is a current Minter Admin (data/considering.ts).
 */
export const CONSIDERING_PREFIX = 'qmp-considering-';
/** Characters of the pending signature in the identifier. */
export const CONSIDERING_KEY_LENGTH = 40;
/** QDN's longest identifier. */
export const IDENTIFIER_MAX = 64;

export interface ConsideringRecord {
  v: 1;
  /** The pending transaction (a decision). */
  pendingSignature?: string;
  /** The nominee, for a nomination still waiting for its first signature. */
  nomineeAddress?: string;
  note?: string;
  /** "No longer considering". */
  cleared?: true;
}

/** What an admin is considering: a decision, or a nomination still waiting. */
export type ConsideringTarget = { pendingSignature: string } | { nomineeAddress: string };

/** A transaction signature: base58, 64 bytes. */
export function isSignature(value: unknown): value is string {
  if (typeof value !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{60,100}$/.test(value)) return false;
  try {
    return base58Decode(value).length === 64;
  } catch {
    return false;
  }
}

/** The identifier's key for a target. Throws on a malformed target. */
export function consideringKey(target: ConsideringTarget): string {
  if ('pendingSignature' in target) {
    if (!isSignature(target.pendingSignature)) throw new Error('Not a transaction signature.');
    return target.pendingSignature.slice(0, CONSIDERING_KEY_LENGTH);
  }
  if (!isAddress(target.nomineeAddress)) throw new Error('Not a valid Qortal address.');
  return target.nomineeAddress;
}

export function consideringIdentifier(target: ConsideringTarget): string {
  const identifier = `${CONSIDERING_PREFIX}${consideringKey(target)}`;
  if (identifier.length > IDENTIFIER_MAX) throw new Error('Identifier too long for QDN.');
  return identifier;
}

/** The key of a considering identifier, or null when it isn't one this app writes. */
export function consideringKeyOf(identifier: string): string | null {
  if (!identifier.startsWith(CONSIDERING_PREFIX) || identifier.length > IDENTIFIER_MAX) return null;
  const key = identifier.slice(CONSIDERING_PREFIX.length);
  if (key.length === CONSIDERING_KEY_LENGTH && /^[1-9A-HJ-NP-Za-km-z]+$/.test(key)) return key;
  return isAddress(key) ? key : null;
}

/**
 * Validate a considering body read from QDN against its identifier. A
 * decision's record must name the whole pending signature, whose first 40
 * characters are the key; a waiting nomination's names the nominee, whose
 * address is the key. Null when it is neither.
 */
export function parseConsidering(body: unknown, identifier: string): ConsideringRecord | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (b.v !== 1) return null;
  const key = consideringKeyOf(identifier);
  if (!key) return null;
  const record: ConsideringRecord = { v: 1 };
  if (b.pendingSignature !== undefined) {
    if (!isSignature(b.pendingSignature)) return null;
    if (b.pendingSignature.slice(0, CONSIDERING_KEY_LENGTH) !== key) return null;
    record.pendingSignature = b.pendingSignature;
    // The nominee is only a hint on a decision's record.
    if (isAddress(b.nomineeAddress)) record.nomineeAddress = b.nomineeAddress;
  } else {
    if (!isAddress(b.nomineeAddress) || b.nomineeAddress !== key) return null;
    record.nomineeAddress = b.nomineeAddress;
  }
  if (b.cleared === true) {
    record.cleared = true;
    return record;
  }
  const note = cleanText(b.note, NOTE_MAX);
  if (note) record.note = note;
  return record;
}

/** The record to publish: considering (with an optional note), or `cleared`. Throws on bad input. */
export function buildConsidering(
  target: ConsideringTarget,
  options: { note?: string; cleared?: boolean } = {}
): ConsideringRecord {
  consideringIdentifier(target);
  const record: ConsideringRecord =
    'pendingSignature' in target
      ? { v: 1, pendingSignature: target.pendingSignature }
      : { v: 1, nomineeAddress: target.nomineeAddress };
  if (options.cleared) {
    record.cleared = true;
    return record;
  }
  const text = options.note?.trim();
  if (text) {
    if (text.length > NOTE_MAX) throw new Error(`Keep the note under ${NOTE_MAX} characters.`);
    record.note = text;
  }
  return record;
}

/** UTF-8 JSON as base64, the `data64` PUBLISH_QDN_RESOURCE takes. */
export function toData64(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
