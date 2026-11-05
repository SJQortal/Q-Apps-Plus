import { useCallback, useEffect, useRef, useState } from "react";

/**
 * After a miss, how long to wait before asking again (Core is fetching or
 * building the image meanwhile), in ms; then the fallback stays.
 */
export const QDN_IMAGE_RETRY_MS = [4_000, 15_000];

/**
 * A QDN image's URL with `async=true`: Core serves an image it has at once
 * and answers 404 at once for one it hasn't, fetching it in the background.
 * Without it, a GET of an image the node lacks holds a node thread for about
 * 15 s and then 404s. `attempt` makes each retry a new request.
 */
export function asyncImageUrl(url: string, attempt = 0): string {
  if (!url.startsWith("/arbitrary/")) return url;
  const join = url.includes("?") ? "&" : "?";
  return `${url}${join}async=true${attempt > 0 ? `&retry=${attempt}` : ""}`;
}

interface Tries {
  url: string | null;
  attempt: number;
  waiting: boolean;
  gaveUp: boolean;
}

/**
 * The `src` for a QDN image (or a local `blob:` preview, passed through),
 * asked for without holding the node, and asked again a little later while
 * the node fetches it. `src` is null while waiting or once given up, so the
 * caller shows its fallback.
 */
export function useQdnImage(url: string | null): { src: string | null; onError: () => void } {
  const [tries, setTries] = useState<Tries>({ url, attempt: 0, waiting: false, gaveUp: false });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = tries.url === url ? tries : { url, attempt: 0, waiting: false, gaveUp: false };
  const { attempt } = current;
  const local = url !== null && !url.startsWith("/arbitrary/");

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [url]
  );

  const onError = useCallback(() => {
    if (!url) return;
    if (local || attempt >= QDN_IMAGE_RETRY_MS.length) {
      setTries({ url, attempt, waiting: false, gaveUp: true });
      return;
    }
    setTries({ url, attempt, waiting: true, gaveUp: false });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(
      () => setTries({ url, attempt: attempt + 1, waiting: false, gaveUp: false }),
      QDN_IMAGE_RETRY_MS[attempt]
    );
  }, [url, local, attempt]);

  const src = url && !current.waiting && !current.gaveUp ? asyncImageUrl(url, attempt) : null;
  return { src, onError };
}
