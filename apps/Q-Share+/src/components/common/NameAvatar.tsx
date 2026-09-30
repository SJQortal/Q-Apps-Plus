import { useReducer } from "react";
import { Avatar } from "@mui/material";
import { useInView } from "react-intersection-observer";
import { primarySoft } from "../../hub-theme";
import { avatarUrl } from "../../utils/qortalLinks";

/**
 * What each avatar URL did this session. Most names have no avatar, and a
 * 404 is not cached, so a name known to have none shows its letter on every
 * later open without asking again. One that loaded shows at once (from the
 * browser's image cache) instead of waiting to scroll into view.
 */
const avatarResults = new Map<string, "loaded" | "missing">();

const AVATAR_IMG_STYLE = { width: "100%", height: "100%", objectFit: "cover" } as const;

/**
 * A name's avatar (its `qortal_avatar` thumbnail), or the name's first letter
 * when it has none. Hidden from screen readers: the name beside it says it.
 *
 * A plain <img>, not Avatar's `src`: MUI preloads every `src` with
 * `new Image()` as soon as the Avatar mounts, whatever `loading` says, so
 * opening the menu asked for every name's avatar at once. A menu row asks
 * only once it scrolls into the menu's view; `eager` is for the header's own.
 */
export function NameAvatar({
  name,
  src,
  size,
  eager = false,
}: {
  name: string;
  src?: string;
  size: number;
  eager?: boolean;
}) {
  const url = src || avatarUrl(name);
  const known = avatarResults.get(url);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const { ref, inView } = useInView({ triggerOnce: true, skip: eager || known !== undefined });
  const settle = (result: "loaded" | "missing") => {
    if (avatarResults.get(url) === result) return;
    avatarResults.set(url, result);
    rerender();
  };
  const requested = known === "loaded" || (known === undefined && (eager || inView));

  return (
    <Avatar
      ref={ref}
      aria-hidden
      sx={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.45),
        fontWeight: 700,
        // The tint holds the spot until the image is in, and backs the letter.
        bgcolor: known === "loaded" ? "transparent" : primarySoft,
        color: "primary.main",
      }}
    >
      {requested ? (
        <img
          src={url}
          alt=""
          onLoad={() => settle("loaded")}
          onError={() => settle("missing")}
          style={AVATAR_IMG_STYLE}
        />
      ) : (
        // Always a child, even while it waits: without one MUI draws its generic person icon.
        <span>{known === "missing" ? Array.from(name)[0]?.toUpperCase() : null}</span>
      )}
    </Avatar>
  );
}
