/**
 * Selling, taking off and buying names on chain, exactly as the Names app
 * asks Hub (apps/Names+/src/components/Tables): SELL_NAME {nameForSale,
 * salePrice}, CANCEL_SELL_NAME {nameForSale}, BUY_NAME {nameForSale}. Hub
 * shows the fee and asks the seller or buyer to confirm; a decline is quiet.
 *
 * A transaction counts from the next block, so each one is kept as pending
 * (for this session) and the name is read again every 15 s, while the page
 * shows, until Core has it as asked: listed at the price, taken off, or the
 * buyer's. After 15 minutes it stops waiting and lists read afresh.
 */
import { useEffect, useSyncExternalStore } from "react";
import { errorMessage, isHubDecline } from "../qdn/hubErrors";
import { fetchNameState, forgetNamesForSale, type NameState } from "./market";

export type NameTx = "sell" | "cancel" | "buy";
export interface PendingName {
  name: string;
  kind: NameTx;
  /** A sale's price. */
  price?: number;
  /** The address it goes to (a purchase). */
  buyer?: string;
  at: number;
}

export const PENDING_POLL_MS = 15_000;
export const PENDING_GIVE_UP_MS = 15 * 60_000;

let pending = new Map<string, PendingName>();
const listeners = new Set<() => void>();

function emit(next: Map<string, PendingName>): void {
  pending = next;
  for (const listener of [...listeners]) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function pendingNames(): Map<string, PendingName> {
  return pending;
}

function markPending(entry: PendingName): void {
  emit(new Map(pending).set(entry.name, entry));
  forgetNamesForSale();
}

function settle(name: string): void {
  if (!pending.has(name)) return;
  const next = new Map(pending);
  next.delete(name);
  emit(next);
  forgetNamesForSale();
}

/** Whether Core now has the name as the pending transaction asked. */
export function isSettled(entry: PendingName, state: NameState | null): boolean {
  if (!state) return false;
  if (entry.kind === "sell") return state.forSale && state.price !== null && Math.abs(state.price - (entry.price ?? 0)) < 1e-8;
  if (entry.kind === "cancel") return !state.forSale;
  return !!entry.buyer && state.owner === entry.buyer;
}

export type NameTxResult = { kind: "sent" } | { kind: "declined" } | { kind: "failed"; message: string };

async function send(request: Record<string, unknown>, entry: Omit<PendingName, "at">): Promise<NameTxResult> {
  try {
    const answer = await qortalRequest(request as never);
    if (answer && typeof answer === "object" && (answer as { error?: unknown }).error) throw answer;
    markPending({ ...entry, at: Date.now() });
    return { kind: "sent" };
  } catch (error) {
    if (isHubDecline(error)) return { kind: "declined" };
    return { kind: "failed", message: errorMessage(error, "Hub couldn't send it. Try again.") };
  }
}

export function sellName(name: string, price: number): Promise<NameTxResult> {
  return send({ action: "SELL_NAME", nameForSale: name, salePrice: price }, { name, kind: "sell", price });
}

export function cancelNameSale(name: string): Promise<NameTxResult> {
  return send({ action: "CANCEL_SELL_NAME", nameForSale: name }, { name, kind: "cancel" });
}

export function buyName(name: string, buyerAddress: string): Promise<NameTxResult> {
  return send({ action: "BUY_NAME", nameForSale: name }, { name, kind: "buy", buyer: buyerAddress });
}

/** The pending transactions, read again every 15 s while the page shows, until each has settled. */
export function usePendingNames(onSettled?: () => void): Map<string, PendingName> {
  const current = useSyncExternalStore(subscribe, pendingNames);
  useEffect(() => {
    if (current.size === 0) return;
    let alive = true;
    const check = async () => {
      if (document.visibilityState === "hidden") return;
      let changed = false;
      for (const entry of [...pendingNames().values()]) {
        if (Date.now() - entry.at > PENDING_GIVE_UP_MS) {
          settle(entry.name);
          changed = true;
          continue;
        }
        const state = await fetchNameState(entry.name);
        if (alive && isSettled(entry, state)) {
          settle(entry.name);
          changed = true;
        }
      }
      if (alive && changed) onSettled?.();
    };
    const timer = window.setInterval(() => void check(), PENDING_POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [current, onSettled]);
  return current;
}

/** For tests. */
export function resetPendingNames(): void {
  emit(new Map());
}
