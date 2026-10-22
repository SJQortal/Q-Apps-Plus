/**
 * Which coin a shop's prices show in and are paid in, and its rate:
 * the buyer's preferred coin (Settings, or the last one picked) when the shop
 * takes it, otherwise QORT — as the original did for ARRR. The rate comes
 * from the shared cache (money/rates.ts); while it loads, converted prices
 * show "—". If the node can't give a rate the coin falls back to QORT with a
 * message, as the original did ("Cannot get exchange rate").
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../state/store";
import { setPreferredCoin } from "../state/features/storeSlice";
import { setNotification } from "../state/features/notificationsSlice";
import { isForeignTicker, shopCoins, type CoinId, type ShopCoinSettings } from "./coins";
import { cachedRate, getRate } from "./rates";

/**
 * Every price on screen uses this hook, so a failed rate would raise the same
 * message once per price: say it once per coin per minute.
 */
const lastRateNotice = new Map<string, number>();
const RATE_NOTICE_GAP_MS = 60_000;

function shouldNotify(coin: string): boolean {
  const last = lastRateNotice.get(coin) ?? 0;
  if (Date.now() - last < RATE_NOTICE_GAP_MS) return false;
  lastRateNotice.set(coin, Date.now());
  return true;
}

/** For tests. */
export function resetRateNotices(): void {
  lastRateNotice.clear();
}

export interface ShopCoin {
  /** Coins this shop takes, QORT first. */
  coins: CoinId[];
  /** The coin prices show in and checkout pays in. */
  coin: string;
  /** Foreign coin per QORT for `coin`; null for QORT, assets, or while loading. */
  rate: number | null;
  rateLoading: boolean;
  setCoin: (coin: string) => void;
}

export function useShopCoin(shop: ShopCoinSettings | null | undefined): ShopCoin {
  const dispatch = useDispatch();
  const preferred = useSelector((state: RootState) => state.store.preferredCoin);
  const coins = useMemo(() => shopCoins(shop), [shop]);
  const coin = (coins as string[]).includes(preferred) ? preferred : "QORT";
  const needsRate = isForeignTicker(coin);
  const [rateState, setRateState] = useState<{ coin: string; rate: number | null }>(() => ({
    coin,
    rate: needsRate ? cachedRate(coin) : null,
  }));
  const rate = rateState.coin === coin ? rateState.rate : needsRate ? cachedRate(coin) : null;

  useEffect(() => {
    if (!needsRate) return;
    let alive = true;
    getRate(coin).then(
      (value) => {
        if (alive) setRateState({ coin, rate: value });
      },
      () => {
        if (!alive) return;
        dispatch(setPreferredCoin("QORT"));
        if (shouldNotify(coin)) {
          dispatch(setNotification({ alertType: "error", msg: `Cannot get the ${coin} exchange rate from your node; showing QORT` }));
        }
      }
    );
    return () => {
      alive = false;
    };
  }, [coin, needsRate, dispatch]);

  const setCoin = useCallback((next: string) => dispatch(setPreferredCoin(next)), [dispatch]);
  return { coins, coin, rate: needsRate ? rate : null, rateLoading: needsRate && rate === null, setCoin };
}
