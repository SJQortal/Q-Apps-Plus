import { describe, expect, it, vi } from "vitest";
import {
  loadPublishedStateDocument,
  publishedStateSearchParams,
} from "./publishedStateLoad";

const params = publishedStateSearchParams("alice", "DOCUMENT_PRIVATE", "qmail_state_v1");

function deps(overrides: Partial<Parameters<typeof loadPublishedStateDocument>[0]> = {}) {
  return {
    autoApply: false,
    search: vi.fn(async () => [{ name: "alice" }]),
    fetchDocument: vi.fn(async () => "BASE64"),
    confirm: vi.fn(async () => true),
    ...overrides,
  };
}

describe("publishedStateSearchParams", () => {
  it("asks for one exact-name row of the state document", () => {
    expect(params.get("limit")).toBe("1");
    expect(params.get("name")).toBe("alice");
    expect(params.get("exactmatchnames")).toBe("true");
    expect(params.get("service")).toBe("DOCUMENT_PRIVATE");
    expect(params.get("identifier")).toBe("qmail_state_v1");
  });
});

describe("loadPublishedStateDocument", () => {
  it("never fetches when nothing is published (no 404 per load)", async () => {
    for (const autoApply of [false, true]) {
      const d = deps({ autoApply, search: vi.fn(async () => []) });
      await expect(loadPublishedStateDocument(d, params)).resolves.toEqual({ status: "none" });
      expect(d.fetchDocument).not.toHaveBeenCalled();
      expect(d.confirm).not.toHaveBeenCalled();
    }
  });

  it("auto-apply: fetches without asking when the document exists", async () => {
    const d = deps({ autoApply: true });
    await expect(loadPublishedStateDocument(d, params)).resolves.toEqual({
      status: "loaded",
      encoded: "BASE64",
    });
    expect(d.search).toHaveBeenCalledWith(params);
    expect(d.confirm).not.toHaveBeenCalled();
  });

  it("starts the download before the prompt is answered", async () => {
    let answer: (value: boolean) => void = () => {};
    const d = deps({ confirm: vi.fn(() => new Promise<boolean>((r) => (answer = r))) });
    const result = loadPublishedStateDocument(d, params);
    await vi.waitFor(() => expect(d.confirm).toHaveBeenCalled());
    expect(d.fetchDocument).toHaveBeenCalledTimes(1);
    answer(true);
    await expect(result).resolves.toEqual({ status: "loaded", encoded: "BASE64" });
  });

  it("declining leaves a failed download unhandled-free", async () => {
    const d = deps({
      confirm: vi.fn(async () => false),
      fetchDocument: vi.fn(() => Promise.reject(new Error("404"))),
    });
    await expect(loadPublishedStateDocument(d, params)).resolves.toEqual({ status: "declined" });
  });

  it("a failed search still fetches with auto-apply on, and gives up without it", async () => {
    const failing = vi.fn(async () => {
      throw new Error("QDN search failed (500)");
    });
    const auto = deps({ autoApply: true, search: failing });
    await expect(loadPublishedStateDocument(auto, params)).resolves.toEqual({
      status: "loaded",
      encoded: "BASE64",
    });
    const ask = deps({ search: failing });
    await expect(loadPublishedStateDocument(ask, params)).rejects.toThrow("500");
    expect(ask.fetchDocument).not.toHaveBeenCalled();
  });
});
