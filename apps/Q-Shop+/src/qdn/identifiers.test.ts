import { describe, expect, it } from "vitest";
import {
  catalogueIdentifier,
  dataContainerIdentifier,
  finalizeShortStoreId,
  orderIdForStatus,
  orderIdentifier,
  orderMailIdentifier,
  productIdentifier,
  ratingFromReviewIdentifier,
  reviewIdentifier,
  sanitizeShortStoreIdInput,
  shortStoreIdOf,
  shortStoreIdOfOrder,
  shortStoreIdOfReview,
  statusIdentifierForOrder,
  storeIdentifier,
} from "./identifiers";

describe("shop identifiers (the original's formats)", () => {
  it("builds every identifier the original builds", () => {
    expect(storeIdentifier("my-shop")).toBe("q-store-general-my-shop");
    expect(shortStoreIdOf("q-store-general-my-shop")).toBe("my-shop");
    expect(dataContainerIdentifier("q-store-general-my-shop")).toBe("q-store-general-my-shop-datacontainer");
    expect(catalogueIdentifier("my-shop", "abcdefghij")).toBe("q-store-catalogue-my-shop-abcdefghij");
    expect(productIdentifier("my-shop", "abcdefghij")).toBe("q-store-product-my-shop-abcdefghij");
    expect(orderIdentifier("my-shop", "abcdefghij")).toBe("q-store-order-my-shop-abcdefghij");
    expect(reviewIdentifier("my-shop", "abcdefghij", 4.5)).toBe("q-store-review-my-shop-abcdefghij-45");
    expect(orderMailIdentifier("A very long seller name here", "QAddressxxxx123456", "uid6xx")).toBe(
      "qortal_qmail_A very long seller n_123456_mail_uid6xx"
    );
  });

  it("maps an order to its status document and back", () => {
    const order = "q-store-order-my-shop-abcdefghij";
    expect(statusIdentifierForOrder(order)).toBe("q-store-status-order-my-shop-abcdefghij");
    expect(orderIdForStatus(statusIdentifierForOrder(order))).toBe(order);
  });

  it("reads the rating from a review identifier, only for the exact shop", () => {
    expect(ratingFromReviewIdentifier("q-store-review-my-shop-abcdefghij-45", "my-shop")).toBe(4.5);
    expect(ratingFromReviewIdentifier("q-store-review-my-shop-2-abcdefghij-10", "my-shop")).toBeNull();
    expect(ratingFromReviewIdentifier("q-store-review-my-shop-2-abcdefghij-10", "my-shop-2")).toBe(1);
    expect(ratingFromReviewIdentifier("q-store-review-my-shop-abcdefghij-99")).toBeNull();
    expect(ratingFromReviewIdentifier("q-store-order-my-shop-abc-45")).toBeNull();
    expect(shortStoreIdOfReview("q-store-review-my-shop-2-abcdefghij-10")).toBe("my-shop-2");
    expect(shortStoreIdOfOrder("q-store-order-my-shop-2-abcdefghij")).toBe("my-shop-2");
  });

  it("cleans a typed shop id the way the Create Shop form does", () => {
    expect(sanitizeShortStoreIdInput("My  Shop!! 2")).toBe("My-Shop-2");
    expect(sanitizeShortStoreIdInput("best post shop")).toBe("best--shop");
    expect(sanitizeShortStoreIdInput("Q-Shop corner")).toBe("-corner");
    expect(finalizeShortStoreId("-corner-")).toBe("corner");
  });
});
