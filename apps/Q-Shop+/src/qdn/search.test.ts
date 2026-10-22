import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QdnDeletedError, QdnFetchError, fetchQdnJson, isDeleteMarker, resetQdnCaches } from "./search";

function stubBody(text: string, status = 200) {
  const fetchMock = vi.fn(async () => ({ ok: status >= 200 && status < 300, status, text: async () => text }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => resetQdnCaches());
afterEach(() => vi.unstubAllGlobals());

describe("the delete marker", () => {
  it("is the \"D\" a delete publishes, or an empty body", () => {
    expect(isDeleteMarker("D")).toBe(true);
    expect(isDeleteMarker("D\n")).toBe(true);
    expect(isDeleteMarker("\n")).toBe(true);
    expect(isDeleteMarker("")).toBe(true);
    expect(isDeleteMarker("DD")).toBe(false);
    expect(isDeleteMarker("{}")).toBe(false);
  });

  it("makes a read reject with QdnDeletedError, still a QdnFetchError for older callers", async () => {
    stubBody("D");
    const read = fetchQdnJson("STORE", "Seller Name", "q-store-general-my-shop");
    await expect(read).rejects.toBeInstanceOf(QdnDeletedError);
    await expect(read).rejects.toBeInstanceOf(QdnFetchError);
  });

  it("isn't cached, so a shop created again under the id is read at once", async () => {
    const fetchMock = stubBody("D");
    await expect(fetchQdnJson("STORE", "Seller Name", "q-store-general-my-shop")).rejects.toBeInstanceOf(QdnDeletedError);
    stubBody(JSON.stringify({ title: "Back again" }));
    await expect(fetchQdnJson("STORE", "Seller Name", "q-store-general-my-shop")).resolves.toEqual({ title: "Back again" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("only counts on a 200: an error page or other text is not a delete", async () => {
    stubBody("", 404);
    await expect(fetchQdnJson("STORE", "Seller Name", "q-store-general-my-shop")).rejects.not.toBeInstanceOf(QdnDeletedError);
    stubBody("<html>Bad gateway</html>");
    const read = fetchQdnJson("STORE", "Seller Name", "q-store-general-other");
    await expect(read).rejects.toBeInstanceOf(QdnFetchError);
    await expect(read).rejects.not.toBeInstanceOf(QdnDeletedError);
  });
});
