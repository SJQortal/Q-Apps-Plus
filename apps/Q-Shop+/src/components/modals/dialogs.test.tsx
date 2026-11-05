import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import localForage from "localforage";
import { renderWithProviders } from "../../test/renderWithProviders";
import { DESKTOP, mockViewport } from "../../test/viewport";
import ConsentModal, { CONSENT_KEY } from "./ConsentModal";
import { DownloadQortalModal } from "./DownloadQortalModal";

let restore: () => void = () => {};
afterEach(() => restore());

describe("ConsentModal", () => {
  it("shows the welcome notice once, and records it only when acknowledged", async () => {
    await localForage.removeItem(CONSENT_KEY);
    const first = renderWithProviders(<ConsentModal />);
    const dialog = await screen.findByRole("dialog", { name: "Welcome to Q-Shop+" });
    expect(dialog).toHaveTextContent(/cannot be held accountable/);
    expect(await localForage.getItem(CONSENT_KEY)).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "I understand" }));
    });
    expect(await localForage.getItem(CONSENT_KEY)).toBe(true);
    first.unmount();

    renderWithProviders(<ConsentModal />);
    await act(async () => {});
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("DownloadQortalModal", () => {
  it("explains why signing in needs Qortal, and closes", async () => {
    restore = mockViewport(DESKTOP);
    const onClose = vi.fn();
    renderWithProviders(<DownloadQortalModal open onClose={onClose} />);
    expect(screen.getByRole("dialog", { name: "Sign in with Qortal" })).toHaveTextContent(/web gateway/);
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
