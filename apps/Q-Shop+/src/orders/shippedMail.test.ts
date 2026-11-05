import { describe, expect, it } from "vitest";
import { buildShippedMailPublish, shippedMailHtml, shippedMailText } from "./shippedMail";
import { orderMailIdentifier } from "../qdn/identifiers";
import type { Order } from "../state/features/orderSlice";

const order = {
  id: "q-store-order-shop-UID",
  user: "Buyer+One",
  storeName: "Biohackers Corner",
  sellerName: "Simon James",
  details: {
    "q-store-product-a": { quantity: 2, product: { title: "Matcha | 30g" } },
    "q-store-delivery": { quantity: 1, product: { title: "Delivery", type: "delivery" } },
    totalPrice: 500,
  },
} as unknown as Order;

describe("the shipped Q-Mail", () => {
  it("says what shipped, how to track it and the seller's note", () => {
    const text = shippedMailText(order, { number: "RR123", carrier: "DHL" }, " Well packed. ");
    expect(text).toContain("Your order from Biohackers Corner has been shipped.");
    expect(text).toContain("2 × Matcha | 30g");
    expect(text).toContain("Carrier: DHL\nTracking number: RR123");
    expect(text.endsWith("Well packed.")).toBe(true);
  });

  it("leaves out what wasn't given", () => {
    expect(shippedMailText(order, null, "")).not.toMatch(/Tracking|Carrier|\n\n\n/);
    expect(shippedMailText(order, { number: "RR123" }, "")).not.toContain("Carrier");
  });

  it("escapes what was typed, keeping its lines", () => {
    const html = shippedMailHtml("<img src=x>\nsecond\n\nnext part");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img src=x&gt;<br>second");
    expect(html).toContain(">next part</p>");
  });

  it("is an encrypted Q-Mail to the buyer, with nothing public about the order", () => {
    const request = buildShippedMailPublish({ order, text: "Sent", seller: "Simon James", buyerAddress: "QBuyerAddr123", buyerPublicKey: "BuyerPK", sellerPublicKey: "SellerPK", uid: "UID1", now: 5 });
    expect(request).toMatchObject({
      action: "PUBLISH_QDN_RESOURCE",
      name: "Simon James",
      service: "MAIL_PRIVATE",
      identifier: orderMailIdentifier("Buyer+One", "QBuyerAddr123", "UID1"),
      encrypt: true,
      publicKeys: ["BuyerPK", "SellerPK"],
    });
    expect(request).not.toHaveProperty("title");
    expect(request).not.toHaveProperty("description");
    const mail = JSON.parse(decodeURIComponent(escape(atob(request.data64))));
    expect(mail).toMatchObject({ recipient: "Buyer+One", subject: "Your order from Biohackers Corner has been shipped", attachments: [], generalData: { thread: [] } });
    expect(mail.htmlContent).toContain("Sent");
  });
});
