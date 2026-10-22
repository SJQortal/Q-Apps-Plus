import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import localForage from "localforage";
import { renderWithProviders } from "../../test/renderWithProviders";
import { DESKTOP, PHONE_PORTRAIT, mockViewport } from "../../test/viewport";
import ConsentModal, { CONSENT_KEY } from "./ConsentModal";
import { ReusableModal } from "./ReusableModal";
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

describe("ReusableModal", () => {
  it("is full-screen with a Back button on phones", () => {
    restore = mockViewport(PHONE_PORTRAIT);
    const onClose = vi.fn();
    renderWithProviders(
      <ReusableModal open onClose={onClose} ariaLabel="Order" customStyles={{ width: "75%" }}>
        <p>Order details</p>
      </ReusableModal>
    );
    expect(screen.getByRole("dialog", { name: "Order" })).toHaveTextContent("Order details");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("is the original centred panel on wider screens, with the caller's own controls", () => {
    restore = mockViewport(DESKTOP);
    renderWithProviders(
      <ReusableModal open onClose={() => {}} customStyles={{ width: "400px" }} id="store-details">
        <button type="button">Close</button>
      </ReusableModal>
    );
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    expect(document.getElementById("store-details")).toBeInTheDocument();
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
