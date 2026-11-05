import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetQdnCaches } from "../qdn/search";
import { fetchStockNotes, NOTES_PAGE } from "./notes";

let rows: Record<string, unknown>[] = [];
const urls: string[] = [];

beforeEach(() => {
  resetQdnCaches();
  urls.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      urls.push(url);
      const offset = Number(new URL(url, "http://n").searchParams.get("offset"));
      return { ok: true, json: async () => rows.slice(offset, offset + NOTES_PAGE) };
    })
  );
});

afterEach(() => vi.unstubAllGlobals());

const row = (uid: string, created: number, description?: string, short = "my-shop", name = "Ann") => ({
  name,
  service: "DOCUMENT_PRIVATE",
  identifier: `q-store-order-${short}-${uid}`,
  created,
  ...(description && { metadata: { description } }),
});

describe("reading the shop's order notes", () => {
  it("reads the shop's orders newest first with their metadata, the shop compared exactly", async () => {
    rows = [
      row("ORDERxxxx3", 3000, "stock:PRODxxxxx1x2"),
      row("ORDERxxxx9", 2900, "stock:PRODxxxxx1x5", "my-shop-2"),
      row("ORDERxxxx2", 2000),
      row("ORDERxxxx1", 500, "stock:PRODxxxxx1x1"),
    ];
    const { notes, complete } = await fetchStockNotes("my-shop", 1000);
    expect(complete).toBe(true);
    expect(notes.map((n) => [n.orderUid, n.buyer, [...n.items]])).toEqual([["ORDERxxxx3", "Ann", [["PRODxxxxx1", 2]]]]);
    expect(urls[0]).toBe(
      "/arbitrary/resources/search?mode=ALL&service=DOCUMENT_PRIVATE&identifier=q-store-order-my-shop-&limit=100&offset=0&includemetadata=true&reverse=true&prefix=true"
    );
  });

  it("pages back only as far as the count's time", async () => {
    rows = Array.from({ length: 250 }, (_, i) => row(`ORDER${String(i).padStart(5, "0")}`, 10_000 - i, "stock:PRODxxxxx1x1"));
    const { notes } = await fetchStockNotes("my-shop", 10_000 - 150);
    expect(notes).toHaveLength(151);
    expect(urls).toHaveLength(2);
  });
});
