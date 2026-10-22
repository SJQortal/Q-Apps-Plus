import { afterEach, describe, expect, it, vi } from "vitest";
import { installQortalMock } from "../test/qortalMock";
import { base64ToJson } from "../qdn/payloads";
import {
  SETTINGS_SYNC_IDENTIFIER,
  buildSettingsPublish,
  collectSettingsSnapshot,
  fetchSettingsFromQdn,
  normalizeSettingsSnapshot,
  publishSettingsToQdn,
} from "./settingsQdn";

type Route = (url: string) => { status?: number; body: unknown };

/** A fetch that answers by URL and records what was asked. */
function stubFetch(route: Route): string[] {
  const urls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const url = String(input);
      urls.push(url);
      const { status = 200, body } = route(url);
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
        text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
      };
    })
  );
  return urls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("settings snapshot", () => {
  it("is {version: 1, theme, preferredCoin}, with unknown values as null", () => {
    expect(collectSettingsSnapshot("black", "ARRR")).toEqual({ version: 1, theme: "black", preferredCoin: "ARRR" });
    expect(collectSettingsSnapshot("ASSET:7", "ASSET:7")).toEqual({ version: 1, theme: null, preferredCoin: "ASSET:7" });
    expect(collectSettingsSnapshot("neon", "SHIB")).toEqual({ version: 1, theme: null, preferredCoin: null });
  });

  it("reads an object, JSON text, base64 JSON and a nested data field, and rejects other documents", () => {
    const stored = { version: 1, theme: "white", preferredCoin: "BTC" };
    const expected = { version: 1, theme: "white", preferredCoin: "BTC" };
    expect(normalizeSettingsSnapshot(stored)).toEqual(expected);
    expect(normalizeSettingsSnapshot(JSON.stringify(stored))).toEqual(expected);
    expect(normalizeSettingsSnapshot(btoa(JSON.stringify(stored)))).toEqual(expected);
    expect(normalizeSettingsSnapshot({ data: JSON.stringify(stored) })).toEqual(expected);
    // Extra fields drop out, unknown values come back as null.
    expect(normalizeSettingsSnapshot({ version: 2, theme: "neon", preferredCoin: 5, extra: true })).toEqual({
      version: 1,
      theme: null,
      preferredCoin: null,
    });
    expect(normalizeSettingsSnapshot({ title: "a product" })).toBeNull();
    expect(normalizeSettingsSnapshot("not json")).toBeNull();
    expect(normalizeSettingsSnapshot(null)).toBeNull();
    expect(normalizeSettingsSnapshot([1, 2])).toBeNull();
  });
});

describe("Save to QDN", () => {
  it("publishes one DOCUMENT under the active name and the sync identifier", async () => {
    const q = installQortalMock({ PUBLISH_QDN_RESOURCE: async () => true });
    const snapshot = collectSettingsSnapshot("hub20", "LTC");
    await publishSettingsToQdn("Buyer+One", snapshot);

    const calls = q.callsFor("PUBLISH_QDN_RESOURCE");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      action: "PUBLISH_QDN_RESOURCE",
      service: "DOCUMENT",
      name: "Buyer+One",
      identifier: "qshopplus_settings",
      data64: expect.any(String),
      title: "Q-Shop+ settings",
      filename: "settings.json",
    });
    expect(base64ToJson(String(calls[0].data64))).toEqual({ version: 1, theme: "hub20", preferredCoin: "LTC" });
    expect(buildSettingsPublish("x", snapshot).identifier).toBe(SETTINGS_SYNC_IDENTIFIER);
    // Nothing else was asked of Hub.
    expect(q.calls).toHaveLength(1);
  });

  it("rejects when Hub declines, and without a name publishes nothing", async () => {
    const q = installQortalMock({
      PUBLISH_QDN_RESOURCE: async () => {
        throw { error: "User declined request" };
      },
    });
    await expect(publishSettingsToQdn("alice", collectSettingsSnapshot("hub30", "QORT"))).rejects.toBeTruthy();
    await expect(publishSettingsToQdn("", collectSettingsSnapshot("hub30", "QORT"))).rejects.toThrow();
    expect(q.callsFor("PUBLISH_QDN_RESOURCE")).toHaveLength(1);
  });
});

describe("Restore", () => {
  const docPath = `/arbitrary/DOCUMENT/Buyer%2BOne/${SETTINGS_SYNC_IDENTIFIER}`;

  it("reads the document with one fetch, the name encoded, and no search", async () => {
    const urls = stubFetch((url) =>
      url === docPath ? { body: { version: 1, theme: "black", preferredCoin: "DOGE" } } : { status: 404, body: { error: 1 } }
    );
    expect(await fetchSettingsFromQdn("Buyer+One")).toEqual({
      kind: "found",
      snapshot: { version: 1, theme: "black", preferredCoin: "DOGE" },
    });
    expect(urls).toEqual([docPath]);
    expect(await fetchSettingsFromQdn("")).toEqual({ kind: "none" });
  });

  it("says nothing is saved when the fetch fails and one exact existence search finds nothing", async () => {
    const urls = stubFetch((url) =>
      url.startsWith("/arbitrary/resources/search")
        ? { body: [] }
        : { body: { error: 1401, message: "Data unavailable. Please try again later." } }
    );
    expect(await fetchSettingsFromQdn("Buyer+One")).toEqual({ kind: "none" });
    const search = urls.find((u) => u.startsWith("/arbitrary/resources/search"));
    const params = new URLSearchParams(String(search).split("?")[1]);
    expect(params.get("service")).toBe("DOCUMENT");
    expect(params.get("identifier")).toBe(SETTINGS_SYNC_IDENTIFIER);
    expect(params.get("name")).toBe("Buyer+One");
    expect(params.get("exactmatchnames")).toBe("true");
    expect(params.get("limit")).toBe("50");
    expect(params.get("prefix")).toBe("true");
  });

  it("tells a save the node hasn't got yet apart from no save", async () => {
    stubFetch((url) =>
      url.startsWith("/arbitrary/resources/search")
        ? { body: [{ name: "Buyer+One", service: "DOCUMENT", identifier: SETTINGS_SYNC_IDENTIFIER, created: 1 }] }
        : { body: { error: 1401, message: "Data unavailable. Please try again later." } }
    );
    expect(await fetchSettingsFromQdn("Buyer+One")).toEqual({ kind: "not-local" });
  });

  it("reports an error when the node answers neither", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("Failed to fetch");
      })
    );
    expect(await fetchSettingsFromQdn("alice")).toEqual({ kind: "error" });
  });
});
