import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { resetInAppHistory, useSafeBack, useTrackInAppHistory } from "./useSafeBack";

function Harness({ fallback }: { fallback: string }) {
  useTrackInAppHistory();
  const navigate = useNavigate();
  const back = useSafeBack(fallback);
  return (
    <>
      <p data-testid="path">{useLocation().pathname}</p>
      <button onClick={() => navigate("/channel/alice")}>profile</button>
      <button onClick={() => navigate("/share/alice/x")}>share</button>
      <button onClick={() => navigate("/")}>home</button>
      <button onClick={back}>back</button>
    </>
  );
}

const mount = (start: string, fallback = "/") =>
  render(
    <MemoryRouter initialEntries={[start]}>
      <Harness fallback={fallback} />
    </MemoryRouter>
  );
const tap = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const path = () => screen.getByTestId("path").textContent;

describe("useSafeBack", () => {
  beforeEach(() => resetInAppHistory());

  it("goes to the previous in-app page", () => {
    mount("/");
    tap("profile");
    tap("share");
    tap("back");
    expect(path()).toBe("/channel/alice");
    tap("back");
    expect(path()).toBe("/");
  });

  it("falls back to the parent page when the app opened on this page", () => {
    mount("/collection/alice/c1", "/collections");
    tap("back");
    expect(path()).toBe("/collections");
  });

  it("treats a navigation to the previous page (Hub's Back) as going back", () => {
    mount("/", "/");
    tap("share");
    tap("home");
    // The stack is just "/" again, so Back has nowhere in-app to go and stays Home.
    tap("back");
    expect(path()).toBe("/");
  });
});
