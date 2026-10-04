/**
 * Local compose drafts (docs/apps/Q-Mail+.md → Data contract §12).
 *
 * Storage key and shape are the original app's: `qmail_compose_drafts_<address>`
 * holds `{ [draftKey]: StoredComposeDraft }`, keyed `"<from>::<to>"` for a new
 * mail. Everything added here is additive: a reply draft gets its own key
 * (`…::reply:<id>`, and `…::replyall:<id>` for Reply all), a thread post `thread::<groupId>::<threadId|new>`, and
 * the optional fields below. Readers that know only the old fields keep
 * working; the sanitiser keeps unknown keys out and known ones typed.
 */
import type { NameChip } from "../../components/common/ChipInputComponent/ChipInputComponent";

export type ComposeDraftKind = "mail" | "thread";

export interface DraftAttachmentMeta {
  name: string;
  size: number;
  type: string | null;
}

export interface DraftReplyReference {
  id: string;
  user: string;
  subject?: string;
  createdAt?: number;
}

export interface StoredComposeDraft {
  draftId: string;
  fromName: string;
  toName: string;
  subject: string;
  value: string;
  aliasValue: string;
  showAlias: boolean;
  showBCC: boolean;
  bccNames: NameChip[];
  updatedAt: number;
  /** Additive: "mail" (default when absent) or "thread" (a group thread post). */
  kind?: ComposeDraftKind;
  /** Additive: names and sizes only; file bytes are never stored. */
  attachments?: DraftAttachmentMeta[];
  /** Additive: the message a reply draft answers. */
  replyTo?: DraftReplyReference | null;
  replyAll?: boolean;
  /** Additive: visible Cc names (each gets its own copy, like Bcc). */
  ccNames?: NameChip[];
  showCC?: boolean;
  /** Additive, thread posts: where the post belongs. */
  groupId?: string;
  groupName?: string;
  threadId?: string | null;
  threadTitle?: string;
}

export interface ComposeDraftListItem {
  key: string;
  draft: StoredComposeDraft;
}

/** Fired on `window` after every write, so open lists refresh. */
export const COMPOSE_DRAFTS_CHANGED_EVENT = "qmail-compose-drafts-changed";

export const getComposeDraftsStorageKey = (address: string): string =>
  `qmail_compose_drafts_${address}`;

const normalize = (value: string): string => value.trim().toLowerCase();

export const composeDraftKey = (
  fromName: string,
  toName: string,
  replyToId?: string | null,
  replyAll = false
): string => {
  const base = `${normalize(fromName)}::${normalize(toName)}`;
  if (!replyToId) return base;
  return `${base}::${replyAll ? "replyall" : "reply"}:${replyToId}`;
};

export const threadDraftKey = (groupId: string | number, threadId?: string | null): string =>
  `thread::${String(groupId).trim()}::${threadId ? String(threadId).trim() : "new"}`;

export const createComposeDraftId = (fromName: string, toName: string, updatedAt: number): string =>
  `${fromName}-${toName}-Draft-${updatedAt}`;

function sanitizeAttachments(value: unknown): DraftAttachmentMeta[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .map((item: any): DraftAttachmentMeta | null => {
      const name = typeof item?.name === "string" ? item.name : "";
      if (!name) return null;
      return {
        name,
        size: Number.isFinite(Number(item?.size)) ? Number(item.size) : 0,
        type: typeof item?.type === "string" ? item.type : null,
      };
    })
    .filter((item): item is DraftAttachmentMeta => Boolean(item));
  return items.length ? items : undefined;
}

function sanitizeNameChips(value: unknown): NameChip[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const chips = value.filter(
    (item: any): item is NameChip =>
      Boolean(item) &&
      typeof item.name === "string" &&
      Boolean(item.name.trim()) &&
      typeof item.publicKey === "string" &&
      Boolean(item.publicKey) &&
      typeof item.address === "string" &&
      Boolean(item.address)
  );
  return chips.length
    ? chips.map(item => ({ name: item.name, publicKey: item.publicKey, address: item.address }))
    : undefined;
}

function sanitizeReplyTo(value: unknown): DraftReplyReference | null | undefined {
  if (value === null) return null;
  if (!value || typeof value !== "object") return undefined;
  const anyValue = value as any;
  const id = typeof anyValue.id === "string" ? anyValue.id : "";
  const user = typeof anyValue.user === "string" ? anyValue.user : "";
  if (!id || !user) return undefined;
  return {
    id,
    user,
    subject: typeof anyValue.subject === "string" ? anyValue.subject : undefined,
    createdAt: Number.isFinite(Number(anyValue.createdAt)) ? Number(anyValue.createdAt) : undefined,
  };
}

export function sanitizeComposeDraft(value: unknown): StoredComposeDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const draft = value as Partial<StoredComposeDraft>;
  const fromName = typeof draft.fromName === "string" ? draft.fromName.trim() : "";
  const toName = typeof draft.toName === "string" ? draft.toName.trim() : "";
  if (!fromName || !toName) return null;

  const sanitized: StoredComposeDraft = {
    draftId:
      typeof draft.draftId === "string" && draft.draftId.trim()
        ? draft.draftId.trim()
        : createComposeDraftId(fromName, toName, Date.now()),
    fromName,
    toName,
    subject: typeof draft.subject === "string" ? draft.subject : "",
    value: typeof draft.value === "string" ? draft.value : "",
    aliasValue: typeof draft.aliasValue === "string" ? draft.aliasValue : "",
    showAlias: Boolean(draft.showAlias),
    showBCC: Boolean(draft.showBCC),
    bccNames: Array.isArray(draft.bccNames) ? draft.bccNames : [],
    updatedAt: Number(draft.updatedAt || 0),
  };
  if (draft.kind === "thread") sanitized.kind = "thread";
  const attachments = sanitizeAttachments(draft.attachments);
  if (attachments) sanitized.attachments = attachments;
  const replyTo = sanitizeReplyTo(draft.replyTo);
  if (replyTo !== undefined) sanitized.replyTo = replyTo;
  if (draft.replyAll) sanitized.replyAll = true;
  const ccNames = sanitizeNameChips(draft.ccNames);
  if (ccNames) sanitized.ccNames = ccNames;
  if (draft.showCC) sanitized.showCC = true;
  if (typeof draft.groupId === "string" && draft.groupId.trim()) sanitized.groupId = draft.groupId.trim();
  if (typeof draft.groupName === "string" && draft.groupName.trim()) sanitized.groupName = draft.groupName.trim();
  if (typeof draft.threadId === "string" && draft.threadId.trim()) sanitized.threadId = draft.threadId.trim();
  if (typeof draft.threadTitle === "string") sanitized.threadTitle = draft.threadTitle;
  return sanitized;
}

const THREAD_KEY_PATTERN = /^thread::(\d+)::(new|qortal_qmail_thread_group\S+)$/;
const REPLY_KEY_PATTERN = /::reply(all)?:(.+)$/;

/**
 * The original Q-Mail rewrites every entry of the shared map with only its
 * ten base fields whenever it saves a draft, which strips `kind`, `groupId`,
 * `threadId` and `replyTo`. The map key survives, so the routing is rebuilt
 * from it: a thread post must never reopen as direct mail to the group's name.
 */
export function withRoutingFromKey(key: string, draft: StoredComposeDraft): StoredComposeDraft {
  const thread = THREAD_KEY_PATTERN.exec(key);
  if (thread) {
    const restored: StoredComposeDraft = { ...draft, kind: "thread" };
    if (!restored.groupId) restored.groupId = thread[1];
    if (!restored.groupName) restored.groupName = draft.toName;
    if (restored.threadId === undefined) restored.threadId = thread[2] === "new" ? null : thread[2];
    if (restored.threadTitle === undefined && thread[2] === "new") restored.threadTitle = draft.subject;
    return restored;
  }
  const reply = REPLY_KEY_PATTERN.exec(key);
  if (reply && draft.kind !== "thread") {
    let restored = draft;
    if (draft.replyTo === undefined) restored = { ...restored, replyTo: { id: reply[2], user: draft.toName } };
    if (reply[1] && !draft.replyAll) restored = { ...restored, replyAll: true };
    return restored;
  }
  return draft;
}

export function readComposeDrafts(address: string): Record<string, StoredComposeDraft> {
  try {
    const raw = localStorage.getItem(getComposeDraftsStorageKey(address));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const sanitized: Record<string, StoredComposeDraft> = {};
    Object.entries(parsed).forEach(([key, value]) => {
      if (!key) return;
      const draft = sanitizeComposeDraft(value);
      if (draft) sanitized[key] = withRoutingFromKey(key, draft);
    });
    return sanitized;
  } catch {
    return {};
  }
}

function notifyChanged(address: string): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(COMPOSE_DRAFTS_CHANGED_EVENT, { detail: { address } }));
  } catch {
    // Ignore: an old browser without CustomEvent still keeps the data.
  }
}

export function writeComposeDrafts(address: string, drafts: Record<string, StoredComposeDraft>): void {
  try {
    localStorage.setItem(getComposeDraftsStorageKey(address), JSON.stringify(drafts));
  } catch {
    // Ignore storage failures (quota, private mode).
  }
  notifyChanged(address);
}

export function saveComposeDraft(address: string, key: string, draft: StoredComposeDraft): void {
  if (!address || !key) return;
  const drafts = readComposeDrafts(address);
  drafts[key] = draft;
  writeComposeDrafts(address, drafts);
}

/** Removes one draft. Returns true when something was deleted. */
export function deleteComposeDraft(address: string, key: string | null | undefined): boolean {
  const normalizedKey = typeof key === "string" ? key.trim() : "";
  if (!address || !normalizedKey) return false;
  const drafts = readComposeDrafts(address);
  if (!drafts[normalizedKey]) return false;
  delete drafts[normalizedKey];
  writeComposeDrafts(address, drafts);
  return true;
}

/** Every draft, newest first. */
export function listComposeDrafts(address: string): ComposeDraftListItem[] {
  if (!address) return [];
  return Object.entries(readComposeDrafts(address))
    .map(([key, draft]) => ({ key, draft }))
    .sort((a, b) => b.draft.updatedAt - a.draft.updatedAt);
}

export function countComposeDrafts(address: string): number {
  return listComposeDrafts(address).length;
}

/** A one-line text preview of the draft body (no DOM needed). */
export function draftSnippet(value: unknown, maxLength = 120): string {
  if (typeof value !== "string" || !value) return "";
  const text = value
    .replace(/<\s*br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

/** Calls `listener` whenever drafts change in this tab or another one. */
export function subscribeToComposeDrafts(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key.startsWith("qmail_compose_drafts_")) listener();
  };
  window.addEventListener(COMPOSE_DRAFTS_CHANGED_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(COMPOSE_DRAFTS_CHANGED_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

export interface ComposerContentInput {
  subject: string;
  /** The subject the composer started with ("Re: …", "Fwd: …", a prefill). */
  initialSubject: string;
  value: string;
  /** The body the composer started with, as the editor normalised it. */
  initialValue: string;
  aliasValue: string;
  attachmentCount: number;
  bccNames: { name: string }[];
  ccNames: { name: string }[];
  /** Cc names Reply all filled in by itself. */
  initialCcNames: string[];
  /** Visible text of an HTML body. */
  textOf: (html: string) => string;
}

const sameNameSet = (chips: { name: string }[], names: string[]): boolean => {
  const a = new Set(chips.map(chip => normalize(chip?.name || "")).filter(Boolean));
  const b = new Set(names.map(normalize).filter(Boolean));
  if (a.size !== b.size) return false;
  for (const name of a) if (!b.has(name)) return false;
  return true;
};

/**
 * Whether the composer holds something the user wrote, which is what makes
 * a draft worth saving and Discard worth confirming. What the composer
 * filled in by itself (the reply quote or forward header, the Re:/Fwd:
 * subject, Reply all's Cc names) does not count.
 */
export function hasComposerContent(input: ComposerContentInput): boolean {
  const subjectChanged = Boolean(input.subject.trim()) && input.subject !== input.initialSubject;
  const bodyChanged = input.value !== input.initialValue && Boolean(input.textOf(input.value).trim());
  const ccChanged = input.ccNames.length > 0 && !sameNameSet(input.ccNames, input.initialCcNames);
  return Boolean(
    subjectChanged ||
      bodyChanged ||
      ccChanged ||
      input.aliasValue.trim() ||
      input.bccNames.length ||
      input.attachmentCount
  );
}
