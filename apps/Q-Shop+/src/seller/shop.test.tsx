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
import { assetInfo, parseAssetQuery, resetAssetCache } from "./assets";

const LOGO = "data:image/webp;base64,TE9HTw==";

// The real picker compresses with a canvas, which jsdom lacks: pick a fixed logo instead.
vi.mock("../components/common/ImageUploader", () => ({
  default: ({ label, onPick }: { label: string; onPick: (img: string) => void }) => (
    <button type="button" onClick={() => onPick("data:image/webp;base64,TE9HTw==")}>
      {label}
    </button>
  ),
}));

/** A node that knows our shops (by search) and two assets. */
function stubNode(opts: { shops?: { name: string; identifier: string }[] } = {}) {
  const calls: string[] = [];
  const assets = [
    { assetId: 0, assetName: "QORT", isUnspendable: false },
    { assetId: 81, assetName: "Gold", isUnspendable: false },
    { assetId: 82, assetName: "Locked", isUnspendable: true },
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
      const asset = assets.find((a) => (id !== null ? String(a.assetId) === id : a.assetName === name));
      return asset ? ok(asset) : { ok: false, status: 400, text: async () => '{"error":601}' };
    }
    if (path === "/assets") return ok(assets);
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

beforeEach(() => {
  resetAssetCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("shop form values", () => {
  it("keeps the original's shapes: QORT first, foreignCoins.ARRR always there, extra coins only with an address", () => {
    const values = shopFormValues({ ...viewedStore, foreignCoins: { ARRR: ` ${ARRR_ADDRESS} ` } });
    expect(values.coins).toMatchObject({ ARRR: true, BTC: false });
    const fields = toStoreFields(values);
    expect(fields.supportedCoins).toEqual(["QORT", "ARRR"]);
    expect(fields.foreignCoins).toEqual({ ARRR: ARRR_ADDRESS });
    const none = toStoreFields(shopFormValues(null));
    expect(none.supportedCoins).toEqual(["QORT"]);
    expect(none.foreignCoins).toEqual({ ARRR: "" });
    const btcOff = toStoreFields({ ...values, addresses: { ...values.addresses, BTC: "bc1qkeepme" } });
    expect(btcOff.supportedCoins).toEqual(["QORT", "ARRR"]);
    expect(btcOff.foreignCoins).toEqual({ ARRR: ARRR_ADDRESS, BTC: "bc1qkeepme" });
  });

  it("asks for an address for every coin switched on", () => {
    const values = { ...shopFormValues(viewedStore), coins: { ...shopFormValues(viewedStore).coins, LTC: true } };
    expect(validateShopForm(values)).toBe("Add your LTC payout address, or switch LTC off");
  });

  it("warns, without blocking, about an address that doesn't look like the coin's", () => {
    expect(addressWarning("BTC", "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq")).toBeNull();
    expect(addressWarning("BTC", "QSeLLeRAddressxxxxxxxxxxxxxxx9f3c2")).toMatch(/Qortal address/);
    expect(addressWarning("ARRR", "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq")).toMatch(/doesn't look like a ARRR/);
    expect(addressWarning("LTC", "")).toBeNull();
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

describe("edit shop", () => {
  function setup(handlers: Record<string, (p: any) => unknown> = {}) {
    stubNode();
    const q = installQortalMock({ PUBLISH_QDN_RESOURCE: async () => true, ...handlers });
    const store = sellerStore();
    store.dispatch(setCurrentStore({ ...viewedStore, owner: SELLER }));
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

  it("adds BTC from the wallet and an asset by name, and saves them as additive data", async () => {
    const { q, onClose } = setup({ GET_USER_WALLET: async (p) => ({ address: p.coin === "BTC" ? "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq" : "x" }) });
    fireEvent.click(screen.getByRole("switch", { name: /Accept Bitcoin/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Use my BTC wallet address" }));
    await waitFor(() => expect(field(/^BTC payout address/)).toHaveValue("bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"));
    expect(q.callsFor("GET_USER_WALLET")).toEqual([{ action: "GET_USER_WALLET", coin: "BTC" }]);

    fireEvent.change(field(/^Asset name or id/), { target: { value: "QORT" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("QORT is always accepted.")).toBeInTheDocument();
    fireEvent.change(field(/^Asset name or id/), { target: { value: "Gold" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    const list = await screen.findByRole("list", { name: "Accepted assets" });
    expect(within(list).getByText("Gold")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const [req] = q.callsFor("PUBLISH_QDN_RESOURCE") as any[];
    const saved = decodeData64(req.data64);
    expect(saved.supportedCoins).toEqual(["QORT", "ARRR", "BTC"]);
    expect(saved.foreignCoins).toEqual({ ARRR: ARRR_ADDRESS, BTC: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq" });
    expect(saved.acceptedAssets).toEqual([{ id: 81, name: "Gold" }]);
    expect(saved).toMatchObject({ id: STORE_ID, shortStoreId: SHORT_STORE_ID, title: viewedStore.title });
  });

  it("a declined wallet request is quiet, and a coin switched on needs an address", async () => {
    const { q } = setup({
      GET_USER_WALLET: async () => {
        throw { error: "User declined request" };
      },
    });
    fireEvent.click(screen.getByRole("switch", { name: /Accept Litecoin/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Use my LTC wallet address" }));
    await waitFor(() => expect(q.callsFor("GET_USER_WALLET")).toHaveLength(1));
    expect(screen.queryByText(/Couldn't read your LTC wallet/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Add your LTC payout address, or switch LTC off")).toBeInTheDocument();
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
