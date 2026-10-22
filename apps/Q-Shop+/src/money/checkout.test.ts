/**
 * The checkout service: the original's calls in the original's order, and
 * the fixes around them (docs/apps/Q-Shop+.md → Money code changes). Every
 * write is mocked; nothing reaches a node.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installQortalMock, type QortalMock } from "../test/qortalMock";
import {
  ARRR_ADDRESS,
  BUYER,
  BUYER_ADDRESS,
  BUYER_PK,
  CATALOGUE_ID,
  SELLER,
  SELLER_ADDRESS,
  SELLER_PK,
  SHORT_STORE_ID,
  STORE_ID,
  STORE_TITLE,
  chair,
  decodeData64,
  mug,
  poster,
  storeJson,
} from "../test/fixtures/shop";
import {
  confirmPendingPayment,
  findUnconfirmedPayment,
  recordOrder,
  startCheckout,
  PUBLISH_TIMEOUT_MS,
  type StartCheckoutArgs,
} from "./checkout";
import { getPendingOrder, listPendingOrders, pendingDelivery, resetPendingOrders } from "./pendingOrders";
import { digitalDelivery } from "./order";
import { PENDING_ORDERS_STORAGE_KEY } from "../constants/plus";

const NOW = 1761000000000;
const shop = {
  id: STORE_ID,
  title: STORE_TITLE,
  owner: SELLER,
  supportedCoins: [...storeJson.supportedCoins, "BTC"],
  foreignCoins: { ...storeJson.foreignCoins, BTC: " bc1qseller " },
  acceptedAssets: [{ id: 81, name: "Gold Bar" }],
};

let q: QortalMock;
let timeoutSpy: ReturnType<typeof vi.fn<(params: any, ms: number) => Promise<unknown>>>;

function sellerHandlers(extra: Record<string, (p: any) => unknown> = {}) {
  q = installQortalMock({
    GET_NAME_DATA: async () => ({ name: SELLER, owner: SELLER_ADDRESS }),
    GET_ACCOUNT_DATA: async () => ({ address: SELLER_ADDRESS, publicKey: SELLER_PK }),
    SEND_COIN: async (p) => (p.coin === "QORT" ? { signature: "PAYSIG" } : "foreign-txid"),
    TRANSFER_ASSET: async () => ({ signature: "ASSETSIG" }),
    PUBLISH_MULTIPLE_QDN_RESOURCES: async () => true,
    ...extra,
  });
  // Record the timeout the app asks for.
  timeoutSpy = vi.fn((params: any, _ms: number) => (globalThis as any).qortalRequest(params) as Promise<unknown>);
  (globalThis as any).qortalRequestWithTimeout = (params: any, ms: number) => timeoutSpy(params, ms);
}

function args(over: Partial<StartCheckoutArgs> = {}): StartCheckoutArgs {
  return {
    buyer: { name: BUYER, address: BUYER_ADDRESS, publicKey: BUYER_PK },
    shop,
    lines: [
      { productId: mug.id, catalogueId: CATALOGUE_ID, quantity: 2, product: mug },
      { productId: poster.id, catalogueId: CATALOGUE_ID, quantity: 1, product: poster },
    ],
    coin: "QORT",
    rate: null,
    isDigital: true,
    delivery: null,
    orderUid: "ORDERxxxx1",
    mailUid: "MAILx1",
    now: NOW,
    ...over,
  };
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => [], text: async () => "[]" }))
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("startCheckout", () => {
  it("pays in QORT, publishes order + mail encrypted with Hub's 30-minute budget, and leaves nothing pending", async () => {
    sellerHandlers();
    const onPaid = vi.fn();
    const result = await startCheckout(args({ onPaid }));
    expect(result).toEqual({ kind: "done", orderUid: "ORDERxxxx1" });
    expect(q.calls.map((c) => c.action)).toEqual([
      "GET_NAME_DATA",
      "GET_ACCOUNT_DATA",
      "SEND_COIN",
      "PUBLISH_MULTIPLE_QDN_RESOURCES",
    ]);
    expect(q.callsFor("SEND_COIN")[0]).toEqual({
      action: "SEND_COIN",
      coin: "QORT",
      destinationAddress: SELLER_ADDRESS,
      amount: "3.10000000",
    });
    expect(timeoutSpy.mock.calls[0][1]).toBe(PUBLISH_TIMEOUT_MS);
    const pub = q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any;
    expect(pub.publicKeys).toEqual([SELLER_PK, BUYER_PK]);
    expect(pub.resources[0].identifier).toBe(`q-store-order-${SHORT_STORE_ID}-ORDERxxxx1`);
    expect(decodeData64(pub.resources[0].data64).payment).toEqual({
      total: "3.10000000",
      currency: "QORT",
      transactionSignature: "PAYSIG",
      arrrAddressUsed: "",
    });
    expect(onPaid).toHaveBeenCalledTimes(1);
    expect(listPendingOrders(BUYER)).toEqual([]);
  });

  it("does nothing more when the buyer declines the payment", async () => {
    sellerHandlers({
      SEND_COIN: async () => {
        throw { error: "User declined request" };
      },
    });
    const onPaid = vi.fn();
    expect(await startCheckout(args({ onPaid }))).toEqual({ kind: "declined" });
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(0);
    expect(onPaid).not.toHaveBeenCalled();
    expect(listPendingOrders(BUYER)).toEqual([]);
  });

  it("keeps a paid order when recording it is declined, then finishes it without paying again", async () => {
    sellerHandlers({
      PUBLISH_MULTIPLE_QDN_RESOURCES: async () => {
        throw { error: "User declined request" };
      },
    });
    const onPaid = vi.fn();
    const first = await startCheckout(args({ onPaid }));
    expect(first.kind).toBe("not-recorded");
    expect(onPaid).toHaveBeenCalledTimes(1);
    const pending = getPendingOrder(BUYER, "ORDERxxxx1")!;
    expect(pending.state).toBe("paid");
    expect(pending.payment?.transactionSignature).toBe("PAYSIG");
    expect(pending.amount).toBe("3.10000000");
    // The address is never written to localStorage.
    expect(localStorage.getItem(PENDING_ORDERS_STORAGE_KEY)).not.toContain("customerName");

    q.on("PUBLISH_MULTIPLE_QDN_RESOURCES", async () => true);
    q.reset();
    const second = await recordOrder(pending, pendingDelivery("ORDERxxxx1") ?? digitalDelivery(BUYER));
    expect(second).toEqual({ kind: "done", orderUid: "ORDERxxxx1" });
    // QDN checked first, then the same order published again; no second payment.
    expect(q.callsFor("SEND_COIN")).toHaveLength(0);
    const fetchUrls = (globalThis.fetch as any).mock.calls.map((c: any[]) => String(c[0]));
    expect(fetchUrls.some((u: string) => u.includes(`identifier=q-store-order-${SHORT_STORE_ID}-ORDERxxxx1`))).toBe(true);
    const pub = q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any;
    expect(pub.resources[0].identifier).toBe(`q-store-order-${SHORT_STORE_ID}-ORDERxxxx1`);
    expect(decodeData64(pub.resources[0].data64).payment.transactionSignature).toBe("PAYSIG");
    expect(listPendingOrders(BUYER)).toEqual([]);
  });

  it("doesn't publish again when the timed-out order did land on QDN", async () => {
    sellerHandlers({
      PUBLISH_MULTIPLE_QDN_RESOURCES: async () => {
        throw "The request timed out";
      },
    });
    const first = await startCheckout(args());
    expect(first.kind).toBe("not-recorded");
    const pending = getPendingOrder(BUYER, "ORDERxxxx1")!;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => [{ name: BUYER, identifier: `q-store-order-${SHORT_STORE_ID}-ORDERxxxx1`, service: "DOCUMENT_PRIVATE" }],
      }))
    );
    q.reset();
    expect(await recordOrder(pending, digitalDelivery(BUYER))).toEqual({ kind: "done", orderUid: "ORDERxxxx1" });
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(0);
    expect(listPendingOrders(BUYER)).toEqual([]);
  });

  it("marks a payment Hub didn't answer as unconfirmed and finds it among the buyer's payments", async () => {
    sellerHandlers({
      SEND_COIN: async () => {
        throw "The request timed out";
      },
    });
    const onPaid = vi.fn();
    expect(await startCheckout(args({ onPaid }))).toEqual({ kind: "unconfirmed", orderUid: "ORDERxxxx1" });
    expect(onPaid).toHaveBeenCalledTimes(1);
    const pending = getPendingOrder(BUYER, "ORDERxxxx1")!;
    expect(pending.state).toBe("unconfirmed");
    expect(pending.payment).toBeNull();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [
          { type: "PAYMENT", recipient: SELLER_ADDRESS, amount: "3.10000000", timestamp: NOW - 5_000, signature: "OLD" },
          { type: "PAYMENT", recipient: SELLER_ADDRESS, amount: "3.10000000", timestamp: NOW + 4_000, signature: "LATE" },
        ],
      }))
    );
    const found = await findUnconfirmedPayment(pending);
    expect((globalThis.fetch as any).mock.calls[0][0]).toBe(
      `/transactions/search?txType=PAYMENT&address=${BUYER_ADDRESS}&confirmationStatus=BOTH&limit=20&reverse=true`
    );
    expect(found).toEqual({ signature: "OLD" });
    const paid = confirmPendingPayment(pending, shop, found!);
    expect(paid.state).toBe("paid");
    expect(paid.payment?.transactionSignature).toBe("OLD");
  });

  it("stops before paying when the shop has no address for the coin, or a price is missing", async () => {
    sellerHandlers();
    const noLtc = await startCheckout(args({ coin: "LTC", rate: 2 }));
    expect(noLtc).toEqual({ kind: "failed", message: "This shop has not set a LTC address" });
    const noRate = await startCheckout(args({ coin: "BTC", rate: null }));
    expect(noRate.kind).toBe("failed");
    expect(q.callsFor("SEND_COIN")).toHaveLength(0);
  });

  it("asks for the address on physical orders", async () => {
    sellerHandlers();
    const result = await startCheckout(
      args({ isDigital: false, lines: [{ productId: chair.id, catalogueId: CATALOGUE_ID, quantity: 1, product: chair }] })
    );
    expect(result).toEqual({ kind: "failed", message: "Please fill in all the required delivery fields" });
    expect(q.calls).toHaveLength(0);
  });
});

describe("other coins and assets (additive)", () => {
  it("pays BTC to the shop's trimmed BTC address and records the address and txid", async () => {
    sellerHandlers();
    const result = await startCheckout(args({ coin: "BTC", rate: 0.000001 }));
    expect(result.kind).toBe("done");
    expect(q.callsFor("SEND_COIN")[0]).toEqual({
      action: "SEND_COIN",
      coin: "BTC",
      destinationAddress: "bc1qseller",
      amount: (1.5 * 0.000001 * 2 + 0.1 * 0.000001).toFixed(8),
    });
    const order = decodeData64((q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any).resources[0].data64);
    expect(order.payment).toEqual({
      total: (1.5 * 0.000001 * 2 + 0.1 * 0.000001).toFixed(8),
      currency: "BTC",
      transactionSignature: null,
      arrrAddressUsed: "",
      foreignAddressUsed: "bc1qseller",
      foreignTxid: "foreign-txid",
    });
  });

  it("keeps ARRR exactly as the original writes it", async () => {
    sellerHandlers();
    await startCheckout(args({ coin: "ARRR", rate: 2, lines: [{ productId: poster.id, catalogueId: CATALOGUE_ID, quantity: 3, product: poster }] }));
    const order = decodeData64((q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any).resources[0].data64);
    expect(order.payment).toEqual({
      total: "0.75000000",
      currency: "ARRR",
      transactionSignature: null,
      arrrAddressUsed: ARRR_ADDRESS,
    });
  });

  it("pays an asset with TRANSFER_ASSET to the seller's address at the seller's asset price", async () => {
    sellerHandlers();
    const goldMug = { ...mug, price: [...mug.price, { currency: "ASSET:81", value: 4 }] };
    const result = await startCheckout(
      args({ coin: "ASSET:81", lines: [{ productId: mug.id, catalogueId: CATALOGUE_ID, quantity: 2, product: goldMug }] })
    );
    expect(result.kind).toBe("done");
    expect(q.callsFor("TRANSFER_ASSET")[0]).toEqual({
      action: "TRANSFER_ASSET",
      amount: "8.00000000",
      assetId: 81,
      recipient: SELLER_ADDRESS,
    });
    const order = decodeData64((q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any).resources[0].data64);
    expect(order.payment).toEqual({
      total: "8.00000000",
      currency: "ASSET:81",
      transactionSignature: "ASSETSIG",
      arrrAddressUsed: "",
      assetId: 81,
      assetName: "Gold Bar",
    });
    const mail = decodeData64((q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any).resources[1].data64);
    expect(mail.htmlContent).toContain("Gold Bar");
  });
});

afterEach(() => resetPendingOrders());
