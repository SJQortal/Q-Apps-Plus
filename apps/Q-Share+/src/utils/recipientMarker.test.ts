import { beforeEach, describe, expect, it } from "vitest";
import { fetchCallsMatching, mockFetch } from "../test/setup";
import {
  MAX_MARKERS,
  ownerAddress,
  recipientMarker,
  resetOwnerAddresses,
  stripRecipientMarkers,
  withRecipientMarkers,
} from "./recipientMarker";

const ALICE = "Q9aWbQnCZXmuNNkpg6t4sTCk8CRYoGF7Ce";
const BOB = "QWEsSfJdVa1DR4HPDQ29iRXSNtDdZ9H8fZ";

describe("recipient markers", () => {
  it("tags an account by the end of its address", () => {
    expect(recipientMarker(ALICE)).toBe("~qsn-Ck8CRYoGF7Ce~");
  });

  it("adds markers after the text, without repeats, at most four, within QDN's 240 characters", () => {
    const text = "x".repeat(150);
    const many = [ALICE, BOB, ALICE, "Q1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "Q2bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "Q3cccccccccccccccccccccccccccccccc"];
    const described = withRecipientMarkers(text, many);
    expect(described.match(/~qsn-/g)).toHaveLength(MAX_MARKERS);
    expect(described.length).toBeLessThanOrEqual(240);
    expect(described.startsWith(`${text} ${recipientMarker(ALICE)}${recipientMarker(BOB)}`)).toBe(true);
    expect(withRecipientMarkers("Docs", [])).toBe("Docs");
    expect(withRecipientMarkers("", [BOB])).toBe(recipientMarker(BOB));
  });

  it("strips them again for display", () => {
    expect(stripRecipientMarkers(withRecipientMarkers("Holiday photos", [ALICE, BOB]))).toBe("Holiday photos");
    expect(stripRecipientMarkers(recipientMarker(BOB))).toBe("");
    // Text that only looks similar stays.
    expect(stripRecipientMarkers("~qsn-short~ and ~other~")).toBe("~qsn-short~ and ~other~");
  });
});

describe("ownerAddress", () => {
  beforeEach(() => resetOwnerAddresses());

  it("asks Core once per name for the session, name encoded", async () => {
    mockFetch("/names/", (url: URL) =>
      decodeURIComponent(url.pathname) === "/names/Vallot-/8/" ? { name: "Vallot-/8/", owner: ALICE } : { error: 401 }
    );
    expect(await ownerAddress("Vallot-/8/")).toBe(ALICE);
    expect(await ownerAddress("vallot-/8/")).toBe(ALICE);
    expect(fetchCallsMatching("/names/")).toEqual(["/names/Vallot-%2F8%2F"]);
  });

  it("answers null for an unknown name and asks again next time", async () => {
    mockFetch("/names/", { error: 401, message: "name unknown" });
    expect(await ownerAddress("nobody")).toBeNull();
    expect(await ownerAddress("nobody")).toBeNull();
    expect(fetchCallsMatching("/names/nobody")).toHaveLength(2);
  });
});
