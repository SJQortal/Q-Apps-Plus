import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useParams } from "react-router-dom";
import { resolveRouterBase, routerBaseForPage } from "./routerBase";

const BASE = "/render/APP/Q-Share+";

function ShareParams() {
  const { name, id } = useParams();
  return <p>{`${name} / ${id}`}</p>;
}

/** Mount the real router the way main.tsx does, at `pathname`. */
const mountAt = (pathname: string, qdnBase: string) =>
  render(
    <MemoryRouter basename={resolveRouterBase(pathname, qdnBase)} initialEntries={[pathname]}>
      <Routes>
        <Route path="/share/:name/:id" element={<ShareParams />} />
      </Routes>
    </MemoryRouter>
  );

describe("resolveRouterBase", () => {
  it("uses _qdnBase when the URL spells the name the same way", () => {
    expect(resolveRouterBase("/render/APP/Q-Share+/share/a/b", BASE)).toBe(BASE);
    expect(resolveRouterBase("/render/APP/Q-Share+", BASE)).toBe(BASE);
    expect(resolveRouterBase("/render/APP/Some%20App/x", "/render/APP/Some%20App")).toBe("/render/APP/Some%20App");
  });

  it("uses the URL's own spelling when it encodes the same name (a Q-Share%2B link)", () => {
    expect(resolveRouterBase("/render/APP/Q-Share%2B/share/a/b", BASE)).toBe("/render/APP/Q-Share%2B");
    expect(resolveRouterBase("/render/APP/q-share%2b", BASE)).toBe("/render/APP/q-share%2b");
  });

  it("keeps _qdnBase for another app, and '' in Hub Dev Mode", () => {
    expect(resolveRouterBase("/render/APP/Q-Share+x/share/a/b", BASE)).toBe(BASE);
    expect(resolveRouterBase("/share/a/b", "")).toBe("");
    expect(resolveRouterBase("/", undefined)).toBe("");
  });

  it("lets the router render a share for either spelling", () => {
    mountAt("/render/APP/Q-Share%2B/share/Alice%20Smith/qshare_file_x", BASE);
    expect(screen.getByText("Alice Smith / qshare_file_x")).toBeInTheDocument();
  });
});

describe("routerBaseForPage", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("rewrites an encoded app name to Core's spelling without a new history entry", () => {
    window.history.replaceState(null, "", "/render/APP/Q-Share%2B/share/a/b?theme=dark#top");
    const entries = window.history.length;
    expect(routerBaseForPage(BASE)).toBe(BASE);
    expect(window.location.pathname).toBe("/render/APP/Q-Share+/share/a/b");
    expect(window.location.search).toBe("?theme=dark");
    expect(window.location.hash).toBe("#top");
    expect(window.history.length).toBe(entries);
  });

  it("returns the prefix the rewritten path really starts with when the browser re-encodes the name", () => {
    // Core injects _qdnBase raw, but a replaceState path is percent-encoded outside URL-safe ASCII.
    const base = "/render/APP/Café";
    window.history.replaceState(null, "", "/render/APP/caf%c3%a9/share/a/b");
    const result = routerBaseForPage(base);
    expect(window.location.pathname).toBe("/render/APP/Caf%C3%A9/share/a/b");
    expect(result).toBe("/render/APP/Caf%C3%A9");
    expect(window.location.pathname.startsWith(result)).toBe(true);
  });

  it("leaves a matching URL alone, and falls back to the URL's spelling if it can't rewrite", () => {
    window.history.replaceState(null, "", "/render/APP/Q-Share+/share/a/b");
    expect(routerBaseForPage(BASE)).toBe(BASE);
    expect(window.location.pathname).toBe("/render/APP/Q-Share+/share/a/b");

    const location = { pathname: "/render/APP/Q-Share%2B/share/a/b", search: "", hash: "" } as Location;
    const history = {
      state: null,
      replaceState: () => {
        throw new Error("SecurityError");
      },
    } as unknown as History;
    expect(routerBaseForPage(BASE, location, history)).toBe("/render/APP/Q-Share%2B");
    expect(routerBaseForPage("", location, history)).toBe("");
  });
});
