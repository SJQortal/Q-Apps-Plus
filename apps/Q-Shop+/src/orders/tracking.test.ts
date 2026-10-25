import { describe, expect, it } from "vitest";
import { noteWithTracking, noteWithoutTracking, trackingLine, trackingOf } from "./tracking";
import { statusInfoFrom } from "./status";
import { buildStatusPublish } from "../qdn/payloads";

const decode = (data64: string) => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(data64), (c) => c.charCodeAt(0))));

describe("tracking", () => {
  it("reads a carrier and number from a status note, safely", () => {
    expect(trackingOf({ tracking: { number: " 0034 0434 ", carrier: "DHL" } })).toEqual({ number: "0034 0434", carrier: "DHL" });
    expect(trackingOf({ tracking: { number: "RR123456785PT" } })).toEqual({ number: "RR123456785PT" });
    expect(trackingOf({ tracking: { number: "", carrier: "DHL" } })).toBeNull();
    expect(trackingOf({ tracking: "RR1" })).toBeNull();
    expect(trackingOf({ status: "Shipped" })).toBeNull();
  });

  it("adds a line to the note for the original app, and this app shows the note without it", () => {
    const t = { number: "RR123456785PT", carrier: "CTT" };
    expect(trackingLine(t)).toBe("Tracking: CTT RR123456785PT");
    expect(noteWithTracking("Sent today.", t)).toBe("Sent today.\nTracking: CTT RR123456785PT");
    expect(noteWithTracking("", t)).toBe("Tracking: CTT RR123456785PT");
    // A note that names the number already is left as it is.
    expect(noteWithTracking("CTT RR123456785PT, sent today", t)).toBe("CTT RR123456785PT, sent today");
    expect(noteWithoutTracking("Sent today.\nTracking: CTT RR123456785PT", t)).toBe("Sent today.");
    expect(noteWithoutTracking("Tracking: CTT RR123456785PT", t)).toBe("");
    expect(noteWithoutTracking("Sent today.", null)).toBe("Sent today.");
  });

  it("goes in the status note the seller publishes, and comes back out of it", () => {
    const request = buildStatusPublish({ orderId: "q-store-order-abc", seller: "Seller", status: "Shipped", note: "Sent today.", tracking: { number: "RR1", carrier: "CTT" }, buyerPublicKey: "b", sellerPublicKey: "s" });
    const json = decode(request.data64);
    expect(json).toEqual({ status: "Shipped", note: "Sent today.\nTracking: CTT RR1", tracking: { number: "RR1", carrier: "CTT" } });
    expect(statusInfoFrom(json, 5)).toEqual({ state: "known", status: "Shipped", note: "Sent today.", tracking: { number: "RR1", carrier: "CTT" }, updated: 5 });
    // Without tracking, the note is the original's shape.
    const plain = decode(buildStatusPublish({ orderId: "q-store-order-abc", seller: "Seller", status: "Received", note: "Thanks!", buyerPublicKey: "b", sellerPublicKey: "s" }).data64);
    expect(plain).toEqual({ status: "Received", note: "Thanks!" });
  });
});
