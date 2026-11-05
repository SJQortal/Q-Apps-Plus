import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { orderId, orderJson } from "../testing";
import { BUYER } from "../../test/fixtures/shop";
import { OrderCard } from "./OrderCard";
import { createAppStore } from "../../state/store";
import { setCurrentStore } from "../../state/features/globalSlice";

const ID = orderId("ORDERxxxx1");

describe("an order card", () => {
  it("shows a shipped order's carrier and tracking number at a glance", () => {
    const order = { ...orderJson(), user: BUYER, id: ID, created: 1761000000000, updated: 2, isValid: true } as never;
    renderWithProviders(
      <OrderCard
        item={{ row: order, order, openState: null, status: { state: "known", status: "Shipped", note: "", tracking: { number: "RR123456785PT", carrier: "CTT" }, updated: 5 }, delivered: null }}
        role="buyer"
        onOpen={vi.fn()}
        onRetry={vi.fn()}
      />
    );
    expect(screen.getByText("Tracking: CTT RR123456785PT")).toBeInTheDocument();
  });

  it("shows the seller when an order to handle is due to leave, by the shop's dispatch time", () => {
    const store = createAppStore();
    store.dispatch(setCurrentStore({ id: "q-store-general-shop", owner: "Seller", title: "Shop", policies: { dispatchDays: 2 } } as never));
    const placed = Date.now() - 30 * 86_400_000;
    const order = { ...orderJson({ physical: true }), user: BUYER, id: ID, created: placed, updated: 2, isValid: true } as never;
    renderWithProviders(
      <OrderCard item={{ row: order, order, openState: null, status: { state: "known", status: "Received", note: "", updated: 5 }, delivered: null }} role="seller" onOpen={vi.fn()} onRetry={vi.fn()} />,
      { store }
    );
    expect(screen.getByText(/^Dispatch was due /)).toBeInTheDocument();
  });
});
