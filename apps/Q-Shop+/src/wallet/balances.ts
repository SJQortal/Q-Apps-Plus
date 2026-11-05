/**
 * The signed-in account's balances for the header (Simon, 2026-10-25: "how
 * much QORT the account has, and in drop down how much ARRR and Q-Assets"):
 *
 * - QORT and every Q-Asset in one read, `GET /assets/balances?address=…&excludeZero=true`
 *   (QORT is asset 0; balances come as decimal strings), 100 a page, two
 *   pages at most;
 * - ARRR from Hub (GET_WALLET_BALANCE), only when asked for: Hub asks the
 *   user first, and the ARRR wallet may take a while to sync.
 *
 * One store for the page: read when shown, again every 2 minutes while the
 * tab is visible (none while hidden), and when the menu opens or someone pays.
 */
import { useEffect, useSyncExternalStore } from "react";
import { readStoredSettings, writeStoredSettings } from "../utils/settingsStorage";

type Fetch = (url: string) => Promise<Response>;
const PAGE = 100;
const PAGES = 2;
export const BALANCE_REFRESH_MS = 2 * 60_000;

/** Balances by asset id (0: QORT). */
export type Balances = Map<number, number>;

export async function fetchBalances(address: string, get: Fetch = (url) => fetch(url)): Promise<Balances> {
  const out: Balances = new Map();
  for (let page = 0; page < PAGES; page++) {
    const res = await get(`/assets/balances?address=${encodeURIComponent(address)}&excludeZero=true&limit=${PAGE}&offset=${page * PAGE}`);
    if (!res.ok) throw new Error(`balances: ${res.status}`);
    const rows: unknown = await res.json();
    const list = Array.isArray(rows) ? rows : [];
    for (const row of list) {
      const r = row as { assetId?: unknown; balance?: unknown } | null;
      const id = Number(r?.assetId);
      const amount = typeof r?.balance === "string" || typeof r?.balance === "number" ? Number(r.balance) : NaN;
      if (Number.isSafeInteger(id) && id >= 0 && Number.isFinite(amount)) out.set(id, amount);
    }
    if (list.length < PAGE) break;
  }
  return out;
}

interface State {
  address: string;
  balances: Balances | null;
  status: "idle" | "loading" | "ready" | "failed";
  at: number;
  arrr: { status: "idle" | "loading" | "ready" | "failed"; amount?: number };
}

let state: State = { address: "", balances: null, status: "idle", at: 0, arrr: { status: "idle" } };
const listeners = new Set<() => void>();
const set = (next: Partial<State>) => {
  state = { ...state, ...next };
  for (const listener of [...listeners]) listener();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
let inflight: Promise<void> | null = null;

/** Reads the balances again (one read at a time). */
export function refreshBalances(address = state.address): Promise<void> {
  if (!address) return Promise.resolve();
  if (address !== state.address) set({ address, balances: null, status: "idle", at: 0, arrr: { status: "idle" } });
  if (inflight) return inflight;
  if (!state.balances) set({ status: "loading" });
  inflight = fetchBalances(address)
    .then(
      (balances) => {
        if (state.address === address) set({ balances, status: "ready", at: Date.now() });
      },
      () => {
        if (state.address === address) set({ status: state.balances ? "ready" : "failed" });
      }
    )
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** The ARRR balance from Hub (it asks the user first). */
export async function readArrrBalance(): Promise<void> {
  if (state.arrr.status === "loading") return;
  set({ arrr: { ...state.arrr, status: "loading" } });
  try {
    const amount = Number(await qortalRequest({ action: "GET_WALLET_BALANCE", coin: "ARRR" }));
    set({ arrr: Number.isFinite(amount) ? { status: "ready", amount } : { status: "failed" } });
  } catch {
    set({ arrr: { status: "failed" } });
  }
}

/** The balances, kept fresh while shown: read now, then every BALANCE_REFRESH_MS while the tab is visible. */
export function useBalances(address: string | undefined): State {
  const snapshot = useSyncExternalStore(subscribe, () => state);
  useEffect(() => {
    if (!address) return;
    void refreshBalances(address);
    let timer = 0;
    const schedule = () => {
      window.clearInterval(timer);
      if (document.visibilityState === "visible") timer = window.setInterval(() => void refreshBalances(address), BALANCE_REFRESH_MS);
    };
    const onVisible = () => {
      // Back on the tab: read again if it's been a while, then carry on.
      if (document.visibilityState === "visible" && Date.now() - state.at > BALANCE_REFRESH_MS / 2) void refreshBalances(address);
      schedule();
    };
    schedule();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [address]);
  return snapshot.address === address ? snapshot : { address: address ?? "", balances: null, status: "idle", at: 0, arrr: { status: "idle" } };
}

/** For tests. */
export function resetBalances(): void {
  state = { address: "", balances: null, status: "idle", at: 0, arrr: { status: "idle" } };
  inflight = null;
}

// ------------------------------------------------------------- the setting

let shown: boolean | null = null;
const settingListeners = new Set<() => void>();

/** Whether the header shows the balance (Settings; this device only). On unless switched off. */
export function getShowBalance(): boolean {
  if (shown === null) shown = readStoredSettings().showBalance !== false;
  return shown;
}

export function setShowBalance(show: boolean): void {
  shown = show;
  writeStoredSettings({ showBalance: show });
  for (const listener of [...settingListeners]) listener();
}

export function useShowBalance(): boolean {
  return useSyncExternalStore((listener) => {
    settingListeners.add(listener);
    return () => {
      settingListeners.delete(listener);
    };
  }, getShowBalance);
}

/** For tests. */
export function resetShowBalance(): void {
  shown = null;
}
