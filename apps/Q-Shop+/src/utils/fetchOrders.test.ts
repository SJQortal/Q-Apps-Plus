import { afterEach, describe, expect, it, vi } from "vitest";
import { foreignOrderApp, OrderReadError, readOrderJson } from "./fetchOrders";
import { jsonToBase64 } from "../qdn/payloads";

afterEach(() => vi.unstubAllGlobals());

/** Hub answering FETCH with an encrypted body and DECRYPT_DATA with `json` in base64. */
function hubWith(json: unknown) {
  vi.stubGlobal(
    "qortalRequest",
    vi.fn(async (req: { action: string }) => (req.action === "FETCH_QDN_RESOURCE" ? "cW9ydGFsR3JvdXBFbmNyeXB0ZWREYXRhAAAA" : jsonToBase64(json)))
  );
}

describe("another app's order under Q-Shop's prefix", () => {
  it("names the app its JSON points to (Q-Shops, as in Simon's Hub on 2026-10-27)", () => {
    expect(foreignOrderApp({ orderId: "qs-1", orderedVia: "q-shops-q-app", qshopsAppHref: "qortal://APP/Q-Shops" })).toEqual({ name: "Q-Shops", link: "qortal://APP/Q-Shops" });
    // A path after the name, or a name with "+" (written as it is: Hub doesn't decode it).
    expect(foreignOrderApp({ appHref: "qortal://APP/Q-Shop+/orders/1" })).toEqual({ name: "Q-Shop+", link: "qortal://APP/Q-Shop+" });
    // Says it came from another app without saying which.
    expect(foreignOrderApp({ orderedVia: "some-app" })).toEqual({ name: "another app", link: null });
    // Q-Shops' first orders name no app, but have its own fields.
    expect(foreignOrderApp({ orderId: "qs-magdalena-1", shopPublisher: "Magdalena", lines: [], communicationMethod: [] })).toEqual({ name: "Q-Shops", link: "qortal://APP/Q-Shops" });
    // An odd name isn't linked.
    expect(foreignOrderApp({ href: "qortal://APP/<script>" })).toEqual({ name: "another app", link: null });
  });

  it("isn't another app's order when nothing says so: a broken Q-Shop order stays broken", () => {
    expect(foreignOrderApp({ nope: true })).toBeNull();
    expect(foreignOrderApp({ link: "qortal://VIDEO/x/y" })).toBeNull();
    expect(foreignOrderApp(null)).toBeNull();
    expect(foreignOrderApp(["qortal://APP/Q-Shops"])).toBeNull();
  });

  it("reads as stage foreign, with its app; a JSON that isn't an order and says nothing reads as invalid", async () => {
    hubWith({ orderId: "qs-1", orderedVia: "q-shops-q-app", qshopsAppHref: "qortal://APP/Q-Shops" });
    const foreign = await readOrderJson("Simon James", "q-store-order-magdalena-qs-1").catch((e) => e);
    expect(foreign).toBeInstanceOf(OrderReadError);
    expect(foreign).toMatchObject({ stage: "foreign", app: { name: "Q-Shops", link: "qortal://APP/Q-Shops" } });
    hubWith({ nope: true });
    const invalid = await readOrderJson("Simon James", "q-store-order-shop-1").catch((e) => e);
    expect(invalid).toMatchObject({ stage: "invalid" });
    expect(invalid.app).toBeUndefined();
  });
});
