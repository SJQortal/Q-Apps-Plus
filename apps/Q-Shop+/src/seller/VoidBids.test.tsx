import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { resetQdnCaches } from "../qdn/search";
import { VoidBids } from "./VoidBids";

const PRODUCT = "q-store-product-my-shop-AbCdEf1234";
const T0 = 1_800_000_000_000;
const terms = { v: 1 as const, start: T0, end: T0 + 3_600_000, startingBid: 10, extendMinutes: 5 };
const row = (name: string, uid: string, amount: number, created: number) => ({
  name,
  service: "DOCUMENT",
  identifier: `q-store-bid-my-shop-AbCdEf1234-${uid}`,
  created,
  metadata: { title: "Bid", description: `bid:${amount};to:Seller` },
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetQdnCaches();
});

describe("voiding bids", () => {
  it("lists the bids that count, newest first, and those voided already, to tick or untick", async () => {
    const rows = [row("Ann", "AAA111", 12, T0 + 1000), row("Troll", "TTT999", 9_000_000, T0 + 2000), row("Bob", "BBB222", 5, T0 + 3000)];
    vi.stubGlobal("fetch", async () => ({ ok: true, status: 200, json: async () => rows, text: async () => JSON.stringify(rows) }));
    const onChange = vi.fn();
    render(<VoidBids productId={PRODUCT} seller="Seller" terms={terms} voided={["q-store-bid-my-shop-AbCdEf1234-TTT999"]} onChange={onChange} />);
    const boxes = await screen.findAllByRole("checkbox");
    // Bob's 5 is under the starting bid: it never counts, so it isn't listed.
    expect(boxes.map((b) => b.closest("label")?.textContent)).toEqual([expect.stringMatching(/^Void: Troll, 9,000,000.00 QORT/), expect.stringMatching(/^Void: Ann, 12.00 QORT/)]);
    expect(boxes[0]).toBeChecked();
    fireEvent.click(boxes[1]);
    expect(onChange).toHaveBeenCalledWith(["q-store-bid-my-shop-AbCdEf1234-TTT999", "q-store-bid-my-shop-AbCdEf1234-AAA111"]);
  });
});
