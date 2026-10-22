import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { installQortalMock } from "../../test/qortalMock";
import { THEME_STORAGE_KEY } from "../../theme/qplus-theme";
import { createAppStore, store as appStore } from "../../state/store";
import { addUser } from "../../state/features/authSlice";
import { setCurrentStore } from "../../state/features/globalSlice";
import { setPreferredCoin } from "../../state/features/storeSlice";
import { SETTINGS_STORAGE_KEY } from "../../utils/settingsStorage";
import { SETTINGS_SYNC_IDENTIFIER } from "../../utils/settingsQdn";
import { base64ToJson } from "../../qdn/payloads";
import { ACTIVE_NAME_STORAGE_KEY } from "../../constants/plus";
import { ShellContext, type ShellActions } from "../../components/layout/shellState";
import { SettingsPage, shortAddress } from "./SettingsPage";
import { getProductView, resetProductView } from "../../utils/productView";

const ADDRESS = "QBuyeRAddressxxxxxxxxxxxxxxxx7b1d0e";

function signedInStore(names = ["Buyer+One"]) {
  const store = createAppStore();
  store.dispatch(addUser({ address: ADDRESS, publicKey: "pk", name: names[0], names: names.map((name) => ({ name, owner: ADDRESS })) }));
  return store;
}

function renderSettings(options: { store?: ReturnType<typeof createAppStore>; actions?: Partial<ShellActions> } = {}) {
  const actions: ShellActions = { signIn: vi.fn(), reloadOwnShops: vi.fn(), authenticating: false, ...options.actions };
  const result = renderWithProviders(
    <ShellContext.Provider value={actions}>
      <SettingsPage />
    </ShellContext.Provider>,
    { store: options.store, initialEntries: ["/settings"] }
  );
  return { ...result, actions };
}

/** A fetch that answers by URL. */
function stubFetch(route: (url: string) => unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const body = route(String(input));
      return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
    })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SettingsPage", () => {
  it("has the five sections in order, one h1, and the plain version", () => {
    renderSettings();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const sections = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(sections).toEqual(["Account", "Appearance", "Shopping", "Sync", "About"]);
    expect(screen.getByText("Q-Shop+ 1.0.0")).toBeInTheDocument();
  });

  it("switches theme from the picker and saves it", () => {
    renderSettings();
    const black = screen.getByRole("radio", { name: /Black/ });
    fireEvent.click(black);
    expect(black).toHaveAttribute("aria-checked", "true");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(JSON.stringify("black"));
    expect(document.documentElement.getAttribute("data-ui-theme")).toBe("black");
  });

  it("opens the changelog dialog", () => {
    renderSettings();
    fireEvent.click(screen.getByRole("button", { name: /What's new/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Q-Shop+ 1.0");
    expect(screen.getByRole("dialog")).toHaveTextContent("Latest · 1.0.0");
  });

  describe("Account", () => {
    it("signed out: says so and offers Sign in", () => {
      const { actions } = renderSettings();
      expect(screen.getByText("Not signed in")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
      expect(actions.signIn).toHaveBeenCalledTimes(1);
    });

    it("shows the active name and the address shortened, with Copy", async () => {
      const exec = vi.fn(() => true);
      Object.defineProperty(document, "execCommand", { value: exec, configurable: true, writable: true });
      const store = signedInStore();
      renderSettings({ store });
      expect(screen.getByText("Buyer+One")).toBeInTheDocument();
      expect(screen.getByText(shortAddress(ADDRESS))).toHaveAttribute("title", ADDRESS);
      expect(shortAddress(ADDRESS)).toBe("QBuyeR…7b1d0e");
      // One name: nothing to switch to.
      expect(screen.queryByRole("button", { name: "Switch name" })).toBeNull();
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Copy address" }));
      });
      expect(exec).toHaveBeenCalledWith("copy");
      expect(store.getState().notifications.alertTypes.alertSuccess).toBe("Address copied");
    });

    it("shows the whole address when copying isn't possible", async () => {
      Object.defineProperty(document, "execCommand", { value: () => false, configurable: true, writable: true });
      const store = signedInStore();
      renderSettings({ store });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Copy address" }));
      });
      expect(screen.getByText(ADDRESS)).toBeInTheDocument();
      expect(store.getState().notifications.alertTypes.alertInfo).toMatch(/Select the text and copy it yourself/);
    });

    it("switches to another of the account's names, remembers it, and drops the old name's shop", async () => {
      const store = signedInStore(["Buyer+One", "Second Name"]);
      store.dispatch(setCurrentStore({ id: "q-store-general-my-shop", owner: "Buyer+One" }));
      renderSettings({ store });
      fireEvent.click(screen.getByRole("button", { name: "Switch name" }));
      const dialog = await screen.findByRole("dialog", { name: "Switch name" });
      fireEvent.click(within(dialog).getByRole("menuitemradio", { name: "Second Name" }));
      expect(store.getState().auth.user?.name).toBe("Second Name");
      expect(JSON.parse(localStorage.getItem(ACTIVE_NAME_STORAGE_KEY) || "{}")).toEqual({ [ADDRESS]: "Second Name" });
      expect(store.getState().global.currentStore).toBeNull();
      expect(store.getState().global.ownShopStatus).toBe("loading");
    });
  });

  describe("Shopping", () => {
    it("offers QORT and ARRR and keeps the choice between visits", () => {
      renderSettings({ store: appStore });
      const select = screen.getByRole("combobox", { name: "Coin" }) as HTMLSelectElement;
      expect(Array.from(select.options).map((o) => o.value)).toEqual(["QORT", "ARRR"]);
      fireEvent.change(select, { target: { value: "ARRR" } });
      expect(appStore.getState().store.preferredCoin).toBe("ARRR");
      expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}")).toEqual({ preferredCoin: "ARRR" });
      act(() => {
        appStore.dispatch(setPreferredCoin("QORT"));
      });
    });

    it("shows an asset chosen on a shop page as an extra choice", () => {
      const store = createAppStore();
      store.dispatch(setPreferredCoin("ASSET:7"));
      renderSettings({ store });
      const select = screen.getByRole("combobox", { name: "Coin" }) as HTMLSelectElement;
      expect(select.value).toBe("ASSET:7");
      expect(Array.from(select.options).map((o) => o.textContent)).toContain("Asset #7");
    });

    it("opens the blocked names list (shared with the original)", async () => {
      const q = installQortalMock({ GET_LIST_ITEMS: async () => ["spammer"] });
      renderSettings({ store: signedInStore() });
      fireEvent.click(screen.getByRole("button", { name: "Manage" }));
      expect(await screen.findByText("spammer")).toBeInTheDocument();
      expect(q.callsFor("GET_LIST_ITEMS")[0]).toMatchObject({ list_name: "blockedNames_q-blog" });
    });
  });

  describe("Sync", () => {
    it("is off until signed in with a name", () => {
      renderSettings();
      expect(screen.getByRole("button", { name: /Save to QDN/ })).toBeDisabled();
      expect(screen.getByRole("button", { name: /Restore/ })).toBeDisabled();
    });

    it("Save to QDN publishes the theme and preferred coin under the active name, once", async () => {
      const q = installQortalMock({ PUBLISH_QDN_RESOURCE: async () => true });
      const store = signedInStore();
      store.dispatch(setPreferredCoin("ARRR"));
      renderSettings({ store });
      fireEvent.click(screen.getByRole("radio", { name: /White/ }));
      fireEvent.click(screen.getByRole("button", { name: /Save to QDN/ }));
      await screen.findByText("Saved to QDN under Buyer+One.");
      const calls = q.callsFor("PUBLISH_QDN_RESOURCE");
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({
        service: "DOCUMENT",
        name: "Buyer+One",
        identifier: SETTINGS_SYNC_IDENTIFIER,
        filename: "settings.json",
      });
      // Round 5: the product view is saved too (additive).
      expect(base64ToJson(String(calls[0].data64))).toEqual({ version: 1, theme: "white", preferredCoin: "ARRR", productView: "auto" });
      expect(q.calls.map((c) => c.action)).toEqual(["PUBLISH_QDN_RESOURCE"]);
    });

    it("a decline in Hub, in any language, is a quiet cancel", async () => {
      installQortalMock({
        PUBLISH_QDN_RESOURCE: async () => {
          throw { error: "Benutzer hat die Anfrage abgelehnt" };
        },
      });
      const store = signedInStore();
      renderSettings({ store });
      fireEvent.click(screen.getByRole("button", { name: /Save to QDN/ }));
      expect(await screen.findByText("Save cancelled in Hub.")).toBeInTheDocument();
      expect(store.getState().notifications.alertTypes.alertError).toBe("");
    });

    it("a failed save says so and can be tried again", async () => {
      installQortalMock({
        PUBLISH_QDN_RESOURCE: async () => {
          throw { error: 500, message: "Unable to publish" };
        },
      });
      const store = signedInStore();
      renderSettings({ store });
      fireEvent.click(screen.getByRole("button", { name: /Save to QDN/ }));
      expect(await screen.findByText("The save failed; try again in a moment.")).toBeInTheDocument();
      expect(store.getState().notifications.alertTypes.alertError).toBe("Could not save settings to QDN");
      expect(screen.getByRole("button", { name: /Save to QDN/ })).toBeEnabled();
    });

    it("Restore applies the saved theme and coin, and publishes nothing", async () => {
      const q = installQortalMock();
      stubFetch((url) =>
        url.startsWith(`/arbitrary/DOCUMENT/Buyer%2BOne/${SETTINGS_SYNC_IDENTIFIER}`)
          ? { version: 1, theme: "black", preferredCoin: "ARRR" }
          : []
      );
      const store = signedInStore();
      renderSettings({ store });
      fireEvent.click(screen.getByRole("button", { name: /Restore/ }));
      expect(await screen.findByText("Restored your theme and preferred coin from QDN.")).toBeInTheDocument();
      expect(store.getState().store.preferredCoin).toBe("ARRR");
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(JSON.stringify("black"));
      expect(q.calls).toHaveLength(0);
    });

    it("Restore keeps the coin when the saved one is a coin Q-Shop+ no longer offers", async () => {
      installQortalMock();
      stubFetch((url) =>
        url.startsWith(`/arbitrary/DOCUMENT/Buyer%2BOne/${SETTINGS_SYNC_IDENTIFIER}`)
          ? { version: 1, theme: "black", preferredCoin: "LTC" }
          : []
      );
      const store = signedInStore();
      renderSettings({ store });
      fireEvent.click(screen.getByRole("button", { name: /Restore/ }));
      expect(await screen.findByText("Restored your theme from QDN.")).toBeInTheDocument();
      expect(store.getState().store.preferredCoin).toBe("QORT");
    });

    it("Restore also applies a saved product view", async () => {
      resetProductView();
      installQortalMock();
      stubFetch((url) =>
        url.startsWith(`/arbitrary/DOCUMENT/Buyer%2BOne/${SETTINGS_SYNC_IDENTIFIER}`)
          ? { version: 1, theme: "black", preferredCoin: "ARRR", productView: "grid" }
          : []
      );
      renderSettings({ store: signedInStore() });
      fireEvent.click(screen.getByRole("button", { name: /Restore/ }));
      expect(await screen.findByText("Restored your theme, preferred coin and product view from QDN.")).toBeInTheDocument();
      expect(getProductView()).toBe("grid");
      resetProductView();
    });

    it("Restore tells nothing saved apart from not on this node yet", async () => {
      let rows: unknown[] = [];
      stubFetch((url) =>
        url.startsWith("/arbitrary/resources/search") ? rows : { error: 1401, message: "Data unavailable" }
      );
      renderSettings({ store: signedInStore() });
      fireEvent.click(screen.getByRole("button", { name: /Restore/ }));
      expect(await screen.findByText("No settings saved on QDN for Buyer+One yet.")).toBeInTheDocument();

      rows = [{ name: "Buyer+One", service: "DOCUMENT", identifier: SETTINGS_SYNC_IDENTIFIER }];
      await waitFor(() => expect(screen.getByRole("button", { name: /Restore/ })).toBeEnabled());
      fireEvent.click(screen.getByRole("button", { name: /Restore/ }));
      expect(await screen.findByText(/haven't reached this node yet/)).toBeInTheDocument();
    });
  });

  describe("About", () => {
    it("links the original app and shows the repository links as copyable text", () => {
      renderSettings();
      expect(screen.getByRole("link", { name: /Open Q-Shop/ })).toHaveAttribute("href", "qortal://APP/Q-Shop");
      expect(screen.getByText("https://github.com/SJQortal/Q-Apps-Plus")).toBeInTheDocument();
      expect(screen.getByText("https://github.com/Qortal/q-shop")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Copy the source link" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Copy the upstream link" })).toBeInTheDocument();
    });
  });
});

describe("Settings: products in a shop", () => {
  it("chooses how shops show products, Automatic until changed", () => {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
    resetProductView();
    renderWithProviders(<SettingsPage />, { store: createAppStore() });
    const select = screen.getByRole("combobox", { name: "Show as" });
    expect(select).toHaveValue("auto");
    fireEvent.change(select, { target: { value: "list" } });
    expect(getProductView()).toBe("list");
    expect(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)!)).toMatchObject({ productView: "list" });
    resetProductView();
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
  });
});
