/**
 * What a name has published, which goes with it to its buyer (QDN keeps
 * everything under the name): one search of the name's resources, every
 * service (pages of 100, at most 300), counted by service. Read only for the
 * cards on screen, three names at a time, once a session.
 *
 * Its avatar (THUMBNAIL `qortal_avatar`) shows on the card itself and isn't
 * counted, nor its auction's listing. Private services (`…_PRIVATE`: mail, orders…) are encrypted to
 * their recipients: they go with the name but its new owner can't read them,
 * so they are counted apart.
 */
import { useEffect, useState } from "react";
import { NAME_AUCTION_ID } from "./auctions";

export const CONTENT_PAGE = 100;
export const CONTENT_MAX_PAGES = 3;
const CONCURRENCY = 3;

export interface NameContent {
  /** Readable resources by service, most first. */
  services: { service: string; count: number }[];
  /** Encrypted ones (…_PRIVATE). */
  privateCount: number;
  total: number;
  /** More than were read (300+). */
  capped: boolean;
}

type Fetch = (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

export function contentUrl(name: string, offset: number): string {
  const p = new URLSearchParams({ mode: "ALL", name, exactmatchnames: "true", limit: String(CONTENT_PAGE), offset: String(offset), includemetadata: "false", reverse: "true" });
  return `/arbitrary/resources/search?${p.toString()}`;
}

/** The name's resources counted (only the name's own: Core's name filter is exact here, and it's checked again). */
export function summarizeContent(rows: readonly unknown[], name: string, capped: boolean): NameContent {
  const counts = new Map<string, number>();
  let privateCount = 0;
  let total = 0;
  for (const row of rows) {
    const r = row as { name?: unknown; service?: unknown; identifier?: unknown } | null;
    if (!r || r.name !== name || typeof r.service !== "string") continue;
    if (r.service === "THUMBNAIL" && r.identifier === "qortal_avatar") continue;
    // Its auction's own listing (names/auctions.ts) is the sale, not something that comes with it.
    if (r.service === "DOCUMENT" && r.identifier === NAME_AUCTION_ID) continue;
    total++;
    if (r.service.endsWith("_PRIVATE")) privateCount++;
    else counts.set(r.service, (counts.get(r.service) ?? 0) + 1);
  }
  const services = [...counts].map(([service, count]) => ({ service, count })).sort((a, b) => b.count - a.count || a.service.localeCompare(b.service));
  return { services, privateCount, total, capped };
}

const results = new Map<string, Promise<NameContent>>();
let running = 0;
const queue: (() => void)[] = [];

function slot<T>(work: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const start = () => {
      running++;
      work()
        .then(resolve, reject)
        .finally(() => {
          running--;
          queue.shift()?.();
        });
    };
    if (running < CONCURRENCY) start();
    else queue.push(start);
  });
}

export function fetchNameContent(name: string, get: Fetch = (url) => fetch(url)): Promise<NameContent> {
  let hit = results.get(name);
  if (!hit) {
    hit = slot(async () => {
      const rows: unknown[] = [];
      for (let page = 0; page < CONTENT_MAX_PAGES; page++) {
        const response = await get(contentUrl(name, page * CONTENT_PAGE));
        if (!response.ok) throw new Error("The node couldn't search the name's resources");
        const chunk = await response.json();
        if (!Array.isArray(chunk)) throw new Error("The node's answer isn't a list");
        rows.push(...chunk);
        if (chunk.length < CONTENT_PAGE) return summarizeContent(rows, name, false);
      }
      return summarizeContent(rows, name, true);
    });
    // A failed read can be tried again later.
    hit.catch(() => results.delete(name));
    results.set(name, hit);
  }
  return hit;
}

/** The name's content once read (null while it loads; "failed" when it couldn't be). */
export function useNameContent(name: string, enabled: boolean): NameContent | null | "failed" {
  const [state, setState] = useState<{ name: string; content: NameContent | "failed" } | null>(null);
  useEffect(() => {
    if (!enabled || !name) return;
    let alive = true;
    fetchNameContent(name).then(
      (content) => alive && setState({ name, content }),
      () => alive && setState({ name, content: "failed" })
    );
    return () => {
      alive = false;
    };
  }, [name, enabled]);
  return state?.name === name ? state.content : null;
}

const LABELS: Record<string, [string, string]> = {
  WEBSITE: ["website", "websites"],
  APP: ["Q-App", "Q-Apps"],
  VIDEO: ["video", "videos"],
  AUDIO: ["audio file", "audio files"],
  IMAGE: ["image", "images"],
  THUMBNAIL: ["thumbnail", "thumbnails"],
  DOCUMENT: ["document", "documents"],
  FILE: ["file", "files"],
  FILES: ["file set", "file sets"],
  BLOG: ["blog", "blogs"],
  BLOG_POST: ["blog post", "blog posts"],
  BLOG_COMMENT: ["blog comment", "blog comments"],
  PLAYLIST: ["playlist", "playlists"],
  STORE: ["shop", "shops"],
  PRODUCT: ["product", "products"],
  GAME: ["game", "games"],
  ITEM: ["item", "items"],
  PODCAST: ["podcast", "podcasts"],
  VOICE: ["voice message", "voice messages"],
  JSON: ["data file", "data files"],
  COMMENT: ["comment", "comments"],
  CHAIN_COMMENT: ["comment", "comments"],
  METADATA: ["metadata file", "metadata files"],
  GIF_REPOSITORY: ["GIF collection", "GIF collections"],
  ATTACHMENT: ["attachment", "attachments"],
  QCHAT_ATTACHMENT: ["chat attachment", "chat attachments"],
  QCHAT_IMAGE: ["chat image", "chat images"],
};

/** "3 videos", "1 website", "2 IMAGE_X files" for an unknown service. */
export function serviceLabel(service: string, count: number): string {
  const known = LABELS[service];
  if (known) return `${count.toLocaleString("en-US")} ${count === 1 ? known[0] : known[1]}`;
  return `${count.toLocaleString("en-US")} ${service.toLowerCase().replace(/_/g, " ")}`;
}

/** For tests. */
export function resetNameContent(): void {
  results.clear();
}
