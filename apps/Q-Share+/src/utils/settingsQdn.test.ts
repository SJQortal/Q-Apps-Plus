import { describe, expect, it } from "vitest";
import { mockQortalAction, qortalCallsFor } from "../test/setup";
import { DEFAULT_SETTINGS } from "./settings";
import {
  SETTINGS_IDENTIFIER,
  buildSettingsPublish,
  collectSettingsSnapshot,
  fetchSettingsFromQdn,
  normalizeSettingsSnapshot,
  publishSettingsToQdn,
} from "./settingsQdn";

const settings = { ...DEFAULT_SETTINGS, defaultSort: "oldest" as const, hiddenNames: ["spammer", " spammer ", "Bob"] };

describe("settings sync to QDN", () => {
  it("collects a versioned snapshot with the theme and de-duplicated hidden names", () => {
    const snap = collectSettingsSnapshot(settings, "black", 1700000000000);
    expect(snap).toEqual({
      version: 1,
      autoPreviewImages: true,
      defaultSort: "oldest",
      hiddenNames: ["spammer", "Bob"],
      followingFeed: true,
      uiTheme: "black",
      updatedAt: 1700000000000,
    });
    expect(collectSettingsSnapshot(settings, "neon" as any, 1).uiTheme).toBeNull();
  });

  it("normalises an object, a JSON string and base64 JSON, and rejects other data", () => {
    const stored = { version: 1, defaultSort: "oldest", hiddenNames: ["x"], uiTheme: "white", updatedAt: 5 };
    const fromObject = normalizeSettingsSnapshot(stored);
    expect(fromObject?.defaultSort).toBe("oldest");
    expect(fromObject?.uiTheme).toBe("white");
    expect(fromObject?.updatedAt).toBe(5);
    expect(normalizeSettingsSnapshot(JSON.stringify(stored))?.hiddenNames).toEqual(["x"]);
    expect(normalizeSettingsSnapshot(btoa(JSON.stringify(stored)))?.uiTheme).toBe("white");
    expect(normalizeSettingsSnapshot({ data: JSON.stringify(stored) })?.defaultSort).toBe("oldest");
    // Unknown fields drop out, missing ones take defaults, an unknown theme is null.
    const partial = normalizeSettingsSnapshot({ version: 1, uiTheme: "neon", extra: true });
    expect(partial).toEqual({ ...collectSettingsSnapshot(DEFAULT_SETTINGS, null, 0), version: 1 });
    expect(normalizeSettingsSnapshot("not json")).toBeNull();
    expect(normalizeSettingsSnapshot({ title: "a share" })).toBeNull();
    expect(normalizeSettingsSnapshot(null)).toBeNull();
  });

  it("publishes one DOCUMENT under the fixed identifier whose data decodes to the snapshot", async () => {
    mockQortalAction("PUBLISH_QDN_RESOURCE", true);
    const snap = await publishSettingsToQdn("alice", settings, "hub20");
    const calls = qortalCallsFor("PUBLISH_QDN_RESOURCE");
    expect(calls.length).toBe(1);
    const call = calls[0] as any;
    expect(call).toMatchObject({
      service: "DOCUMENT",
      name: "alice",
      identifier: SETTINGS_IDENTIFIER,
      title: "Q-Share+ settings",
      filename: "settings.json",
    });
    expect(JSON.parse(atob(call.data64))).toEqual(snap);
    expect(snap.uiTheme).toBe("hub20");
    const built = await buildSettingsPublish("alice", snap);
    expect(built.identifier).toBe("qshareplus_settings");
  });

  it("rejects when Hub declines the publish", async () => {
    mockQortalAction("PUBLISH_QDN_RESOURCE", () => {
      throw { error: "User declined request" };
    });
    await expect(publishSettingsToQdn("alice", settings, "hub30")).rejects.toBeTruthy();
    await expect(publishSettingsToQdn("", settings, "hub30")).rejects.toThrow();
  });

  it("fetches with one FETCH_QDN_RESOURCE and returns null when nothing is stored", async () => {
    mockQortalAction("FETCH_QDN_RESOURCE", { version: 1, followingFeed: false, uiTheme: "black", updatedAt: 9 });
    const snap = await fetchSettingsFromQdn("alice");
    expect(snap?.followingFeed).toBe(false);
    expect(snap?.uiTheme).toBe("black");
    const call = qortalCallsFor("FETCH_QDN_RESOURCE")[0] as any;
    expect(call).toMatchObject({ name: "alice", service: "DOCUMENT", identifier: SETTINGS_IDENTIFIER });

    mockQortalAction("FETCH_QDN_RESOURCE", () => {
      throw new Error("404");
    });
    expect(await fetchSettingsFromQdn("alice")).toBeNull();
    expect(await fetchSettingsFromQdn("")).toBeNull();
  });
});
