/**
 * The shop's links (Simon, 2026-10-26: "a dedicated field … add the link
 * there and then it will be nicely themed and with avatar of the website or
 * q-app"): up to four qortal:// addresses, each with the seller's own name
 * for it, shown under the description as cards with the app's or website's
 * avatar (its name's `qortal_avatar`). In the shop's JSON as
 * `links: [{url, label?}]` (additive; read safely here).
 */

export interface ShopLink {
  url: string;
  label?: string;
}

export const MAX_SHOP_LINKS = 4;
export const MAX_LINK_LABEL = 40;
const MAX_LINK_URL = 300;

/** A qortal:// address with something after it, no spaces. */
export function isShopLinkUrl(url: string): boolean {
  return url.length <= MAX_LINK_URL && /^qortal:\/\/[^\s/][^\s]*$/i.test(url);
}

/** The shop's links, valid ones only, each once, at most four. */
export function shopLinksOf(shop: { links?: unknown } | null | undefined): ShopLink[] {
  const raw = shop?.links;
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ShopLink[] = [];
  for (const item of raw) {
    const url = typeof item?.url === "string" ? item.url.trim() : "";
    if (!isShopLinkUrl(url) || seen.has(url.toLowerCase())) continue;
    seen.add(url.toLowerCase());
    const label = typeof item.label === "string" ? item.label.trim().slice(0, MAX_LINK_LABEL) : "";
    out.push(label ? { url, label } : { url });
    if (out.length === MAX_SHOP_LINKS) break;
  }
  return out;
}

function decoded(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

const KINDS: Record<string, string> = { APP: "Q-App", WEBSITE: "Website", VIDEO: "Video", DOCUMENT: "Document", IMAGE: "Picture", AUDIO: "Audio", FILE: "File" };

/**
 * Whose it is and what: `qortal://APP/Q-Blog/…` is the Q-App Q-Blog,
 * `qortal://WEBSITE/Name` or `qortal://Name` a website, `qortal://VIDEO/Name/id`
 * Name's video. The name's avatar stands for it.
 */
export function shopLinkTarget(url: string): { name: string; kind: string } {
  const rest = url.replace(/^qortal:\/\//i, "").split(/[?#]/, 1)[0];
  const [first = "", second = ""] = rest.split("/");
  if (second && /^[A-Za-z][A-Za-z0-9_]*$/.test(first) && first === first.toUpperCase()) {
    const service = first.toUpperCase();
    return { name: decoded(second), kind: KINDS[service] ?? service.charAt(0) + service.slice(1).toLowerCase().replace(/_/g, " ") };
  }
  return { name: decoded(first), kind: "Website" };
}
