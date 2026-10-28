/**
 * Opens a qortal:// link in a new Hub tab (Simon, 2026-10-26: shop
 * descriptions' links "also open in new tab"), with `OPEN_NEW_TAB` as Q-Mail+
 * and Torq do, instead of leaving the click to Core's q-apps.js, which reads
 * every link as SERVICE/name and can blank the app's frame on one it doesn't
 * know. Outside Hub, or when Hub refuses, the link is copied instead.
 */
import { copyText } from "../utils/clipboard";

export type OpenOutcome = "opened" | "copied" | "failed";

export async function openQortalLink(href: string): Promise<OpenOutcome> {
  // Hub reads spaces as %20, as its own Copy link writes them.
  const qortalLink = href.trim().replace(/ /g, "%20");
  try {
    if (typeof qortalRequest !== "function") throw new Error("Not in Hub");
    await qortalRequest({ action: "OPEN_NEW_TAB", qortalLink });
    return "opened";
  } catch {
    return (await copyText(qortalLink)) ? "copied" : "failed";
  }
}

/** What to tell the buyer when the link couldn't open. */
export function openNotice(outcome: OpenOutcome, href: string): { msg: string; alertType: "success" | "error" } | null {
  if (outcome === "copied") return { msg: "Hub couldn't open the link here, so it's copied: paste it in Hub's address bar.", alertType: "success" };
  if (outcome === "failed") return { msg: `Hub couldn't open the link, and copying failed. It is ${href}`, alertType: "error" };
  return null;
}
