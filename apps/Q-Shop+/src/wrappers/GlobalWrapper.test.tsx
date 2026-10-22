import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import localForage from "localforage";
import { renderWithProviders } from "../test/renderWithProviders";
import { installQortalMock } from "../test/qortalMock";
import { DESKTOP, mockViewport } from "../test/viewport";
import { createAppStore } from "../state/store";
import { setIsOpen } from "../state/features/cartSlice";
import { CONSENT_KEY } from "../components/modals/ConsentModal";
import GlobalWrapper from "./GlobalWrapper";

function Where() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <p data-testid="where">{pathname}</p>
      <button type="button" onClick={() => navigate("/")}>
        Go home
      </button>
    </>
  );
}

const where = () => screen.getByTestId("where").textContent;

let restore: () => void = () => {};
beforeEach(async () => {
  restore = mockViewport(DESKTOP);
  await localForage.setItem(CONSENT_KEY, true);
  // Signed out: Hub's answer to a declined sign-in.
  installQortalMock({
    GET_USER_ACCOUNT: async () => {
      throw { error: "User declined request" };
    },
  });
});
afterEach(() => restore());

describe("GlobalWrapper", () => {
  it("opens the cart page when something opens the cart, and never pulls the user back to it", async () => {
    const store = createAppStore();
    renderWithProviders(
      <GlobalWrapper>
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </GlobalWrapper>,
      { store, initialEntries: ["/Seller/q-store-general-my-shop"] }
    );
    await act(async () => {});
    expect(where()).toBe("/Seller/q-store-general-my-shop");

    act(() => {
      store.dispatch(setIsOpen(true));
    });
    expect(where()).toBe("/cart");

    // Leaving the cart another way (the header, the bottom bar) closes it…
    fireEvent.click(screen.getByRole("button", { name: "Go home" }));
    expect(where()).toBe("/");
    expect(store.getState().cart.isOpen).toBe(false);

    // …so the next "open the cart" works again.
    act(() => {
      store.dispatch(setIsOpen(true));
    });
    expect(where()).toBe("/cart");
  });

  it("publishes nothing on start-up", async () => {
    const q = installQortalMock({
      GET_USER_ACCOUNT: async () => {
        throw { error: "User declined request" };
      },
    });
    renderWithProviders(
      <GlobalWrapper>
        <p>page</p>
      </GlobalWrapper>
    );
    await act(async () => {});
    expect(q.calls.filter((c) => /PUBLISH|SEND_COIN|LIST_ITEM/.test(c.action))).toEqual([]);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });
});
