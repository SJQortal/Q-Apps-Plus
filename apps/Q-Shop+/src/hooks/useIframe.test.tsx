import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useIframe } from "./useIframe";

function Probe() {
  useIframe();
  return null;
}

describe("useIframe", () => {
  it("follows Hub's NAVIGATE_TO_PATH and tells Hub it arrived", async () => {
    const post = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Probe />
        <Routes>
          <Route path="/" element={<p>Home page</p>} />
          <Route path="/my-orders" element={<p>Orders page</p>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText("Home page")).toBeInTheDocument();
    await act(async () => {
      window.dispatchEvent(new MessageEvent("message", { data: { action: "NAVIGATE_TO_PATH", path: "/my-orders" } }));
    });
    expect(screen.getByText("Orders page")).toBeInTheDocument();
    expect(post).toHaveBeenCalledWith({ action: "NAVIGATION_SUCCESS", path: "/my-orders" }, "*");
    post.mockRestore();
  });
});
