import { describe, expect, it } from "vitest";
import { fitHeader } from "./useHeaderFit";

/**
 * A header whose navigation needs `navNeeds(fit)` pixels in `navHas`, and
 * whose actions end at `actionsEnd(fit)` (the header's padding ends at 1000).
 * jsdom has no layout, so the sizes come from the arrangement being tried.
 */
function header({
  navHas = 600,
  navNeeds,
  actionsEnd = () => 990,
  wraps = () => false,
}: {
  navHas?: number | ((fit: string) => number);
  navNeeds: (fit: string) => number;
  actionsEnd?: (fit: string) => number;
  wraps?: (fit: string) => boolean;
}) {
  const el = document.createElement("div");
  const logo = document.createElement("button");
  const nav = document.createElement("nav");
  const actions = document.createElement("div");
  el.append(logo, nav, actions);
  const fit = () => el.dataset.fit ?? "";
  Object.defineProperty(nav, "scrollWidth", { get: () => navNeeds(fit()) });
  Object.defineProperty(nav, "clientWidth", { get: () => (typeof navHas === "number" ? navHas : navHas(fit())) });
  const rect = (left: number, right: number, top: number) => ({ left, right, top, height: 44, width: right - left, bottom: top + 44 }) as DOMRect;
  el.getBoundingClientRect = () => rect(0, 1000, 0);
  logo.getBoundingClientRect = () => rect(0, 120, 0);
  actions.getBoundingClientRect = () => rect(700, actionsEnd(fit()), wraps(fit()) ? 50 : 0);
  return el;
}

const has = (fit: string, step: string) => fit.split(" ").includes(step);

describe("fitHeader", () => {
  it("keeps everything when it fits", () => {
    expect(fitHeader(header({ navNeeds: () => 560 }), true)).toBe("");
  });

  it("drops the least it can: the navigation's icons first, then the name", () => {
    expect(fitHeader(header({ navNeeds: (f) => (has(f, "icons") ? 480 : 610) }), true)).toBe("icons");
    expect(fitHeader(header({ navNeeds: (f) => (has(f, "name") ? 500 : 640) }), true)).toBe("icons name");
  });

  it("drops the app's title before the rate's number", () => {
    expect(fitHeader(header({ navNeeds: (f) => (has(f, "title") ? 590 : 700) }), true)).toBe("icons name prefix title");
  });

  it("moves the navigation to its own row when one line can't hold it", () => {
    const el = header({ navNeeds: () => 700, navHas: (f) => (has(f, "rows") ? 1000 : 600) });
    expect(fitHeader(el, true)).toBe("rows");
    expect(el.dataset.fit).toBe("rows");
  });

  it("drops more on the first row when the actions would wrap under the logo", () => {
    const el = header({ navNeeds: () => 700, navHas: (f) => (has(f, "rows") ? 1000 : 600), wraps: (f) => !has(f, "name") });
    expect(fitHeader(el, true)).toBe("icons name rows");
  });

  it("on phones (no navigation row) takes the last step when nothing else fits", () => {
    const el = header({ navNeeds: () => 0, navHas: 0, actionsEnd: (f) => (has(f, "title") ? 1003 : 1040) });
    expect(fitHeader(el, false)).toBe("icons name prefix title");
    const never = header({ navNeeds: () => 0, navHas: 0, actionsEnd: () => 1100 });
    expect(fitHeader(never, false)).toBe("icons name prefix title rate balance");
  });
});
