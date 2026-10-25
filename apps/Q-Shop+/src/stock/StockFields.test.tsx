import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "../test/renderWithProviders";
import { resetQdnCaches } from "../qdn/search";
import { StockFields } from "./StockFields";
import type { StockFormValues } from "./catalog";

const P1 = "q-store-product-my-shop-PRODxxxxx1";
const seen: StockFormValues[] = [];

function Harness({ start }: { start: StockFormValues }) {
  const [value, setValue] = useState(start);
  const change = (next: StockFormValues) => {
    seen.push(next);
    setValue(next);
  };
  return <StockFields value={value} onChange={change} productId={P1} shortStoreId="my-shop" variants={false} />;
}

beforeEach(() => {
  resetQdnCaches();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => [
        { name: "Troll", service: "DOCUMENT_PRIVATE", identifier: "q-store-order-my-shop-ORDERxxxx2", created: 3000, metadata: { description: "stock:PRODxxxxx1x9" } },
        { name: "Ann", service: "DOCUMENT_PRIVATE", identifier: "q-store-order-my-shop-ORDERxxxx1", created: 2000, metadata: { description: "stock:PRODxxxxx1x2" } },
      ],
    }))
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("the stock section of an edited product", () => {
  it("shows what's left, lists the orders counted, and stops counting a fake one", async () => {
    renderWithProviders(<Harness start={{ tracked: true, quantity: "", saved: { v: 1, quantity: 20, since: 1000 }, voided: [] }} />);
    const box = await screen.findByPlaceholderText("9 left now");
    expect(box).toHaveValue("");
    expect(screen.getByText(/from 20: 11 sold/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Don't count: Troll's order of 9" }));
    expect(seen.at(-1)?.voided).toEqual(["ORDERxxxx2"]);
    expect(await screen.findByPlaceholderText("18 left now")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Count again: Troll's order of 9" })).toBeInTheDocument();
  });
});
