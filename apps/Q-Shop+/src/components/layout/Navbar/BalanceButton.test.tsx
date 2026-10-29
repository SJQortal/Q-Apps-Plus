/** The header's balance (BalanceButton.tsx, wallet/balances.ts) against a mocked node and Hub. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { createAppStore } from "../../../state/store";
import { addUser } from "../../../state/features/authSlice";
import { addToHashMapStores } from "../../../state/features/storeSlice";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { installQortalMock } from "../../../test/qortalMock";
import { BalanceButton } from "./BalanceButton";
import { fetchBalances, setShowBalance } from "../../../wallet/balances";

const ADDRESS = "QBuyerAddressxxxxxxxxxxxxxxxxxxxxx";

function setup() {
  const get = vi.fn(async (input: string) => {
    const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
    if (String(input).startsWith(`/assets/balances?address=${ADDRESS}`)) {
      return ok([
        { address: ADDRESS, assetId: 0, balance: "1234.56789" },
        { address: ADDRESS, assetId: 81, balance: "12.5" },
        { address: ADDRESS, assetId: 99, balance: "7" },
      ]);
    }
    return { ok: false, status: 404, json: async () => ({}) };
  });
  vi.stubGlobal("fetch", get);
  const store = createAppStore();
  store.dispatch(addUser({ address: ADDRESS, publicKey: "pk", name: "Buyer" }));
  store.dispatch(addToHashMapStores({ id: "s1", owner: "Shop", title: "Shop", acceptedAssets: [{ id: 81, name: "Gold Bar" }, { id: 82, name: "Silver" }] } as never));
  const q = installQortalMock({ GET_WALLET_BALANCE: async () => 3.25 });
  renderWithProviders(<BalanceButton phone={false} />, { store });
  return { get, q };
}

afterEach(() => vi.unstubAllGlobals());

describe("the balance in the header", () => {
  it("shows the account's QORT, and opens its ARRR (on request) and the Q-Assets shops take", async () => {
    const { q } = setup();
    const button = await screen.findByRole("button", { name: /^QORT balance: 1,234\.57 QORT/ });
    expect(button).toHaveTextContent("1,234.57");
    fireEvent.click(button);
    const panel = await screen.findByRole("dialog", { name: "Your balances" });
    // Only the assets the shops take: Gold Bar held, Silver none; asset 99 isn't listed.
    const assets = within(panel).getByRole("list", { name: "Q-Assets" });
    const rows = within(assets).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Gold Bar")).toBeInTheDocument();
    expect(within(rows[0]).getByText("12.50")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Silver")).toBeInTheDocument();
    expect(within(rows[1]).getByText("0.00")).toBeInTheDocument();
    // Hub asks before ARRR is read, so it's read only when asked.
    expect(q.callsFor("GET_WALLET_BALANCE")).toHaveLength(0);
    fireEvent.click(within(panel).getByRole("button", { name: "Show" }));
    await waitFor(() => expect(within(panel).getByText("3.25")).toBeInTheDocument());
    expect(q.callsFor("GET_WALLET_BALANCE")[0]).toMatchObject({ coin: "ARRR" });
  });

  it("can be hidden in Settings", async () => {
    setShowBalance(false);
    setup();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("button", { name: /QORT balance/ })).toBeNull();
  });

  it("reads balances in pages, as numbers", async () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({ assetId: i, balance: String(i) }));
    const get = vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => (url.includes("offset=0") ? rows : [{ assetId: 500, balance: "0.5" }]) }) as unknown as Response);
    const balances = await fetchBalances("Q1", get);
    expect(balances.get(99)).toBe(99);
    expect(balances.get(500)).toBe(0.5);
    expect(get).toHaveBeenCalledTimes(2);
  });
});
