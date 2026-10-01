import { useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../state/store";
import { useAppSettings } from "../utils/settings";
import { checkNotifications } from "../utils/notifications/check";
import { readNotifications } from "../utils/notifications/store";
import { loadActivity } from "../utils/notifications/activity";
import { readHubAlerts, syncHubAlerts } from "../utils/notifications/hubAlerts";
import { onQdnSearchesInvalidated } from "../utils/qdnSearch";

/** Between checks while the app is on screen; doubled after each check that finds nothing. */
export const CHECK_INTERVAL_MS = 2 * 60_000;
export const MAX_CHECK_INTERVAL_MS = 15 * 60_000;
/** The first check waits for the first screen to settle. */
export const FIRST_CHECK_DELAY_MS = 4_000;
/** Opening the list checks again only when the last check is older than this. */
export const ON_DEMAND_MIN_AGE_MS = 30_000;

const CHECK_EVENT = "qshareplus:check-notifications";

/**
 * Whether the app is out of sight. Hub hides a background app tab with
 * `display: none`, which leaves `document.hidden` false inside the app's frame
 * but gives the frame no size; a minimised window or hidden GO sets
 * `document.hidden`.
 */
export function isAppHidden(): boolean {
  return document.hidden || window.innerWidth === 0 || window.innerHeight === 0;
}

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
 * when nothing turns up. Out of sight (another Hub tab, minimised, GO in the
 * background; see isAppHidden): no checks; coming back checks at once if the
 * last one is older than the interval. Mounted once, in GlobalWrapper.
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
      if (!stopped && !isAppHidden()) timer = setTimeout(run, Math.max(0, delay));
    };
    async function run() {
      if (stopped || isAppHidden()) return;
      try {
        const fresh = await checkNotifications(account!, options);
        interval = fresh > 0 ? CHECK_INTERVAL_MS : Math.min(interval * 2, MAX_CHECK_INTERVAL_MS);
      } catch {
        interval = Math.min(interval * 2, MAX_CHECK_INTERVAL_MS);
      }
      schedule(interval);
    }
    let wasHidden = isAppHidden();
    const onVisibility = () => {
      const hidden = isAppHidden();
      if (hidden === wasHidden) return; // a resize while on screen changes nothing
      wasHidden = hidden;
      if (hidden) clearTimeout(timer);
      else schedule(sinceLast() >= interval ? 0 : interval - sinceLast());
    };
    const onRequest = () => {
      interval = CHECK_INTERVAL_MS;
      if (sinceLast() >= ON_DEMAND_MIN_AGE_MS) schedule(0);
    };

    // A reload within the interval waits for the rest of it.
    schedule(Math.max(FIRST_CHECK_DELAY_MS, CHECK_INTERVAL_MS - sinceLast()));
    document.addEventListener("visibilitychange", onVisibility);
    // A Hub tab coming back into view gives the frame its size again.
    window.addEventListener("resize", onVisibility);
    window.addEventListener(CHECK_EVENT, onRequest);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onVisibility);
      window.removeEventListener(CHECK_EVENT, onRequest);
    };
  }, [account, comments, collections, hiddenKey]);
}

/** After a publish, wait this long before bringing Hub's alert rules up to date. */
export const HUB_SYNC_DELAY_MS = 10_000;

/**
 * Keeps Hub's alert rules in step with the account's shares and comments:
 * once after start and again after each publish (debounced). Sends nothing
 * unless alerts are on in Settings and the rules changed.
 */
export function useHubAlertsSync(): void {
  const account = useNotificationAccount();
  useEffect(() => {
    if (!account) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sync = () => {
      if (!readHubAlerts(account.address).enabled) return;
      loadActivity(account.names)
        .then((activity) => (stopped ? undefined : syncHubAlerts(account.address, activity)))
        .catch(() => {
          /* Hub or Core didn't answer: the next publish or start tries again */
        });
    };
    const later = (delay: number) => {
      clearTimeout(timer);
      timer = setTimeout(sync, delay);
    };
    later(HUB_SYNC_DELAY_MS);
    const unsubscribe = onQdnSearchesInvalidated(() => later(HUB_SYNC_DELAY_MS));
    return () => {
      stopped = true;
      clearTimeout(timer);
      unsubscribe();
    };
  }, [account]);
}
