import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { hubPathToRoute, useIframe } from "./useIframe";

function Harness() {
  useIframe();
  const location = useLocation();
  return <p data-testid="path">{location.pathname + location.search}</p>;
}

const path = () => screen.getByTestId("path").textContent;
const send = (data: unknown, source: MessageEventSource | null = window.parent) =>
  act(() => {
    window.dispatchEvent(new MessageEvent("message", { data, source }));
  });

describe("useIframe", () => {
  afterEach(() => vi.restoreAllMocks());

  it("turns Hub's relative path into a route from the app's root", () => {
    expect(hubPathToRoute("share/alice/x")).toBe("/share/alice/x");
    expect(hubPathToRoute("/collections")).toBe("/collections");
    expect(hubPathToRoute("//share/a/b?x=1")).toBe("/share/a/b?x=1");
  });

  it("moves to the path from any page and answers with the path as sent", () => {
    const post = vi.spyOn(window.parent, "postMessage");
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Harness />
      </MemoryRouter>
    );
    send({ action: "NAVIGATE_TO_PATH", path: "share/Simon%20James/qshare_file_x_metadata", requestedHandler: "UI" });
    expect(path()).toBe("/share/Simon%20James/qshare_file_x_metadata");
    expect(post).toHaveBeenCalledWith(
      { action: "NAVIGATION_SUCCESS", path: "share/Simon%20James/qshare_file_x_metadata" },
      "*"
    );
  });

  it("ignores navigation requests that don't come from Hub", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <Harness />
      </MemoryRouter>
    );
    send({ action: "NAVIGATE_TO_PATH", path: "collections" }, null);
    expect(path()).toBe("/settings");
  });
});
