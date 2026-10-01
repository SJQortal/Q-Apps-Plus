import { afterEach, describe, expect, it } from "vitest";
import { currentAppName, decodeParam, profileLink, shareLink } from "./qortalLinks";

type QdnWindow = Window & { _qdnName?: string };
const setAppName = (value: string | undefined) => {
  (window as QdnWindow)._qdnName = value;
};

describe("qortal:// links", () => {
  afterEach(() => setAppName(undefined));

  it("keeps a literal + in the app name, as Hub's own Copy link does", () => {
    setAppName("Q-Share+");
    expect(shareLink("Alice Smith", "qshare_file_x")).toBe("qortal://APP/Q-Share+/share/Alice%20Smith/qshare_file_x");
    expect(profileLink("Alice Smith")).toBe("qortal://APP/Q-Share+/channel/Alice%20Smith");
  });

  it("writes spaces in the app name as %20", () => {
    setAppName("Some%20App");
    expect(currentAppName()).toBe("Some App");
    expect(shareLink("bob", "id")).toBe("qortal://APP/Some%20App/share/bob/id");
  });

  it("points at Q-Share+ in Hub Dev Mode, where _qdnName is empty", () => {
    setAppName("");
    expect(shareLink("bob", "id")).toBe("qortal://APP/Q-Share+/share/bob/id");
    setAppName(undefined);
    expect(profileLink("bob")).toBe("qortal://APP/Q-Share+/channel/bob");
  });

  it("still encodes the name and identifier path segments", () => {
    setAppName("Q-Share+");
    expect(shareLink("Vallot-/8/", "a+b c")).toBe("qortal://APP/Q-Share+/share/Vallot-%2F8%2F/a%2Bb%20c");
  });

  it("decodes route params without throwing on a stray %", () => {
    expect(decodeParam("Alice%20Smith")).toBe("Alice Smith");
    expect(decodeParam("100%")).toBe("100%");
    expect(decodeParam(undefined)).toBe("");
  });
});
