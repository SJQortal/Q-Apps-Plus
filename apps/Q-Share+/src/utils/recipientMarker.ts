/**
 * Recipient markers: a short tag in a collection's QDN description for each
 * account whose share the publish just added, so that account's Q-Share+ can
 * find "my share was added to a collection" with one description search
 * instead of reading every collection.
 *
 * A marker is `~qsn-` + the last 12 characters of the owner's address + `~`.
 * Addresses are public, and so is the share in the collection; the marker
 * names the account rather than the name so one search covers every name it
 * owns. Additive QDN metadata: the original Q-Share never reads collections,
 * and Q-Share+ strips markers wherever it shows a description.
 */

export const MARKER_TAIL = 12;
/** QDN metadata descriptions hold 240 characters: a 150-character text, a space and four markers. */
export const MAX_MARKERS = 4;

const MARKERS = /\s*~qsn-[1-9A-HJ-NP-Za-km-z]{12}~/g;

export function recipientMarker(address: string): string {
  return `~qsn-${address.slice(-MARKER_TAIL)}~`;
}

/** A description with any recipient markers taken out. */
export function stripRecipientMarkers(text: string): string {
  return text.replace(MARKERS, "").trim();
}

/** `text` followed by a marker for each address (at most MAX_MARKERS, repeats dropped). */
export function withRecipientMarkers(text: string, addresses: string[]): string {
  const markers = [...new Set(addresses.filter(Boolean).map(recipientMarker))].slice(0, MAX_MARKERS);
  return markers.length ? `${text} ${markers.join("")}`.trim() : text;
}

const owners = new Map<string, Promise<string | null>>();

/**
 * The address that owns `name`, from Core's `/names/<name>`, remembered for the
 * session. Null when Core doesn't know the name or doesn't answer: the publish
 * goes ahead without that marker.
 */
export function ownerAddress(name: string): Promise<string | null> {
  const key = name.toLowerCase();
  const known = owners.get(key);
  if (known) return known;
  const lookup = (async () => {
    try {
      const response = await fetch(`/names/${encodeURIComponent(name)}`, { method: "GET" });
      if (!response.ok) return null;
      const data = (await response.json()) as { owner?: unknown };
      return typeof data?.owner === "string" && data.owner.length > MARKER_TAIL ? data.owner : null;
    } catch {
      return null;
    }
  })();
  owners.set(key, lookup);
  // A failed lookup is not remembered, so the next publish asks again.
  lookup.then((address) => {
    if (!address && owners.get(key) === lookup) owners.delete(key);
  });
  return lookup;
}

/** For tests. */
export function resetOwnerAddresses(): void {
  owners.clear();
}
