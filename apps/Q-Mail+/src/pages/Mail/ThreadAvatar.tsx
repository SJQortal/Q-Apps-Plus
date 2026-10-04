import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Avatar } from "@mui/material";
import { RootState } from "../../state/store";
import { setUserAvatarHash } from "../../state/features/globalSlice";
import { firstVisibleChar } from "../../utils/invisibleCharacters";

const attempted = new Set<string>();
const inFlight = new Map<string, Promise<string>>();

/** `GET_QDN_RESOURCE_URL` for a name's `qortal_avatar`, once per name per session. */
export async function fetchAvatarUrl(name: string): Promise<string> {
  const running = inFlight.get(name);
  if (running) return running;
  const request = (async () => {
    try {
      const url = await qortalRequest({
        action: "GET_QDN_RESOURCE_URL",
        name,
        service: "THUMBNAIL",
        identifier: "qortal_avatar",
      });
      return typeof url === "string" && url && url !== "Resource does not exist" ? url : "";
    } catch {
      return "";
    } finally {
      attempted.add(name);
    }
  })();
  inFlight.set(name, request);
  try {
    return await request;
  } finally {
    inFlight.delete(name);
  }
}

export function resetAvatarAttempts(): void {
  attempted.clear();
  inFlight.clear();
}

interface ThreadAvatarProps {
  name?: string;
  size?: number;
}

/**
 * A member's avatar, fetched lazily: the URL is looked up only once the
 * avatar scrolls into view, once per name per session, and kept in the
 * shared `userAvatarHash` so every list reuses it (docs/QORTAL.md rule 6).
 */
export function ThreadAvatar({ name, size = 40 }: ThreadAvatarProps) {
  const dispatch = useDispatch();
  const cachedUrl = useSelector((state: RootState) => (name ? state.global.userAvatarHash?.[name] : undefined));
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || inView) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [inView]);

  useEffect(() => {
    if (!inView || !name || cachedUrl || attempted.has(name)) return;
    let cancelled = false;
    void fetchAvatarUrl(name).then((url) => {
      if (!cancelled && url) dispatch(setUserAvatarHash({ name, url }));
    });
    return () => {
      cancelled = true;
    };
  }, [cachedUrl, dispatch, inView, name]);

  const src = cachedUrl && cachedUrl !== "Resource does not exist" ? cachedUrl : undefined;
  return (
    <Avatar
      ref={ref}
      src={src}
      alt={name || ""}
      sx={(theme) => ({
        width: size,
        height: size,
        fontSize: size * 0.42,
        fontWeight: 700,
        bgcolor: theme.qplus.primarySoft,
        color: theme.palette.primary.main,
        flexShrink: 0,
      })}
    >
      {(firstVisibleChar(name) || "?").toUpperCase()}
    </Avatar>
  );
}
