import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "../test/renderWithProviders";
import { CopyNameButton } from "./parts";


describe("a name's copy button", () => {
  it("copies the name and shows a tick for a moment", async () => {
    // jsdom isn't a secure context: the copy goes through the textarea fallback (utils/clipboard.ts).
    let copied = "";
    const execCommand = vi.fn(() => {
      copied = (document.activeElement as HTMLTextAreaElement | null)?.value ?? (document.querySelector("textarea") as HTMLTextAreaElement | null)?.value ?? "";
      return true;
    });
    Object.defineProperty(document, "execCommand", { value: execCommand, configurable: true });
    renderWithProviders(<CopyNameButton name="Ewam Garden" />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Copy Ewam Garden" })));
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(copied).toBe("Ewam Garden");
    expect(screen.getByRole("button", { name: "Copied Ewam Garden" })).toBeInTheDocument();
  });
});
