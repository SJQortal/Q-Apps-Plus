import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configure, screen } from "@testing-library/react";
import { renderSpace, resetSpaceTest } from "./testUtils";

configure({ asyncUtilTimeout: 5_000 });

vi.mock("./MusicSpace", () => ({
  default: () => {
    throw new Error("space failed");
  },
}));

describe("a space that can't draw", () => {
  beforeEach(() => {
    resetSpaceTest();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("falls back to the standard page, with the shares and their Remove", async () => {
    renderSpace({ space: "music" });
    expect(await screen.findByRole("heading", { level: 1, name: "My space" })).toBeInTheDocument();
    expect(document.querySelector("[data-space]")).toBeNull();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
    expect(await screen.findByText("Songs")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Songs from collection" })).toBeInTheDocument();
  });
});
