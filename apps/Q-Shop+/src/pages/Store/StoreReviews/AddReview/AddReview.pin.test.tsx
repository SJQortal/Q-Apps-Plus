/**
 * Pins how the original app publishes a shop review: the rating ×10 is the
 * last part of the identifier (lists read it from there without fetching),
 * the JSON holds the full text and the metadata a short copy. Ported to the
 * redesigned dialog (Title, Your review, Publish review) with the same
 * expectations for every qortalRequest.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { createAppStore } from "../../../../state/store";
import { addUser } from "../../../../state/features/authSlice";
import { installQortalMock } from "../../../../test/qortalMock";
import { renderWithProviders } from "../../../../test/renderWithProviders";
import { BUYER, BUYER_ADDRESS, BUYER_PK, SHORT_STORE_ID, STORE_ID, decodeData64 } from "../../../../test/fixtures/shop";
import { AddReview } from "./AddReview";

vi.mock("short-unique-id", () => ({
  default: class {
    constructor() {
      return () => "REVIEWxxx1";
    }
  },
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("adding a review (pinned)", () => {
  it("publishes a DOCUMENT q-store-review-<shop>-<uid>-<rating×10> with review.json", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1763000000000);
    const store = createAppStore();
    store.dispatch(addUser({ address: BUYER_ADDRESS, publicKey: BUYER_PK, name: BUYER }));
    const q = installQortalMock({
      LIST_QDN_RESOURCES: async () => ({ resources: [] }),
      PUBLISH_QDN_RESOURCE: async () => ({ signature: "x" }),
    });
    renderWithProviders(<AddReview open storeId={STORE_ID} storeTitle="Shop" onClose={() => {}} />, { store });
    const longTitle = "Great shop! ".repeat(8);
    const longText = "Fast delivery and a lovely mug. ".repeat(8);
    fireEvent.click(screen.getByLabelText("4.5 Stars"));
    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: longTitle } });
    fireEvent.change(screen.getByLabelText(/^Your review/), { target: { value: longText } });
    fireEvent.click(screen.getByRole("button", { name: "Publish review" }));

    await waitFor(() => expect(q.callsFor("PUBLISH_QDN_RESOURCE")).toHaveLength(1));
    const id = `q-store-review-${SHORT_STORE_ID}-REVIEWxxx1-45`;
    expect(q.callsFor("LIST_QDN_RESOURCES")[0]).toEqual({
      action: "LIST_QDN_RESOURCES",
      service: "DOCUMENT",
      name: BUYER,
      identifier: id,
      includeMetadata: true,
      limit: 1,
    });
    const pub = q.callsFor("PUBLISH_QDN_RESOURCE")[0] as any;
    expect({ ...pub, data64: undefined }).toEqual({
      action: "PUBLISH_QDN_RESOURCE",
      name: BUYER,
      service: "DOCUMENT",
      identifier: id,
      data64: undefined,
      filename: "review.json",
      title: longTitle.slice(0, 60),
      description: longText.slice(0, 150),
    });
    expect(decodeData64(pub.data64)).toEqual({
      title: longTitle,
      description: longText,
      rating: 4.5,
      created: 1763000000000,
    });
  });
});
