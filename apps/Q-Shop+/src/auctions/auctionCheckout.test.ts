import { describe, expect, it } from "vitest";
import { priceCheckout } from "../money/checkout";
import { shopCoins } from "../money/coins";
import { auctionCheckoutShop, wonLine } from "./auctionCheckout";

const product = {
  title: "Old clock",
  id: "q-store-product-my-shop-P000000011",
  status: "OUT_OF_STOCK",
  price: [
    { currency: "qort", value: 10 },
    { currency: "ARRR", value: 3 },
  ],
  auction: { v: 1, start: 1, end: 2, startingBid: 10, extendMinutes: 5 },
};
const winner = { id: "q-store-bid-my-shop-P000000011-MINE01", bidder: "Buyer", amount: 15.5, created: 1 };

describe("paying for a won auction", () => {
  it("charges exactly the winning bid through the usual checkout, and the order says which bid won", () => {
    const line = wonLine(product, product.id, "q-store-catalogue-my-shop-CAT0000001", winner);
    const { amount, details } = priceCheckout([line], "QORT", null);
    expect(amount).toBe("15.50000000");
    expect(details[product.id]).toEqual({
      product: { ...product, price: [{ currency: "qort", value: 15.5 }], auctionWin: { bid: winner.id, bidder: "Buyer", amount: 15.5 } },
      catalogueId: "q-store-catalogue-my-shop-CAT0000001",
      quantity: 1,
      pricePerUnit: 15.5,
      totalProductPrice: 15.5,
    });
    // The product's other prices don't come along: there's no ARRR price to pay.
    expect(() => priceCheckout([line], "ARRR", null)).toThrow();
  });

  it("offers QORT only, whatever else the shop takes", () => {
    const shop = auctionCheckoutShop("q-store-general-my-shop", "Seller", {
      title: "Shop",
      supportedCoins: ["QORT", "ARRR"],
      foreignCoins: { ARRR: "zs1arrr" },
      acceptedAssets: [{ id: 7, name: "Gold" }],
    });
    expect(shopCoins(shop)).toEqual(["QORT"]);
    expect(shop).toMatchObject({ id: "q-store-general-my-shop", owner: "Seller", title: "Shop" });
  });
});
