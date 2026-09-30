import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { NAME_SEARCH_THRESHOLD, NameSwitcher, orderNames } from "./NameSwitcher";

const few = ["Zed", "alice", "Bob"];
/** 20 names: more than the threshold, so the switcher gets its search field. */
const many = [
  "Zed", "alice", "Bob", "Simon James", "simple", "Qortal Seth", "ändi", "Ωmega", "carol", "dave",
  "erin", "frank", "grace", "heidi", "ivan", "judy", "mallory", "niaj", "olivia", "peggy",
];

const rows = () => screen.getAllByRole("menuitemradio").map((r) => r.textContent);
const search = () => screen.getByRole("textbox", { name: "Find one of your names" });

describe("orderNames", () => {
  it("keeps the account's order up to the threshold", () => {
    expect(orderNames(few, "Bob", "")).toEqual(["Zed", "alice", "Bob"]);
    expect(many.length).toBeGreaterThan(NAME_SEARCH_THRESHOLD);
  });

  it("lists many names A to Z with the active one first", () => {
    const ordered = orderNames(many, "peggy", "");
    expect(ordered[0]).toBe("peggy");
    expect(ordered.slice(1, 4)).toEqual(["alice", "ändi", "Bob"]);
  });

  it("matches case and accents, starts before contains", () => {
    expect(orderNames(many, "peggy", "SIM")).toEqual(["Simon James", "simple"]);
    expect(orderNames(many, "peggy", "and")).toEqual(["ändi"]);
    expect(orderNames(many, "peggy", "e")[0]).toBe("erin");
    expect(orderNames(many, "peggy", "zzz")).toEqual([]);
  });
});

describe("NameSwitcher", () => {
  it("has no search field for a few names, and picks on a tap", () => {
    const onPick = vi.fn();
    renderWithProviders(<NameSwitcher names={few} activeName="Bob" onPick={onPick} />);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(rows()).toEqual(["Zed", "alice", "Bob"]);
    expect(screen.getByRole("menuitemradio", { name: "Bob" })).toHaveAttribute("aria-checked", "true");
    // Every row has its avatar.
    for (const row of screen.getAllByRole("menuitemradio")) expect(row.querySelector(".MuiAvatar-root")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitemradio", { name: "alice" }));
    expect(onPick).toHaveBeenCalledWith("alice");
  });

  it("filters many names as you type, and says when nothing matches", () => {
    renderWithProviders(<NameSwitcher names={many} activeName="peggy" onPick={() => {}} />);
    expect(search()).toHaveAttribute("placeholder", "Find one of your 20 names");
    fireEvent.change(search(), { target: { value: "sim" } });
    expect(rows()).toEqual(["Simon James", "simple"]);
    // The typed part is highlighted.
    const simon = screen.getByRole("menuitemradio", { name: "Simon James" });
    expect(within(simon).getByText("Sim")).toBeInTheDocument();

    fireEvent.change(search(), { target: { value: "nobody here" } });
    expect(screen.queryAllByRole("menuitemradio")).toHaveLength(0);
    expect(screen.getByRole("status")).toHaveTextContent("No name matches “nobody here”.");
  });

  it("works from the keyboard: Enter picks the first match, arrows move between field and list", () => {
    const onPick = vi.fn();
    renderWithProviders(<NameSwitcher names={many} activeName="peggy" onPick={onPick} autoFocusSearch />);
    expect(search()).toHaveFocus();
    fireEvent.change(search(), { target: { value: "qort" } });
    fireEvent.keyDown(search(), { key: "Enter" });
    expect(onPick).toHaveBeenCalledWith("Qortal Seth");

    fireEvent.change(search(), { target: { value: "" } });
    fireEvent.keyDown(search(), { key: "ArrowDown" });
    expect(screen.getByRole("menuitemradio", { name: "peggy" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menuitemradio", { name: "peggy" }), { key: "ArrowUp" });
    expect(search()).toHaveFocus();
  });

  it("clears the query on the first Escape and hands the second one on", () => {
    const onEscape = vi.fn();
    renderWithProviders(<NameSwitcher names={many} activeName="peggy" onPick={() => {}} onEscape={onEscape} />);
    fireEvent.change(search(), { target: { value: "sim" } });
    fireEvent.keyDown(search(), { key: "Escape" });
    expect(search()).toHaveValue("");
    expect(onEscape).not.toHaveBeenCalled();
    fireEvent.keyDown(search(), { key: "Escape" });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("clears the query with its button", () => {
    renderWithProviders(<NameSwitcher names={many} activeName="peggy" onPick={() => {}} />);
    fireEvent.change(search(), { target: { value: "sim" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear the search" }));
    expect(search()).toHaveValue("");
    expect(rows()).toHaveLength(20);
  });
});
