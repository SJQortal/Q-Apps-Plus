/**
 * Plain text whose qortal:// addresses are links that open in a new Hub tab
 * (qdn/openQortalLink.ts), for a shop's description (Simon, 2026-10-26). A
 * full stop or bracket after an address isn't part of it (sanitize.ts
 * QORTAL_URL).
 */
import { useCallback, type MouseEvent } from "react";
import { useDispatch } from "react-redux";
import { Link } from "@mui/material";
import { setNotification } from "../state/features/notificationsSlice";
import { openNotice, openQortalLink } from "../qdn/openQortalLink";
import { QORTAL_URL } from "./sanitize";

/** A click handler for a qortal:// link: opens it in a new tab, or copies it and says so. */
export function useOpenQortalLink(): (event: MouseEvent, href: string) => void {
  const dispatch = useDispatch();
  return useCallback(
    (event, href) => {
      event.preventDefault();
      void openQortalLink(href).then((outcome) => {
        const notice = openNotice(outcome, href);
        if (notice) dispatch(setNotification(notice));
      });
    },
    [dispatch]
  );
}

export function QortalText({ text }: { text: string }) {
  const open = useOpenQortalLink();
  const parts: (string | { href: string })[] = [];
  let at = 0;
  for (const match of text.matchAll(QORTAL_URL)) {
    const start = match.index ?? 0;
    if (start > at) parts.push(text.slice(at, start));
    parts.push({ href: match[0] });
    at = start + match[0].length;
  }
  if (at < text.length) parts.push(text.slice(at));
  return (
    <>
      {parts.map((part, i) =>
        typeof part === "string" ? (
          part
        ) : (
          <Link key={i} href={part.href} title="Opens in a new tab" onClick={(event) => open(event, part.href)} sx={{ wordBreak: "break-all" }}>
            {part.href}
          </Link>
        )
      )}
    </>
  );
}
