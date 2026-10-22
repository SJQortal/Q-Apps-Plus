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
  PAYMENT_MATCH_WINDOW_MS,
  PUBLISH_TIMEOUT_MS,
  type StartCheckoutArgs,
} from "./checkout";
import { getPendingOrder, isRecordingOrder, listPendingOrders, pendingDelivery, resetPendingOrders } from "./pendingOrders";
import { digitalDelivery } from "./order";
import { PENDING_ORDERS_STORAGE_KEY } from "../constants/plus";
import { orderMailIdentifier } from "../qdn/identifiers";

const NOW = 1761000000000;
const ORDER_ID = `q-store-order-${SHORT_STORE_ID}-ORDERxxxx1`;
const MAIL_ID = orderMailIdentifier(SELLER, SELLER_ADDRESS, "MAILx1");
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

  it("publishes one order once at a time: a second Finish waits for the running one", async () => {
    sellerHandlers({
      PUBLISH_MULTIPLE_QDN_RESOURCES: async () => {
        throw { error: "User declined request" };
      },
    });
    await startCheckout(args());
    const pending = getPendingOrder(BUYER, "ORDERxxxx1")!;
    let answer: (value: unknown) => void = () => {};
    q.on("PUBLISH_MULTIPLE_QDN_RESOURCES", () => new Promise((resolve) => (answer = resolve)));
    q.reset();

    expect(isRecordingOrder("ORDERxxxx1")).toBe(false);
    const first = recordOrder(pending, digitalDelivery(BUYER));
    expect(isRecordingOrder("ORDERxxxx1")).toBe(true);
    const second = recordOrder(pending, digitalDelivery(BUYER));
    await vi.waitFor(() => expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1));
    answer(true);
    expect(await first).toEqual({ kind: "done", orderUid: "ORDERxxxx1" });
    expect(await second).toEqual({ kind: "done", orderUid: "ORDERxxxx1" });
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(1);
    expect(isRecordingOrder("ORDERxxxx1")).toBe(false);
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
        json: async () => [
          { name: BUYER, identifier: ORDER_ID, service: "DOCUMENT_PRIVATE" },
          { name: BUYER, identifier: MAIL_ID, service: "MAIL_PRIVATE" },
        ],
      }))
    );
    q.reset();
    expect(await recordOrder(pending, digitalDelivery(BUYER))).toEqual({ kind: "done", orderUid: "ORDERxxxx1" });
    expect(q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")).toHaveLength(0);
    expect(listPendingOrders(BUYER)).toEqual([]);
  });

  it("sends the seller's Q-Mail on Finish when Hub published the order but not the mail", async () => {
    sellerHandlers({
      PUBLISH_MULTIPLE_QDN_RESOURCES: async () => {
        throw { error: { unsuccessfulPublishes: [{ identifier: MAIL_ID, reason: "upload failed" }] }, message: "Failed to publish" };
      },
    });
    const first = await startCheckout(args());
    expect(first).toEqual({
      kind: "not-recorded",
      orderUid: "ORDERxxxx1",
      message: "Your order was recorded, but the seller's Q-Mail about it wasn't sent (upload failed). Finish the order to send it; you won't pay again.",
    });
    const firstPublish = q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as any;
    const pending = getPendingOrder(BUYER, "ORDERxxxx1")!;
    expect(pending.published).toEqual(["order"]);

    // Finish: QDN may not list the order yet, but Hub said it landed; only the mail goes, exactly as before.
    q.on("PUBLISH_MULTIPLE_QDN_RESOURCES", async () => [{ signature: "x" }]);
    q.reset();
    expect(await recordOrder(pending, digitalDelivery(BUYER))).toEqual({ kind: "done", orderUid: "ORDERxxxx1" });
    const mailOnly = q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES") as any[];
    expect(mailOnly).toHaveLength(1);
    expect(mailOnly[0]).toEqual({ ...firstPublish, resources: [firstPublish.resources[1]] });
    expect(mailOnly[0].resources[0]).toMatchObject({ service: "MAIL_PRIVATE", identifier: MAIL_ID, name: BUYER });
    expect(mailOnly[0].encrypt).toBe(true);
    expect(mailOnly[0].publicKeys).toEqual([SELLER_PK, BUYER_PK]);
    expect(listPendingOrders(BUYER)).toEqual([]);
  });

  it("on Finish, publishes only the part QDN doesn't have yet", async () => {
    sellerHandlers({
      PUBLISH_MULTIPLE_QDN_RESOURCES: async () => {
        throw "The request timed out";
      },
    });
    await startCheckout(args());
    const pending = getPendingOrder(BUYER, "ORDERxxxx1")!;
    // The timed-out publish landed the order; the mail never arrived.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        status: 200,
        json: async () =>
          String(url).includes("DOCUMENT_PRIVATE") ? [{ name: BUYER, identifier: ORDER_ID, service: "DOCUMENT_PRIVATE" }] : [],
      }))
    );
    q.on("PUBLISH_MULTIPLE_QDN_RESOURCES", async () => [{ signature: "x" }]);
    q.reset();
    expect(await recordOrder(pending, digitalDelivery(BUYER))).toEqual({ kind: "done", orderUid: "ORDERxxxx1" });
    const pub = q.callsFor("PUBLISH_MULTIPLE_QDN_RESOURCES") as any[];
    expect(pub).toHaveLength(1);
    expect(pub[0].resources.map((r: any) => r.identifier)).toEqual([MAIL_ID]);
  });

  it("treats a failure Hub answers instead of throwing as a failure", async () => {
    sellerHandlers({
      PUBLISH_MULTIPLE_QDN_RESOURCES: async () => ({ message: "Publish cancelled", error: { cancelled: true, unsuccessfulPublishes: [] } }),
    });
    const result = await startCheckout(args());
    expect(result.kind).toBe("not-recorded");
    expect(getPendingOrder(BUYER, "ORDERxxxx1")?.state).toBe("paid");
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
          // Signed before this checkout started: another purchase.
          { type: "PAYMENT", recipient: SELLER_ADDRESS, amount: "3.10000000", timestamp: NOW - 5_000, signature: "OLD" },
          { type: "PAYMENT", recipient: SELLER_ADDRESS, amount: "3.10000000", timestamp: NOW + 4_000, signature: "LATE" },
        ],
      }))
    );
    const found = await findUnconfirmedPayment(pending);
    expect((globalThis.fetch as any).mock.calls[0][0]).toBe(
      `/transactions/search?txType=PAYMENT&address=${BUYER_ADDRESS}&confirmationStatus=BOTH&limit=20&reverse=true`
    );
    expect(found).toEqual({ kind: "found", signature: "LATE" });
    const paid = confirmPendingPayment(pending, shop, { signature: "LATE" });
    expect(paid.state).toBe("paid");
    expect(paid.payment?.transactionSignature).toBe("LATE");
  });

  it("never gives \"Check again\" a payment another order already uses, and never picks one of several", async () => {
    const payment = (signature: string, at: number) => ({
      type: "PAYMENT",
      recipient: SELLER_ADDRESS,
      amount: "3.10000000",
      timestamp: at,
      signature,
    });
    let rows: unknown[] = [];
    const stubRows = () =>
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => ({
          ok: true,
          status: 200,
          json: async () => (String(url).startsWith("/transactions/") ? rows : []),
          text: async () => "[]",
        }))
      );

    // Order 1 is paid (S1) and recorded.
    sellerHandlers({ SEND_COIN: async () => ({ signature: "S1" }) });
    stubRows();
    expect(await startCheckout(args({ orderUid: "ORDER00001", now: NOW }))).toEqual({ kind: "done", orderUid: "ORDER00001" });

    // A minute later, the same 3.1 QORT to the same seller: Hub doesn't answer, and nothing is sent.
    sellerHandlers({
      SEND_COIN: async () => {
        throw "The request timed out";
      },
    });
    await startCheckout(args({ orderUid: "ORDER00002", now: NOW + 60_000 }));
    const second = getPendingOrder(BUYER, "ORDER00002")!;
    // S1 paid for order 1, which is recorded: even when its time would fit order 2, it isn't order 2's.
    rows = [payment("S1", NOW + 61_000)];
    expect(await findUnconfirmedPayment(second)).toEqual({ kind: "none" });

    // Another unconfirmed order whose payment was found keeps its signature to itself.
    await startCheckout(args({ orderUid: "ORDER00003", now: NOW + 120_000 }));
    const third = getPendingOrder(BUYER, "ORDER00003")!;
    rows = [payment("S3", NOW + 121_000)];
    expect(await findUnconfirmedPayment(third)).toEqual({ kind: "found", signature: "S3" });
    confirmPendingPayment(third, shop, { signature: "S3" });
    expect(await findUnconfirmedPayment(second)).toEqual({ kind: "none" });

    // Remembered across a reload.
    resetPendingOrders();
    rows = [payment("S1", NOW + 61_000), payment("S3", NOW + 121_000)];
    expect(await findUnconfirmedPayment(getPendingOrder(BUYER, "ORDER00002")!)).toEqual({ kind: "none" });

    // Two fresh payments that both fit: the buyer picks, nothing is taken on its own.
    rows = [payment("B", NOW + 200_000), payment("A", NOW + 190_000)];
    expect(await findUnconfirmedPayment(second)).toEqual({
      kind: "several",
      candidates: [
        { signature: "A", timestamp: NOW + 190_000 },
        { signature: "B", timestamp: NOW + 200_000 },
      ],
    });

    // Much later than the checkout: not this order's.
    rows = [payment("MUCH-LATER", NOW + 60_000 + PAYMENT_MATCH_WINDOW_MS + 1)];
    expect(await findUnconfirmedPayment(second)).toEqual({ kind: "none" });
  });

  it("says the node didn't answer instead of \"no payment\"", async () => {
    sellerHandlers({
      SEND_COIN: async () => {
        throw "The request timed out";
      },
    });
    await startCheckout(args());
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })));
    await expect(findUnconfirmedPayment(getPendingOrder(BUYER, "ORDERxxxx1")!)).rejects.toThrow("503");
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
