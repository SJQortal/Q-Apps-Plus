/**
 * Motion that follows the system's "reduce motion" setting: MUI's
 * transitions (Collapse and friends) don't, so components take their
 * timeouts from here and get 0 ms when less motion is asked for.
 */
import { useMediaQuery } from "@mui/material";

/** Folding a list open or shut (names in the mailboxes, a sender group, earlier messages). */
export const FOLD_MS = 200;

export function useReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)", { noSsr: true });
}

/** FOLD_MS, or 0 with reduced motion. */
export function useFoldTimeout(): number {
  return useReducedMotion() ? 0 : FOLD_MS;
}
