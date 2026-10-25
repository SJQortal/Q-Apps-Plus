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
import { resetPeopleCaches } from "../discounts/people";

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
      // Names and Q-Chat groups (discounts/people.ts).
      if (path === "/names/search" && String(input).includes("query=An&")) return ok([{ name: "Annie" }, { name: "Ann" }]);
      if (path === `/groups/member/${SELLER_ADDRESS}`) return ok([{ groupId: 7, groupName: "Biohackers", memberCount: 3 }]);
      if (path === "/groups/members/7") return ok({ memberCount: 3, members: [{ member: "Q1", primaryName: "Cy" }, { member: "Q2", primaryName: "Dee" }, { member: "Q3" }] });
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
  resetPeopleCaches();
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
    expect(await within(d).findByText("Give it a code, or the Qortal names it's for.")).toBeInTheDocument();
    const names = within(d).getByRole("combobox", { name: /Only for these Qortal names/ });
    // A typed name goes in with Enter, and is checked on Add.
    fireEvent.change(names, { target: { value: "Bob" } });
    fireEvent.keyDown(names, { key: "Enter" });
    fireEvent.click(within(d).getByRole("button", { name: "Add" }));
    expect(await within(d).findByText("There's no Qortal name Bob.")).toBeInTheDocument();
    fireEvent.keyDown(names, { key: "Backspace" });
    fireEvent.change(names, { target: { value: "Ann" } });
    fireEvent.keyDown(names, { key: "Enter" });
    fireEvent.click(within(d).getByRole("button", { name: "Add" }));
    const list = await screen.findByRole("list", { name: "Discount codes" });
    expect(within(list).getByText("For Ann, no code")).toBeInTheDocument();
    fireEvent.click(within(list).getByRole("button", { name: "Pause" }));
    expect(within(list).getByText("Paused")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Publish discount codes" }));
    await waitFor(() => expect(q.callsFor("PUBLISH_QDN_RESOURCE")).toHaveLength(1));
    expect(published(q).discounts).toEqual([{ id: expect.any(String), percent: 10, paused: true, forName: await nameHash(STORE_ID, "Ann") }]);
    await waitFor(() => expect(within(list).getByRole("button", { name: "Delete For Ann, no code" })).toBeEnabled());
    fireEvent.click(within(list).getByRole("button", { name: "Delete For Ann, no code" }));
    expect(await screen.findByText("No discount codes yet.")).toBeInTheDocument();
  });

  it("gives several names a discount: suggested as typed, and a Q-Chat group's members", async () => {
    const { q } = setup();
    await screen.findByText("No discount codes yet.");
    fireEvent.click(screen.getByRole("button", { name: "Add a discount code" }));
    const d = await screen.findByRole("dialog", { name: "Add a discount code" });
    const names = within(d).getByRole("combobox", { name: /Only for these Qortal names/ });
    fireEvent.change(names, { target: { value: "An" } });
    // The exact name first, then longer ones.
    const ann = await screen.findByRole("option", { name: "Ann" }, { timeout: 2000 });
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Ann", "Annie"]);
    fireEvent.click(ann);
    fireEvent.click(within(d).getByRole("button", { name: "Add a Q-Chat group's members" }));
    const g = await screen.findByRole("dialog", { name: "Add a group's members" });
    // The seller's own groups are offered before anything is typed.
    fireEvent.keyDown(within(g).getByRole("combobox", { name: "Q-Chat group" }), { key: "ArrowDown" });
    fireEvent.click(await within(g).findByRole("option", { name: /Biohackers/ }));
    fireEvent.click(within(g).getByRole("button", { name: "Add their names" }));
    expect(await within(d).findByText("Added 2 names from Biohackers; 1 member has no name.")).toBeInTheDocument();
    fireEvent.click(within(d).getByRole("button", { name: "Add" }));
    const list = await screen.findByRole("list", { name: "Discount codes" });
    expect(within(list).getByText("For Ann, Cy and Dee, no code")).toBeInTheDocument();
    // Suggested and group names are real already: nothing to check.
    expect(q.callsFor("GET_NAME_DATA")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Publish discount codes" }));
    await waitFor(() => expect(q.callsFor("PUBLISH_QDN_RESOURCE")).toHaveLength(1));
    const doc = published(q);
    const hashes = [await nameHash(STORE_ID, "Ann"), await nameHash(STORE_ID, "Cy"), await nameHash(STORE_ID, "Dee")];
    // The first name stays in forName, for builds that read only that.
    expect(doc.discounts).toEqual([{ id: expect.any(String), percent: 10, forName: hashes[0], forNames: hashes }]);
    const id = doc.discounts[0].id;
    expect(JSON.parse(atob(String(doc.secret).slice(4)))).toEqual({ codes: {}, names: { [id]: "Ann" }, nameLists: { [id]: ["Ann", "Cy", "Dee"] } });
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

describe("discount codes set on another device", () => {
  it("keep their name limit and the seller's encrypted list when changed here (review)", async () => {
    // This device can't read the list (DECRYPT_DATA gives nothing back).
    const forName = await nameHash(STORE_ID, "Ann");
    const code = await codeHash(STORE_ID, "VIP30");
    const { q } = setup({ published: { v: 1, storeId: STORE_ID, currency: "QORT", updated: 1, discounts: [{ id: "vip", code, forName, percent: 30 }], secret: "unreadable" } });
    const list = await screen.findByRole("list", { name: "Discount codes" });
    fireEvent.click(within(list).getByRole("button", { name: "Change A code set on another device" }));
    const d = await screen.findByRole("dialog", { name: "Change discount" });
    fireEvent.change(within(d).getByLabelText("Percent off"), { target: { value: "35" } });
    fireEvent.click(within(d).getByRole("button", { name: "Save" }));
    fireEvent.click(await screen.findByRole("button", { name: "Publish discount codes" }));
    await waitFor(() => expect(q.callsFor("PUBLISH_QDN_RESOURCE")).toHaveLength(1));
    const doc = published(q);
    expect(doc.discounts).toEqual([{ id: "vip", percent: 35, code, forName }]);
    expect(doc.secret).toBe("unreadable");
  });
});
