/**
 * Where the buyer gets things delivered, for what delivery costs before
 * checkout (ProductDelivery.tsx) and for "Ships to" filters: a country, and a
 * state in the United States, as the delivery form writes them ("Portugal",
 * "Oregon"). Picked on a product page; until then, the address the buyer kept
 * at checkout (pages/Cart/delivery.ts). On this device only: it's not in
 * Settings → Sync, and never published.
 */
import { useSyncExternalStore } from "react";
import { readStoredSettings, writeStoredSettings } from "../utils/settingsStorage";
import { SAVED_DELIVERY_EVENT, savedDelivery } from "../pages/Cart/delivery";
import { US, countryCode, countryName, stateCode, stateName } from "../constants/shipping";

export interface BuyerPlace {
  country: string;
  /** In the United States only ("" elsewhere, or when not picked). */
  state: string;
}

const listeners = new Set<() => void>();
let version = 0;

/** A place with a country the lists know, its names as the lists write them; else null. */
export function cleanPlace(raw: { country?: unknown; state?: unknown } | null | undefined): BuyerPlace | null {
  const code = typeof raw?.country === "string" ? countryCode(raw.country) : null;
  if (!code) return null;
  const state = code === US && typeof raw?.state === "string" ? stateCode(raw.state) : null;
  return { country: countryName(code), state: state ? stateName(state) : "" };
}

/** The place picked on this device, else the address `buyerName` kept at checkout, else null. */
export function buyerPlace(buyerName: string | undefined): BuyerPlace | null {
  return cleanPlace(readStoredSettings().deliverTo) ?? (buyerName ? cleanPlace(savedDelivery(buyerName)) : null);
}

function changed(): void {
  version++;
  for (const listener of [...listeners]) listener();
}

export function setBuyerPlace(place: BuyerPlace | null): void {
  writeStoredSettings({ deliverTo: place ?? undefined });
  changed();
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener(SAVED_DELIVERY_EVENT, changed);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener(SAVED_DELIVERY_EVENT, changed);
  };
}

/** The buyer's place (above), following changes made anywhere in the app. */
export function useBuyerPlace(buyerName: string | undefined): BuyerPlace | null {
  // The version changes on each pick; the place itself is read fresh from storage each time it does.
  const seen = useSyncExternalStore(subscribe, () => version);
  const key = `${seen}\n${buyerName ?? ""}`;
  return placeFor(key, buyerName);
}

let cache: { key: string; place: BuyerPlace | null } | null = null;
function placeFor(key: string, buyerName: string | undefined): BuyerPlace | null {
  if (cache?.key !== key) cache = { key, place: buyerPlace(buyerName) };
  return cache.place;
}

/** "Oregon, United States" or "Portugal". */
export function placeLabel(place: BuyerPlace): string {
  return place.state ? `${place.state}, ${place.country}` : place.country;
}
