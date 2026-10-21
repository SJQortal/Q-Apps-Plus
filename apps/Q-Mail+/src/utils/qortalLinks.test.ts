import { describe, expect, it, vi } from "vitest";
import { describeQortalLink, openQortalLink, parseQortalLink, stripTrailingPunctuation } from "./qortalLinks";
import { mockQortalAction, qortalCalls } from "../test/setup";

const EVENT = "0b0e8f3c-5a3d-4c6f-9e2a-1f2b3c4d5e6f";

describe("parseQortalLink", () => {
  it("reads Mugician's join link (Hub's qortalGroupLinks shape)", () => {
    expect(parseQortalLink("qortal://use-group/action-join/groupid-1176")).toEqual({
      kind: "join",
      link: "qortal://use-group/action-join/groupid-1176",
      groupId: 1176,
    });
    expect(parseQortalLink("QORTAL://USE-GROUP/ACTION-JOIN/GROUPID-9.")).toMatchObject({ kind: "join", groupId: 9 });
  });

  it("reads group calendar links, and treats other use-… links as Hub-only actions", () => {
    expect(parseQortalLink(`qortal://use-group/action-calendar/groupid-5/eventid-${EVENT.toUpperCase()}`)).toMatchObject({
      kind: "calendar",
      groupId: 5,
      eventId: EVENT,
    });
    expect(parseQortalLink("qortal://use-group/action-join/groupid-0")?.kind).toBe("action");
    expect(parseQortalLink("qortal://use-group/action-join/groupid-12/extra")?.kind).toBe("action");
    expect(parseQortalLink("qortal://use-embed/POLL/x")?.kind).toBe("action");
  });

  it("reads payment links", () => {
    expect(parseQortalLink("qortal://pay?recipient=Alice&amount=1")?.kind).toBe("payment");
    expect(parseQortalLink("qortal://send?to=QabcAddress")?.kind).toBe("payment");
  });

  it("reads app and resource links, uppercasing the service only for display", () => {
    expect(parseQortalLink("qortal://APP/Q-Tube/video/alice/qtube_vid_1")).toEqual({
      kind: "resource",
      link: "qortal://APP/Q-Tube/video/alice/qtube_vid_1",
      service: "APP",
      name: "Q-Tube",
    });
    expect(parseQortalLink("qortal://video/alice/qtube_vid_1?t=4")).toMatchObject({
      link: "qortal://video/alice/qtube_vid_1?t=4",
      service: "VIDEO",
      name: "alice",
    });
    expect(parseQortalLink("qortal://APP/Q-Blog#/post/x")).toMatchObject({ name: "Q-Blog", link: "qortal://APP/Q-Blog#/post/x" });
  });

  it("reads a bare name as a WEBSITE, as Hub does", () => {
    expect(parseQortalLink("qortal://REON")).toEqual({ kind: "resource", link: "qortal://REON", service: "WEBSITE", name: "REON" });
    expect(parseQortalLink("qortal://REON?x=1/y")).toMatchObject({ service: "WEBSITE", name: "REON", link: "qortal://REON?x=1/y" });
  });

  it("writes names with spaces and + the way Hub's Copy link does", () => {
    for (const raw of ["qortal://APP/Simon%20James/inbox", "qortal://APP/Simon James/inbox"]) {
      expect(parseQortalLink(raw)).toMatchObject({ link: "qortal://APP/Simon%20James/inbox", name: "Simon James" });
    }
    for (const raw of ["qortal://APP/Q-Share+/share/Alice%20Smith/id", "qortal://APP/Q-Share%2B/share/Alice%20Smith/id"]) {
      expect(parseQortalLink(raw)).toMatchObject({ link: "qortal://APP/Q-Share+/share/Alice%20Smith/id", name: "Q-Share+" });
    }
    // A literal % in the name: keep the sender's spelling rather than decode twice.
    expect(parseQortalLink("qortal://APP/100%25/x")).toMatchObject({ link: "qortal://APP/100%25/x", name: "100%" });
  });

  it("refuses links that could load something else", () => {
    for (const raw of [
      "qortal://APP/../Evil",
      "qortal://APP/%2e%2e/Evil",
      "qortal://APP/a%2Fb",
      "qortal://APP/Q-Tube/../../render/APP/Evil",
      "qortal://APP/Q-Tube/%2e%2e/x",
      "qortal://APP/Q-Tube/a\\b",
      "qortal://1APP/x",
      "qortal://bad-service/x",
      "qortal://APP/",
      "qortal://APP/%E0%A4%A",
    ]) {
      expect(parseQortalLink(raw)?.kind, raw).toBe("invalid");
    }
  });

  it("is null for anything that is not a qortal:// link", () => {
    for (const raw of ["https://example.com", "javascript:alert(1)", "data:text/html,x", "qortal:APP/x", "", null, undefined]) {
      expect(parseQortalLink(raw)).toBeNull();
    }
  });

  it("strips sentence punctuation", () => {
    expect(stripTrailingPunctuation("qortal://APP/x).")).toBe("qortal://APP/x");
    expect(stripTrailingPunctuation("qortal://APP/x/")).toBe("qortal://APP/x/");
  });

  it("describes what a click will do", () => {
    const describe = (raw: string) => describeQortalLink(parseQortalLink(raw)!);
    expect(describe("qortal://use-group/action-join/groupid-1176")).toBe("Join group 1176 (Hub asks first)");
    expect(describe("qortal://APP/Q-Tube")).toBe("Open Q-Tube in a new tab");
    expect(describe("qortal://VIDEO/alice/id")).toBe("Open alice's video in a new tab");
    expect(describe("qortal://pay?recipient=a")).toMatch(/copy/i);
  });
});

describe("openQortalLink", () => {
  const copied = () => vi.fn(async (text: string) => Boolean(text));

  it("asks Hub to join the group (JOIN_GROUP with a numeric groupId)", async () => {
    mockQortalAction("JOIN_GROUP", { signature: "s" });
    const outcome = await openQortalLink("qortal://use-group/action-join/groupid-1176", { copy: copied() });
    expect(qortalCalls()).toEqual([{ action: "JOIN_GROUP", groupId: 1176 }]);
    expect(outcome).toMatchObject({ alertType: "success" });
    expect(outcome?.msg).toMatch(/group 1176/);
  });

  it("opens apps and resources with OPEN_NEW_TAB, in Hub's spelling, and says nothing", async () => {
    mockQortalAction("OPEN_NEW_TAB", true);
    await expect(openQortalLink("qortal://APP/Q-Share%2B/share/Alice%20Smith/id", { copy: copied() })).resolves.toBeNull();
    await expect(openQortalLink("qortal://REON", { copy: copied() })).resolves.toBeNull();
    expect(qortalCalls()).toEqual([
      { action: "OPEN_NEW_TAB", qortalLink: "qortal://APP/Q-Share+/share/Alice%20Smith/id" },
      { action: "OPEN_NEW_TAB", qortalLink: "qortal://REON" },
    ]);
  });

  it("stays quiet when the user declines, and shows Hub's error otherwise", async () => {
    mockQortalAction("JOIN_GROUP", () => {
      throw { error: "User declined to join group", message: "User declined to join group" };
    });
    await expect(openQortalLink("qortal://use-group/action-join/groupid-3", { copy: copied() })).resolves.toBeNull();
    mockQortalAction("OPEN_NEW_TAB", () => {
      throw { error: "Invalid qortal link", message: "Invalid qortal link" };
    });
    await expect(openQortalLink("qortal://APP/Q-Tube", { copy: copied() })).resolves.toEqual({
      alertType: "error",
      msg: "Invalid qortal link",
    });
  });

  it("sends one request while the same link is still waiting on Hub", async () => {
    let answer: (value: unknown) => void = () => {};
    mockQortalAction("JOIN_GROUP", () => new Promise((resolve) => (answer = resolve)));
    const first = openQortalLink("qortal://use-group/action-join/groupid-8", { copy: copied() });
    await expect(openQortalLink("qortal://use-group/action-join/groupid-8", { copy: copied() })).resolves.toBeNull();
    answer({});
    await first;
    expect(qortalCalls("JOIN_GROUP")).toHaveLength(1);
  });

  it("copies calendar, other use-… and payment links with a note, and asks Hub nothing", async () => {
    const copy = copied();
    const calendar = `qortal://use-group/action-calendar/groupid-5/eventid-${EVENT}`;
    await expect(openQortalLink(calendar, { copy })).resolves.toMatchObject({ alertType: "info", msg: expect.stringMatching(/group chat/) });
    await expect(openQortalLink("qortal://use-embed/POLL/x", { copy })).resolves.toMatchObject({ alertType: "info" });
    await expect(openQortalLink("qortal://pay?recipient=a&amount=5", { copy })).resolves.toMatchObject({
      alertType: "info",
      msg: expect.stringMatching(/doesn't send QORT/),
    });
    expect(copy.mock.calls.map((call) => call[0])).toEqual([calendar, "qortal://use-embed/POLL/x", "qortal://pay?recipient=a&amount=5"]);
    expect(qortalCalls()).toEqual([]);
  });

  it("shows the link when copying fails", async () => {
    const outcome = await openQortalLink("qortal://use-embed/x", { copy: async () => false });
    expect(outcome).toMatchObject({ alertType: "error", msg: expect.stringContaining("qortal://use-embed/x") });
  });

  it("refuses invalid links without asking Hub", async () => {
    await expect(openQortalLink("qortal://APP/../Evil", { copy: copied() })).resolves.toMatchObject({ alertType: "error" });
    expect(qortalCalls()).toEqual([]);
  });

  it("says so outside Hub, where there is no qortalRequest", async () => {
    const g = globalThis as { qortalRequest?: unknown };
    const saved = g.qortalRequest;
    delete g.qortalRequest;
    try {
      await expect(openQortalLink("qortal://APP/Q-Tube", { copy: copied() })).resolves.toMatchObject({
        alertType: "error",
        msg: "Qortal links open only inside Qortal Hub.",
      });
    } finally {
      g.qortalRequest = saved;
    }
  });
});
