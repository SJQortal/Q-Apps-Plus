/**
 * The catalogues this session last sent, and when. Right after a publish the
 * node may still serve a catalogue from before it, and an edit or a delete
 * built on that copy would undo the publish (a product's new title, or a
 * product just added). The product list alone can't tell: a details-only
 * edit doesn't change it. So for a few minutes after sending a catalogue, a
 * copy that differs from what was sent counts as the node lagging behind.
 */

/** How long after sending a catalogue a different copy counts as the node lagging. */
export const SENT_CATALOGUE_WINDOW_MS = 10 * 60 * 1000;

const sent = new Map<string, { body: string; copy: Record<string, unknown>; at: number }>();

/** The same JSON, whatever the key order. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

/** Only the catalogue's own fields: the app's copies also carry `user` and `isValid`. */
function stored(catalogue: object): unknown {
  const { user: _user, isValid: _isValid, ...rest } = catalogue as Record<string, unknown>;
  return rest;
}

export function noteSentCatalogue(owner: string, catalogue: { id: string; [key: string]: unknown }, now = Date.now()): void {
  const copy = structuredClone(stored(catalogue)) as Record<string, unknown>;
  sent.set(`${owner}\n${catalogue.id}`, { body: canonical(copy), copy, at: now });
}

/** What this session last sent for the catalogue, within the window (a copy), else null. */
export function sentCatalogue(owner: string, catalogueId: string, now = Date.now()): Record<string, unknown> | null {
  const last = sent.get(`${owner}\n${catalogueId}`);
  return last && now - last.at <= SENT_CATALOGUE_WINDOW_MS ? structuredClone(last.copy) : null;
}

/** True when this session sent the catalogue minutes ago and the node serves something else. */
export function isCatalogueBehind(owner: string, catalogueId: string, served: object, now = Date.now()): boolean {
  const last = sent.get(`${owner}\n${catalogueId}`);
  if (!last || now - last.at > SENT_CATALOGUE_WINDOW_MS) return false;
  return canonical(stored(served)) !== last.body;
}

/** For tests. */
export function resetSentCatalogues(): void {
  sent.clear();
}
