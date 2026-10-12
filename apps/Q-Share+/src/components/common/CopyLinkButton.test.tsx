import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { store } from "../../state/store";
import { removeNotification } from "../../state/features/notificationsSlice";
import { CopyLinkButton } from "./CopyLinkButton";

const LINK = "qortal://APP/Q-Share+/share/Alice%20Smith/qshare_file_x";

/** A frame on a plain-http LAN node: no clipboard API, only execCommand. */
const insecureFrame = (execResult: boolean) => {
  Object.defineProperty(window, "isSecureContext", { value: false, configurable: true });
  Object.defineProperty(document, "execCommand", { value: vi.fn().mockReturnValue(execResult), configurable: true });
};

describe("CopyLinkButton", () => {
  beforeEach(() => store.dispatch(removeNotification()));
  afterEach(() => {
    delete (window as { isSecureContext?: boolean }).isSecureContext;
    delete (document as { execCommand?: unknown }).execCommand;
  });

  it("copies with the execCommand fallback and says so", async () => {
    insecureFrame(true);
    renderWithProviders(<CopyLinkButton link={LINK} tooltipTitle="Copy link" label="Copy link" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await waitFor(() => expect(store.getState().notifications.alertTypes.alertSuccess).toBe("Link copied"));
    expect(document.execCommand).toHaveBeenCalledWith("copy");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the link, selected, when copying is blocked", async () => {
    insecureFrame(false);
    renderWithProviders(<CopyLinkButton link={LINK} tooltipTitle="Copy profile link" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy profile link" }));
    const dialog = await screen.findByRole("dialog", { name: "Copy link" });
    const field = screen.getByRole("textbox", { name: "Link" }) as HTMLTextAreaElement;
    expect(dialog).toContainElement(field);
    expect(field.value).toBe(LINK);
    expect(field.readOnly).toBe(true);
    await waitFor(() => expect(field).toHaveFocus());
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, LINK.length]);
    expect(store.getState().notifications.alertTypes.alertError).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
