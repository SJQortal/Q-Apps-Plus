import { useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../state/store";
import { useAppSettings } from "../utils/settings";
import { checkNotifications } from "../utils/notifications/check";
import { readNotifications } from "../utils/notifications/store";

/** Between checks while the app is on screen; doubled after each check that finds nothing. */
export const CHECK_INTERVAL_MS = 2 * 60_000;
export const MAX_CHECK_INTERVAL_MS = 15 * 60_000;
/** The first check waits for the first screen to settle. */
export const FIRST_CHECK_DELAY_MS = 4_000;
/** Opening the list checks again only when the last check is older than this. */
export const ON_DEMAND_MIN_AGE_MS = 30_000;

const CHECK_EVENT = "qshareplus:check-notifications";

/** Ask for a check now (opening the notification list), unless one ran in the last 30 s. */
export function requestNotificationCheck(): void {
  window.dispatchEvent(new CustomEvent(CHECK_EVENT));
}

/** The signed-in account's address and every name it owns, or null. */
export function useNotificationAccount(): { address: string; names: string[] } | null {
  const user = useSelector((state: RootState) => state.auth.user);
  const address = user?.address;
  const namesKey = [...new Set([user?.name, ...(user?.names ?? []).map((n) => n.name)].filter(Boolean))].join("\n");
  return useMemo(() => (address && namesKey ? { address, names: namesKey.split("\n") } : null), [address, namesKey]);
}

/**
 * Runs notification checks for the signed-in account while the app is on
 * screen: after the first screen, then every 2 minutes, backing off to 15
 * when nothing turns up. Hidden (another Hub tab, minimised, GO in the
 * background): no checks; coming back checks at once if the last one is
 * older than the interval. Mounted once, in GlobalWrapper.
 */
export function useNotificationChecks(): void {
  const account = useNotificationAccount();
  const settings = useAppSettings();
  const { notifyComments: comments, notifyCollections: collections } = settings;
  const hiddenKey = settings.hiddenNames.join("\n");

  useEffect(() => {
    if (!account || (!comments && !collections)) return;
    const options = { comments, collections, hiddenNames: hiddenKey ? hiddenKey.split("\n") : [] };
    let interval = CHECK_INTERVAL_MS;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const sinceLast = () => Date.now() - readNotifications(account.address).lastCheck;

    const schedule = (delay: number) => {
      clearTimeout(timer);
      if (!stopped && !document.hidden) timer = setTimeout(run, Math.max(0, delay));
    };
    async function run() {
      if (stopped || document.hidden) return;
      try {
        const fresh = await checkNotifications(account!, options);
        interval = fresh > 0 ? CHECK_INTERVAL_MS : Math.min(interval * 2, MAX_CHECK_INTERVAL_MS);
      } catch {
        interval = Math.min(interval * 2, MAX_CHECK_INTERVAL_MS);
      }
      schedule(interval);
    }
    const onVisibility = () => {
      if (document.hidden) clearTimeout(timer);
      else schedule(sinceLast() >= interval ? 0 : interval - sinceLast());
    };
    const onRequest = () => {
      interval = CHECK_INTERVAL_MS;
      if (sinceLast() >= ON_DEMAND_MIN_AGE_MS) schedule(0);
    };

    // A reload within the interval waits for the rest of it.
    schedule(Math.max(FIRST_CHECK_DELAY_MS, CHECK_INTERVAL_MS - sinceLast()));
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(CHECK_EVENT, onRequest);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(CHECK_EVENT, onRequest);
    };
  }, [account, comments, collections, hiddenKey]);
}
