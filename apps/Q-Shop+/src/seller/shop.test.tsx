/**
 * Create shop, Edit shop (payments and Q-Assets) and Recreate shop data,
 * through the dialogs, against the mocked Hub and node. Every publish is
 * compared with what qdn/payloads.ts builds for the original's shapes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { createAppStore } from "../state/store";
import { addUser } from "../state/features/authSlice";
import { setCurrentStore, setDataContainer, setProductsToSave } from "../state/features/globalSlice";
import { renderWithProviders } from "../test/renderWithProviders";
import { installQortalMock } from "../test/qortalMock";
import {
  ARRR_ADDRESS,
  DATA_CONTAINER_ID,
  SELLER,
  SELLER_ADDRESS,
  SELLER_PK,
  SHORT_STORE_ID,
  STORE_ID,
  dataContainer,
  decodeData64,
  mug,
  viewedStore,
} from "../test/fixtures/shop";
import { buildCreateStorePublish, buildEditStorePublish, buildRecreateDataContainerPublish } from "../qdn/payloads";
import CreateStoreModal from "../components/modals/CreateStoreModal";
import EditStoreModal from "../components/modals/EditStoreModal";
import { RecreateShopDataDialog } from "./RecreateShopDataDialog";
import { addressWarning, shopFormValues, toStoreFields, validateShopForm } from "./shopFields";
import { assetInfo, parseAssetQuery, resetAssetCache } from "../qdn/assets";
import { isRecentlyDeletedShop, noteDeletedShop, resetDeletedShops } from "../qdn/deleted";

const LOGO = "data:image/webp;base64,TE9HTw==";

// The real picker compresses with a canvas, which jsdom lacks: pick a fixed logo instead.
vi.mock("../components/common/ImageUploader", () => ({
  default: ({ label, onPick }: { label: string; onPick: (img: string) => void }) => (
    <button type="button" onClick={() => onPick("data:image/webp;base64,TE9HTw==")}>
      {label}
    </button>
  ),
}));

/** A node that knows our shops (by search), the ones deleted (they serve "D"), and two assets. */
function stubNode(opts: { shops?: { name: string; identifier: string }[]; deleted?: string[] } = {}) {
  const calls: string[] = [];
  // Core's own shape: an asset's name is `name` (as /assets and /assets/info answer on mainnet).
  const assets = [
    { assetId: 0, owner: "QdSnUy6sUiEnaN87dWmE92g1uQjrvPgrWG", name: "QORT", description: "QORTAL coin", quantity: 0, isDivisible: true, isUnspendable: false, creationGroupId: 0 },
    { assetId: 81, owner: "QOwner81", name: "Gold", description: "A gold token", quantity: 1000, isDivisible: true, isUnspendable: false, creationGroupId: 0 },
    { assetId: 82, owner: "QOwner82", name: "Locked", description: "", quantity: 1, isDivisible: false, isUnspendable: true, creationGroupId: 0 },
    { assetId: 87, owner: "QfX9KhXnoB78v2D36j7nocKaYtzUYcyQyH", name: "BHC", description: "", quantity: 40204200000000, isDivisible: true, isUnspendable: false, creationGroupId: 0 },
    { assetId: 88, owner: "QfX9KhXnoB78v2D36j7nocKaYtzUYcyQyH", name: "BHC Coin", description: "BHC Coin is the native Coin of Biohackers Corner.", quantity: 40204200000000, isDivisible: true, isUnspendable: false, creationGroupId: 0 },
    { assetId: 90, owner: "QOwner90", name: "Seats", description: "Whole seats only", quantity: 100, isDivisible: false, isUnspendable: false, creationGroupId: 0 },
  ];
  const fetchMock = vi.fn(async (input: string) => {
    const url = String(input);
    calls.push(url);
    const [path, qs] = url.split("?");
    const params = new URLSearchParams(qs ?? "");
    const ok = (body: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body });
    if (path === "/arbitrary/resources/search") {
      const rows = (opts.shops ?? []).filter(
        (s) => s.name === params.get("name") && s.identifier === params.get("identifier")
      );
      return ok(rows.map((s) => ({ ...s, service: "STORE", created: 1 })));
    }
    if (path === "/assets/info") {
      const id = params.get("assetId");
      const name = params.get("assetName");
      const asset = assets.find((a) => (id !== null ? String(a.assetId) === id : a.name === name));
      return asset ? ok(asset) : { ok: false, status: 400, text: async () => '{"error":601}' };
    }
    if (path === "/assets") return ok(assets);
    const store = path.match(/^\/arbitrary\/STORE\/[^/]+\/([^/]+)$/);
    if (store && opts.deleted?.includes(decodeURIComponent(store[1]))) return { ok: true, status: 200, text: async () => "D" };
    return { ok: false, status: 404, text: async () => "{}" };
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

function sellerStore() {
  const store = createAppStore();
  store.dispatch(addUser({ address: SELLER_ADDRESS, publicKey: SELLER_PK, name: SELLER }));
  return store;
}

const field = (name: RegExp) => screen.getByRole("textbox", { name });
const assetField = () => screen.getByRole("combobox", { name: /^Asset name or id/ });

beforeEach(() => {
  resetAssetCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("shop form values", () => {
  it("keeps the original's shapes: QORT first, foreignCoins.ARRR always there", () => {
    const values = shopFormValues({ ...viewedStore, foreignCoins: { ARRR: ` ${ARRR_ADDRESS} ` } });
    expect(values.coins).toEqual({ ARRR: true });
    const fields = toStoreFields(values);
    expect(fields.supportedCoins).toEqual(["QORT", "ARRR"]);
    expect(fields.foreignCoins).toEqual({ ARRR: ARRR_ADDRESS });
    const none = toStoreFields(shopFormValues(null));
    expect(none.supportedCoins).toEqual(["QORT"]);
    expect(none.foreignCoins).toEqual({ ARRR: "" });
  });

  it("saves a shop that names a coin Q-Shop+ no longer takes without it, as the original does", () => {
    // Q-Shop+'s test builds offered BTC, LTC, DOGE, DGB and RVN.
    const values = shopFormValues({
      ...viewedStore,
      supportedCoins: ["QORT", "ARRR", "BTC"],
      foreignCoins: { ARRR: ARRR_ADDRESS, BTC: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq" },
    });
    expect(values.coins).toEqual({ ARRR: true });
    const fields = toStoreFields(values);
    expect(fields.supportedCoins).toEqual(["QORT", "ARRR"]);
    expect(fields.foreignCoins).toEqual({ ARRR: ARRR_ADDRESS });
  });

  it("asks for an address for ARRR when it is switched on", () => {
    const values = shopFormValues({ ...viewedStore, foreignCoins: { ARRR: " " } });
    expect(validateShopForm(values)).toBe("Add your ARRR payout address, or switch ARRR off");
    expect(validateShopForm({ ...values, coins: { ARRR: false } })).toBeNull();
  });

  it("warns, without blocking, about an address that doesn't look like the coin's", () => {
    const sapling = `zs1${"qpzry9x8gf2tvdw0s3jn54khce6mua7l".repeat(3).slice(0, 75)}`;
    expect(addressWarning("ARRR", sapling)).toBeNull();
    expect(addressWarning("ARRR", "QSeLLeRAddressxxxxxxxxxxxxxxx9f3c2")).toMatch(/Qortal address/);
    expect(addressWarning("ARRR", "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq")).toMatch(/doesn't look like a ARRR/);
    expect(addressWarning("ARRR", "")).toBeNull();
  });
});

describe("assets", () => {
  it("reads one asset by id or exact name, small and cached; unknown is null", async () => {
    const calls = stubNode();
    expect(parseAssetQuery("#81")).toEqual({ id: 81 });
    expect(parseAssetQuery(" Gold ")).toEqual({ name: "Gold" });
    expect(await assetInfo({ id: 81 })).toMatchObject({ assetId: 81, assetName: "Gold" });
    expect(await assetInfo({ id: 81 })).toMatchObject({ assetId: 81 });
    expect(await assetInfo({ name: "Nope" })).toBeNull();
    expect(calls).toEqual(["/assets/info?assetId=81", "/assets/info?assetName=Nope"]);
  });
});

describe("create shop", () => {
  async function fillShop() {
    fireEvent.change(field(/^Shop id/), { target: { value: "My Shop! post" } });
    fireEvent.click(screen.getByRole("button", { name: "Add shop logo" }));
    fireEvent.change(field(/^Title/), { target: { value: "Seller's Shop" } });
    fireEvent.change(field(/^Description/), { target: { value: "Mugs" } });
    fireEvent.change(field(/^Location/), { target: { value: "Lisbon" } });
    fireEvent.change(field(/^Ships to/), { target: { value: "Europe" } });
  }

  it("cleans the id as the original did, previews it, and publishes the original's STORE + empty product list", async () => {
    stubNode();
    const q = installQortalMock({ PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true });
    const onCreated = vi.fn();
    const store = sellerStore();
    renderWithProviders(<CreateStoreModal open onClose={() => {}} onCreated={onCreated} />, { store });
    await fillShop();
    expect(field(/^Shop id/)).toHaveValue("My-Shop-");
    expect(screen.getByText("q-store-general-My-Shop")).toBeInTheDocument();
    expect(screen.getByText("qortal://APP/Q-Shop+/Seller%20Name/q-store-general-My-Shop")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create shop" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("q-store-general-My-Shop"));

    const pub = q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any;
    const store0 = decodeData64(pub.resources[0].data64);
    const expected = buildCreateStorePublish({
      name: SELLER,
      shortStoreId: "My-Shop",
      created: store0.created,
      fields: {
        title: "Seller's Shop",
        description: "Mugs",
        location: "Lisbon",
        shipsTo: "Europe",
        logo: LOGO,
        foreignCoins: { ARRR: "" },
        supportedCoins: ["QORT"],
      },
    });
    expect(pub).toEqual(expected.request);
    expect(Object.keys(store0)).toEqual(Object.keys(expected.storeObj));
    expect(store.getState().global.currentStore?.id).toBe("q-store-general-My-Shop");
    expect(store.getState().global.ownShopStatus).toBe("ready");
  });

  it("a validation error leaves the button usable (the original stayed stuck)", async () => {
    stubNode();
    const q = installQortalMock({ PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true });
    const onCreated = vi.fn();
    renderWithProviders(<CreateStoreModal open onClose={() => {}} onCreated={onCreated} />, { store: sellerStore() });
    await fillShop();
    fireEvent.change(field(/^Title/), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Create shop" }));
    expect(await screen.findByText("Add a title")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Create shop" });
    expect(button).toBeEnabled();
    fireEvent.change(field(/^Title/), { target: { value: "Shop" } });
    fireEvent.click(button);
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1);
  });

  it("refuses an id the seller already uses, and a decline in Hub is quiet", async () => {
    stubNode({ shops: [{ name: SELLER, identifier: "q-store-general-My-Shop" }] });
    const q = installQortalMock({
      PUBLISH_MULTIPLE_QDN_RESOURCES: async () => {
        throw { error: "User declined request" };
      },
    });
    const onCreated = vi.fn();
    renderWithProviders(<CreateStoreModal open onClose={() => {}} onCreated={onCreated} />, { store: sellerStore() });
    await fillShop();
    fireEvent.click(screen.getByRole("button", { name: "Create shop" }));
    expect(await screen.findByText(/already have a shop with this id/)).toBeInTheDocument();
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(0);

    fireEvent.change(field(/^Shop id/), { target: { value: "other" } });
    fireEvent.click(screen.getByRole("button", { name: "Create shop" }));
    await waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Create shop" })).toBeEnabled());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(onCreated).not.toHaveBeenCalled();
  });
});

describe("create shop over a deleted one", () => {
  it("creates a shop again under the id of one the seller deleted, which starts fresh", async () => {
    resetDeletedShops();
    stubNode({ shops: [{ name: SELLER, identifier: "q-store-general-My-Shop" }], deleted: ["q-store-general-My-Shop"] });
    const q = installQortalMock({ PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true });
    const onCreated = vi.fn();
    const store = sellerStore();
    renderWithProviders(<CreateStoreModal open onClose={() => {}} onCreated={onCreated} />, { store });
    fireEvent.change(field(/^Shop id/), { target: { value: "My Shop" } });
    fireEvent.click(screen.getByRole("button", { name: "Add shop logo" }));
    fireEvent.change(field(/^Title/), { target: { value: "Seller's Shop" } });
    fireEvent.change(field(/^Description/), { target: { value: "Mugs" } });
    fireEvent.change(field(/^Location/), { target: { value: "Lisbon" } });
    fireEvent.change(field(/^Ships to/), { target: { value: "Europe" } });
    fireEvent.click(screen.getByRole("button", { name: "Create shop" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith("q-store-general-My-Shop"));
    const pub = q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any;
    expect(pub.resources.map((r: any) => [r.service, r.identifier])).toEqual([
      ["STORE", "q-store-general-My-Shop"],
      ["DOCUMENT", "q-store-general-My-Shop-datacontainer"],
    ]);
    expect(decodeData64(pub.resources[1].data64).products).toEqual({});
  });

  it("this browser's memory of the delete is forgotten once it's created again", async () => {
    resetDeletedShops();
    noteDeletedShop(SELLER, "q-store-general-My-Shop");
    stubNode({ shops: [{ name: SELLER, identifier: "q-store-general-My-Shop" }] });
    installQortalMock({ PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true });
    const onCreated = vi.fn();
    renderWithProviders(<CreateStoreModal open onClose={() => {}} onCreated={onCreated} />, { store: sellerStore() });
    fireEvent.change(field(/^Shop id/), { target: { value: "My Shop" } });
    fireEvent.click(screen.getByRole("button", { name: "Add shop logo" }));
    fireEvent.change(field(/^Title/), { target: { value: "Seller's Shop" } });
    fireEvent.change(field(/^Description/), { target: { value: "Mugs" } });
    fireEvent.change(field(/^Location/), { target: { value: "Lisbon" } });
    fireEvent.change(field(/^Ships to/), { target: { value: "Europe" } });
    fireEvent.click(screen.getByRole("button", { name: "Create shop" }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(isRecentlyDeletedShop(SELLER, "q-store-general-My-Shop")).toBe(false);
  });
});

describe("edit shop", () => {
  function setup(handlers: Record<string, (p: any) => unknown> = {}, shop: Partial<typeof viewedStore> = {}) {
    stubNode();
    const q = installQortalMock({ PUBLISH_QDN_RESOURCE: async () => true, ...handlers });
    const store = sellerStore();
    store.dispatch(setCurrentStore({ ...viewedStore, ...shop, owner: SELLER }));
    const onClose = vi.fn();
    renderWithProviders(<EditStoreModal open storeId={STORE_ID} onClose={onClose} />, { store });
    return { q, store, onClose };
  }

  it("republishes the shop as the original did, with the payout address trimmed", async () => {
    const { q, onClose } = setup();
    expect(field(/^Title/)).toHaveValue(viewedStore.title);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const [req] = q.callsFor("PUBLISH_QDN_RESOURCE") as any[];
    const expected = buildEditStorePublish({
      name: SELLER,
      currentStore: { ...viewedStore, owner: SELLER },
      fields: {
        title: viewedStore.title,
        description: viewedStore.description,
        location: viewedStore.location,
        shipsTo: viewedStore.shipsTo,
        logo: viewedStore.logo,
        foreignCoins: { ARRR: ARRR_ADDRESS },
        supportedCoins: ["QORT", "ARRR"],
        acceptedAssets: [],
      },
    });
    expect(req).toEqual(expected.request);
    expect(decodeData64(req.data64).foreignCoins).toEqual({ ARRR: ARRR_ADDRESS });
    expect(req.description.startsWith("**coins:QORTtrue,ARRRtrue**")).toBe(true);
  });

  it("adds ARRR from the wallet and an asset by name, the asset as additive data", async () => {
    const { q, onClose } = setup(
      { GET_USER_WALLET: async (p) => ({ address: p.coin === "ARRR" ? ARRR_ADDRESS : "x" }) },
      { supportedCoins: ["QORT"], foreignCoins: { ARRR: "" } }
    );
    fireEvent.click(screen.getByRole("switch", { name: /Accept Pirate Chain/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Use my ARRR wallet address" }));
    await waitFor(() => expect(field(/^ARRR payout address/)).toHaveValue(ARRR_ADDRESS));
    expect(q.callsFor("GET_USER_WALLET")).toEqual([{ action: "GET_USER_WALLET", coin: "ARRR" }]);

    fireEvent.change(assetField(), { target: { value: "QORT" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("QORT is always accepted.")).toBeInTheDocument();
    fireEvent.change(assetField(), { target: { value: "Gold" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    const list = await screen.findByRole("list", { name: "Accepted assets" });
    expect(within(list).getByText("Gold")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const [req] = q.callsFor("PUBLISH_QDN_RESOURCE") as any[];
    const saved = decodeData64(req.data64);
    expect(saved.supportedCoins).toEqual(["QORT", "ARRR"]);
    expect(saved.foreignCoins).toEqual({ ARRR: ARRR_ADDRESS });
    expect(saved.acceptedAssets).toEqual([{ id: 81, name: "Gold" }]);
    expect(saved).toMatchObject({ id: STORE_ID, shortStoreId: SHORT_STORE_ID, title: viewedStore.title });
  });

  it("suggests the best matching assets as the seller types, any case, and adds one picked", async () => {
    const { q, onClose } = setup({}, { supportedCoins: ["QORT"], foreignCoins: { ARRR: "" } });
    fireEvent.change(assetField(), { target: { value: "bhc c" } });
    const box = await screen.findByRole("listbox");
    await waitFor(() => expect(within(box).getAllByRole("option").map((o) => o.textContent)).toEqual([
      expect.stringContaining("BHC Coin"),
    ]));
    fireEvent.change(assetField(), { target: { value: "bhc" } });
    // The exact name first, then the longer one; "Whole units only" and "Can't be transferred" are said.
    await waitFor(() => expect(within(screen.getByRole("listbox")).getAllByRole("option")).toHaveLength(2));
    const [first, second] = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(first).toHaveTextContent("BHC#87");
    expect(second).toHaveTextContent(/BHC Coin#88 · BHC Coin is the native Coin/);
    fireEvent.click(second);
    const list = await screen.findByRole("list", { name: "Accepted assets" });
    expect(within(list).getByText("BHC Coin")).toBeInTheDocument();
    expect(assetField()).toHaveValue("");
    // A typed name in another case is found too, from the list (Core matches names exactly).
    fireEvent.change(assetField(), { target: { value: "gold" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(within(list).getByText("Gold")).toBeInTheDocument());
    fireEvent.change(assetField(), { target: { value: "seat" } });
    expect(await within(await screen.findByRole("listbox")).findByText("Whole units only")).toBeInTheDocument();
    fireEvent.change(assetField(), { target: { value: "lock" } });
    const locked = await within(await screen.findByRole("listbox")).findByRole("option", { name: /Locked/ });
    expect(locked).toHaveAttribute("aria-disabled", "true");
    expect(within(locked).getByText("Can't be transferred")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const saved = decodeData64((q.callsFor("PUBLISH_QDN_RESOURCE")[0] as any).data64);
    expect(saved.acceptedAssets).toEqual([{ id: 88, name: "BHC Coin" }, { id: 81, name: "Gold" }]);
  });

  it("a declined wallet request is quiet, and a coin switched on needs an address", async () => {
    const { q } = setup(
      {
        GET_USER_WALLET: async () => {
          throw { error: "User declined request" };
        },
      },
      { supportedCoins: ["QORT"], foreignCoins: { ARRR: "" } }
    );
    fireEvent.click(screen.getByRole("switch", { name: /Accept Pirate Chain/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Use my ARRR wallet address" }));
    await waitFor(() => expect(q.callsFor("GET_USER_WALLET")).toHaveLength(1));
    expect(screen.queryByText(/Couldn't read your ARRR wallet/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Add your ARRR payout address, or switch ARRR off")).toBeInTheDocument();
    expect(q.callsFor("PUBLISH_QDN_RESOURCE")).toHaveLength(0);
  });
});

describe("recreate shop data", () => {
  it("asks for the shop id, then publishes the original's empty product list and clears the products", async () => {
    stubNode();
    const q = installQortalMock({ PUBLISH_QDN_RESOURCE: async () => true });
    const store = sellerStore();
    store.dispatch(setCurrentStore({ ...viewedStore, owner: SELLER }));
    store.dispatch(setDataContainer(dataContainer));
    store.dispatch(setProductsToSave({ ...mug, isUpdate: true }));
    const onClose = vi.fn();
    renderWithProviders(<RecreateShopDataDialog open onClose={onClose} />, { store });
    const button = screen.getByRole("button", { name: "Recreate shop data" });
    expect(button).toBeDisabled();
    fireEvent.change(field(/^Shop id/), { target: { value: SHORT_STORE_ID } });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(q.callsFor("PUBLISH_QDN_RESOURCE")).toEqual([
      buildRecreateDataContainerPublish({ name: SELLER, storeId: STORE_ID, shortStoreId: SHORT_STORE_ID }).request,
    ]);
    const state = store.getState().global;
    expect(state.dataContainer).toEqual({ storeId: STORE_ID, shortStoreId: SHORT_STORE_ID, owner: SELLER, products: {}, id: DATA_CONTAINER_ID });
    expect(state.listProducts.products).toEqual([]);
    expect(state.productsToSave).toEqual({});
  });
});
