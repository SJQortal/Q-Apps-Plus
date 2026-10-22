import { beforeEach, describe, expect, it, vi } from "vitest";
import { assetAvatarIdentifier, assetAvatarUrl, resetAssetAvatars } from "./assetAvatar";
import { resetAssetCache } from "./assets";
import { resetQdnCaches } from "./search";

const OWNER = "QfX9KhXnoB78v2D36j7nocKaYtzUYcyQyH";
const ID = "asset88_BHC Coin_aavatar";

/** The node as on mainnet (2026-10-22): asset 88 "BHC Coin", two avatars under two of its owner's names, one under someone else's. */
function stubNode(
  rows: { name: string; updated: number }[],
  owners: Record<string, string>,
  primary = "Simon James",
  thumbnails: string[] = []
) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const url = String(input);
      calls.push(url);
      const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });
      if (url.startsWith("/assets/info?assetId=88")) return ok({ assetId: 88, owner: OWNER, name: "BHC Coin", isDivisible: true, isUnspendable: false });
      if (url.startsWith("/arbitrary/resources/search") && url.includes("service=THUMBNAIL")) {
        return ok(thumbnails.map((name) => ({ name, service: "THUMBNAIL", identifier: "qortal_avatar" })));
      }
      if (url.startsWith("/arbitrary/resources/search")) return ok(rows.map((r) => ({ service: "IMAGE", identifier: ID, ...r })));
      if (url === `/names/primary/${OWNER}`) return ok({ name: primary, owner: OWNER });
      const name = url.match(/^\/names\/(.+)$/);
      if (name) return ok({ name: decodeURIComponent(name[1]), owner: owners[decodeURIComponent(name[1])] ?? "QSomeoneElse" });
      return { ok: false, status: 404, json: async () => ({}), text: async () => "{}" };
    })
  );
  return calls;
}

beforeEach(() => {
  resetAssetAvatars();
  resetAssetCache();
  resetQdnCaches();
});

describe("asset avatars (Q-Assets' convention)", () => {
  it("names the identifier as Q-Assets publishes it", () => {
    expect(assetAvatarIdentifier(88, "BHC Coin")).toBe(ID);
  });

  it("takes the avatar of the name spelled as the coin first, when its issuer holds that name", async () => {
    const calls = stubNode([{ name: "Simon James", updated: 2 }], { "BHC Coin": OWNER }, "Simon James", ["BHC Coin"]);
    expect(await assetAvatarUrl(88)).toBe("/arbitrary/THUMBNAIL/BHC%20Coin/qortal_avatar");
    // Nothing more is read once the coin's own name has one.
    expect(calls.filter((u) => u.includes("service=IMAGE"))).toEqual([]);
  });

  it("never takes the avatar of a name spelled as the coin that someone else holds", async () => {
    stubNode([{ name: "Simon James", updated: 2 }], { "BHC Coin": "QSomeoneElse" }, "Simon James", ["BHC Coin"]);
    expect(await assetAvatarUrl(88)).toBe("/arbitrary/IMAGE/Simon%20James/asset88_BHC%20Coin_aavatar");
  });

  it("takes the owner's primary name's avatar first, even when another of its names published one later", async () => {
    stubNode(
      [
        { name: "Biohackers Corner", updated: 3 },
        { name: "Simon James", updated: 2 },
        { name: "Mallory", updated: 9 },
      ],
      { "Biohackers Corner": OWNER }
    );
    expect(await assetAvatarUrl(88)).toBe("/arbitrary/IMAGE/Simon%20James/asset88_BHC%20Coin_aavatar");
  });

  it("takes another of the owner's names when the primary has none, and never someone else's", async () => {
    stubNode(
      [
        { name: "Mallory", updated: 9 },
        { name: "Biohackers Corner", updated: 3 },
      ],
      { "Biohackers Corner": OWNER }
    );
    expect(await assetAvatarUrl(88)).toBe("/arbitrary/IMAGE/Biohackers%20Corner/asset88_BHC%20Coin_aavatar");
    resetAssetAvatars();
    stubNode([{ name: "Mallory", updated: 9 }], {});
    expect(await assetAvatarUrl(88)).toBeNull();
  });

  it("asks once a session, whatever the number of icons", async () => {
    const calls = stubNode([{ name: "Simon James", updated: 2 }], {});
    await Promise.all([assetAvatarUrl(88), assetAvatarUrl(88), assetAvatarUrl(88)]);
    expect(calls.filter((u) => u.startsWith("/arbitrary/resources/search"))).toHaveLength(1);
    expect(calls.filter((u) => u.startsWith("/assets/info"))).toHaveLength(1);
  });
});
