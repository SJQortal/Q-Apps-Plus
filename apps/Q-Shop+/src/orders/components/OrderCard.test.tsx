import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../test/renderWithProviders";
import { orderId, orderJson } from "../testing";
import { BUYER } from "../../test/fixtures/shop";
import { OrderCard } from "./OrderCard";

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
});
