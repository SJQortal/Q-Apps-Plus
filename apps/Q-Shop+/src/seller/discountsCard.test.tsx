/**
 * Shop Settings → Discount codes (discounts/) against the mocked Hub and
 * node: codes added, changed, paused and deleted as drafts, then published
 * as one DOCUMENT `q-store-discounts-<short>` with each code and name kept
 * as a fingerprint and the seller's own list encrypted to them; published
 * codes read back with that list. Nothing reaches a real node.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { createAppStore } from "../state/store";
import { addUser } from "../state/features/authSlice";
import { setCurrentStore, setDataContainer } from "../state/features/globalSlice";
import { renderWithProviders } from "../test/renderWithProviders";
import { installQortalMock, type QortalMock } from "../test/qortalMock";
import { SELLER, SELLER_ADDRESS, SELLER_PK, SHORT_STORE_ID, STORE_ID, dataContainer, decodeData64, viewedStore } from "../test/fixtures/shop";
import { discountsIdentifier } from "../qdn/identifiers";
import { resetQdnCaches } from "../qdn/search";
import { codeHash, nameHash } from "../discounts/model";
import { DiscountsCard } from "./DiscountsCard";

const DISCOUNTS_ID = discountsIdentifier(SHORT_STORE_ID);

function setup(opts: { published?: unknown } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const [path] = String(input).split("?");
      const ok = (body: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body });
      if (path === "/arbitrary/resources/search") {
        return ok(opts.published && String(input).includes(DISCOUNTS_ID) ? [{ name: SELLER, service: "DOCUMENT", identifier: DISCOUNTS_ID }] : []);
      }
      if (path === `/arbitrary/DOCUMENT/${encodeURIComponent(SELLER)}/${DISCOUNTS_ID}`) return ok(opts.published);
      return { ok: false, status: 404, text: async () => '{"error":1401}', json: async () => ({ error: 1401 }) };
    })
  );
  const store = createAppStore();
  store.dispatch(addUser({ address: SELLER_ADDRESS, publicKey: SELLER_PK, name: SELLER }));
  store.dispatch(setCurrentStore({ ...viewedStore, owner: SELLER }));
  store.dispatch(setDataContainer(dataContainer));
  const q: QortalMock = installQortalMock({
    PUBLISH_QDN_RESOURCE: async () => true,
    ENCRYPT_DATA: async (p) => `enc:${String((p as Record<string, unknown>).data64)}`,
    DECRYPT_DATA: async (p) => String((p as Record<string, unknown>).encryptedData).slice(4),
    GET_NAME_DATA: async (p) => {
      if ((p as Record<string, unknown>).name === "Ann") return { name: "Ann", owner: "QAnnAddress" };
      throw new Error("Name not found");
    },
  });
  renderWithProviders(<DiscountsCard />, { store });
  return { q };
}

const published = (q: QortalMock) => decodeData64(String((q.callsFor("PUBLISH_QDN_RESOURCE")[0] as Record<string, unknown>).data64));

beforeEach(() => {
  resetQdnCaches();
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe("discount codes in Shop Settings", () => {
  it("adds a code and publishes it as a fingerprint, with the seller's list encrypted to them", async () => {
    const { q } = setup();
    expect(await screen.findByText("No discount codes yet.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add a discount code" }));
    const d = await screen.findByRole("dialog", { name: "Add a discount code" });
    fireEvent.change(within(d).getByLabelText("Code"), { target: { value: "spring10" } });
    fireEvent.change(within(d).getByLabelText("Percent off"), { target: { value: "15" } });
    fireEvent.click(within(d).getByRole("checkbox", { name: "Free delivery too" }));
    fireEvent.click(within(d).getByRole("button", { name: "Add" }));
    const list = await screen.findByRole("list", { name: "Discount codes" });
    expect(within(list).getByText("SPRING10")).toBeInTheDocument();
    expect(within(list).getByText("15% off and free delivery · every product")).toBeInTheDocument();
    expect(within(list).getByText("Running")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Publish discount codes" }));
    await waitFor(() => expect(q.callsFor("PUBLISH_QDN_RESOURCE")).toHaveLength(1));
    expect(q.callsFor("PUBLISH_QDN_RESOURCE")[0]).toMatchObject({ name: SELLER, service: "DOCUMENT", identifier: DISCOUNTS_ID });
    const doc = published(q);
    expect(doc).toMatchObject({ v: 1, storeId: STORE_ID, currency: "QORT", discounts: [{ id: expect.any(String), code: await codeHash(STORE_ID, "SPRING10"), percent: 15, freeDelivery: true }] });
    // The code as typed is only in the seller's encrypted list.
    expect(JSON.stringify(doc.discounts)).not.toContain("SPRING10");
    expect(q.callsFor("ENCRYPT_DATA")[0]).toMatchObject({ publicKeys: [SELLER_PK] });
    expect(JSON.parse(atob(String(doc.secret).slice(4)))).toEqual({ codes: { [doc.discounts[0].id]: "SPRING10" }, names: {} });
    expect(screen.queryByRole("button", { name: "Publish discount codes" })).toBeNull();
  });

  it("gives one Qortal name a discount with no code, checking the name; pauses and deletes", async () => {
    const { q } = setup();
    await screen.findByText("No discount codes yet.");
    fireEvent.click(screen.getByRole("button", { name: "Add a discount code" }));
    const d = await screen.findByRole("dialog", { name: "Add a discount code" });
    fireEvent.click(within(d).getByRole("button", { name: "Add" }));
    expect(await within(d).findByText("Give it a code, or the Qortal name it's for.")).toBeInTheDocument();
    fireEvent.change(within(d).getByLabelText(/Only for this Qortal name/), { target: { value: "Bob" } });
    fireEvent.click(within(d).getByRole("button", { name: "Add" }));
    expect(await within(d).findByText("There's no Qortal name Bob.")).toBeInTheDocument();
    fireEvent.change(within(d).getByLabelText(/Only for this Qortal name/), { target: { value: "Ann" } });
    fireEvent.click(within(d).getByRole("button", { name: "Add" }));
    const list = await screen.findByRole("list", { name: "Discount codes" });
    expect(within(list).getByText("For Ann, no code")).toBeInTheDocument();
    fireEvent.click(within(list).getByRole("button", { name: "Pause" }));
    expect(within(list).getByText("Paused")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Publish discount codes" }));
    await waitFor(() => expect(q.callsFor("PUBLISH_QDN_RESOURCE")).toHaveLength(1));
    expect(published(q).discounts).toEqual([{ id: expect.any(String), percent: 10, paused: true, forName: await nameHash(STORE_ID, "Ann") }]);
    fireEvent.click(within(list).getByRole("button", { name: "Delete For Ann, no code" }));
    expect(await screen.findByText("No discount codes yet.")).toBeInTheDocument();
  });

  it("reads the published codes back with the seller's list, and changes one", async () => {
    const id = "abc12345";
    const secret = btoa(JSON.stringify({ codes: { [id]: "VIP20" }, names: {} }));
    setup({ published: { v: 1, storeId: STORE_ID, currency: "QORT", updated: 1, discounts: [{ id, code: await codeHash(STORE_ID, "VIP20"), percent: 20 }], secret: `enc:${secret}` } });
    const list = await screen.findByRole("list", { name: "Discount codes" });
    expect(within(list).getByText("VIP20")).toBeInTheDocument();
    fireEvent.click(within(list).getByRole("button", { name: "Change VIP20" }));
    const d = await screen.findByRole("dialog", { name: "Change discount" });
    fireEvent.change(within(d).getByLabelText("Percent off"), { target: { value: "25" } });
    fireEvent.click(within(d).getByRole("button", { name: "Save" }));
    expect(await within(list).findByText("25% off · every product")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish discount codes" })).toBeInTheDocument();
  });
});
