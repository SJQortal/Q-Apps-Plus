/** An order's delivery fee line (delivery/model.ts): shown as the fee, not as one of the items, in the + app and the seller's mail. */
import { describe, expect, it } from "vitest";
import type { CartLine } from "../money/order";
import { buildOrderMailHtml } from "../money/order";
import { DELIVERY_LINE_ID, quoteDelivery, type DeliveryDoc } from "../delivery/model";
import { isDigitalOrder, orderDelivery, orderItems } from "./format";

const chair: CartLine = { productId: "chair", catalogueId: "c", quantity: 2, product: { title: "Chair", type: "physical", price: [{ currency: "qort", value: 12 }] } as never };

describe("an order with a delivery line", () => {
  const doc: DeliveryDoc = { v: 1, storeId: "s", currency: "QORT", general: { zones: [{ id: "eu", countries: ["PL"], first: 2, extra: 1 }] }, profiles: [], updated: 1 };
  const fee = quoteDelivery({ doc, lines: [chair], country: "Poland", state: "", pricing: null, takesArrr: false });
  const line = fee.kind === "charge" ? fee.line : null;
  const details = {
    totalPrice: "27.00000000",
    chair: { product: chair.product, catalogueId: "c", quantity: 2, pricePerUnit: 12, totalProductPrice: 24 },
    [DELIVERY_LINE_ID]: { product: line!.product, catalogueId: "", quantity: 1, pricePerUnit: 3, totalProductPrice: 3 },
  };

  it("lists the products as items and the fee on its own", () => {
    const order = { id: "o", details } as never;
    expect(orderItems(order).map((i) => i.productId)).toEqual(["chair"]);
    expect(orderDelivery(order)).toEqual({ title: "Delivery to Poland", total: 3 });
    expect(isDigitalOrder(order)).toBe(false);
    expect(orderDelivery({ id: "o", details: { totalPrice: "24", chair: details.chair } } as never)).toBeNull();
  });

  it("shows the fee in the seller's mail without counting it as an item", () => {
    const html = buildOrderMailHtml({
      details: details as never,
      storeTitle: "My Shop",
      currency: "QORT",
      currencyLabel: "QORT",
      isDigital: false,
      buyerName: "Ann",
      delivery: { customerName: "Ann", streetAddress: "1 Main", city: "Warsaw", state: "", region: "", country: "Poland", zipCode: "00-001", deliveryNote: "" },
      created: 1,
    });
    expect(html).toContain("Ann ordered 2 items");
    expect(html).toMatch(/colspan="3"><strong>Delivery to Poland<\/strong>/);
  });
});
