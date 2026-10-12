/**
 * First-run tips: three small popovers anchored to the real controls
 * (Compose, the mailboxes, Aliases) instead of react-joyride (UX #25,
 * Bugs #10). Seen once per browser: localStorage `tourStatus-qmail`
 * (the same key the original app used) is set when the tips finish or
 * are skipped. The disclaimer lives in ConsentModal only, and the tips
 * wait until it has been shown and closed: both are first-run, and the
 * first tip used to open on top of the welcome dialog in Hub.
 *
 * A tip anchors only to a control that is in the layout (a non-empty
 * box): at first load in Hub the rail is still settling, and anchoring to
 * an element with no box made MUI warn "anchorEl prop … invalid" four
 * times. The tip waits for the control (re-checked every 100 ms) and,
 * after 1.5 s without one, shows centred near the top instead.
 */
import { useEffect, useLayoutEffect, useState } from "react";
import { Box, Button, Popover, Typography } from "@mui/material";
import { useLayoutMode } from "../../layout/useLayoutMode";
import { hasConsented } from "../../components/modals/ConsentModal";

/** The id ConsentModal gives its text (ResponsiveDialog `describedBy`): present while the dialog is open. */
export const CONSENT_DESCRIPTION_ID = "qmail-consent-description";

export function isConsentDialogOpen(root: ParentNode = document): boolean {
  return Boolean(root.querySelector(`#${CONSENT_DESCRIPTION_ID}`));
}

/**
 * True once the consent flag is set and the welcome dialog is gone. The
 * flag is written when the dialog opens, so the DOM is watched too.
 */
export function useConsentSettled(): boolean {
  const [settled, setSettled] = useState(() => hasConsented() && !isConsentDialogOpen());
  useEffect(() => {
    if (settled) return;
    const check = () => {
      if (hasConsented() && !isConsentDialogOpen()) setSettled(true);
    };
    check();
    if (typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [settled]);
  return settled;
}

export const TOUR_STATUS_STORAGE_KEY = "tourStatus-qmail";
export const TOUR_STATUS_DISMISSED = "dismissed";

export interface TourStep {
  id: string;
  title: string;
  body: string;
  /** Anchor candidates in order; the first element found wins. */
  selectors: string[];
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "compose",
    title: "Write a message",
    body:
      "Compose a message with encrypted attachments (up to 40 MB each). Only the recipient can read it.",
    selectors: [
      "[data-qapp-lib-sidebar-item='compose']",
      "[data-qmail-tour='compose']",
      "[aria-label='Open mailboxes menu']",
    ],
  },
  {
    id: "mailboxes",
    title: "Your mailboxes",
    body:
      "Switch between your inbox, each name you own, Sent, Drafts and the threads of groups you have joined.",
    selectors: [
      "[data-qapp-lib-sidebar-item='inbox']",
      "nav[aria-label='Mailboxes'] [aria-label='Inbox']",
      "[aria-label='Open mailboxes menu']",
    ],
  },
  {
    id: "aliases",
    title: "Aliases keep recipients private",
    body:
      "Ask people to write to an alias, such as FrederickGreat, and watch that alias here to read what arrives.",
    selectors: [
      "[data-qapp-lib-sidebar-item='aliases']",
      "nav[aria-label='Mailboxes'] [aria-label='Aliases']",
      "[aria-label='Open mailboxes menu']",
    ],
  },
];

/** How long a tip waits for its control to be laid out before it shows unanchored. */
export const TOUR_ANCHOR_WAIT_MS = 1500;
export const TOUR_ANCHOR_RETRY_MS = 100;

/** True when the element is in the document and has a box (MUI's own anchor check). */
export function isInLayout(element: Element | null | undefined): element is HTMLElement {
  if (!element || !element.isConnected) return false;
  const box = element.getBoundingClientRect();
  return !(box.top === 0 && box.left === 0 && box.right === 0 && box.bottom === 0);
}

export function findTourAnchor(
  step: TourStep,
  root: ParentNode = document,
  options: { requireLayout?: boolean } = {}
): HTMLElement | null {
  for (const selector of step.selectors) {
    const elements = root.querySelectorAll<HTMLElement>(selector);
    for (const element of Array.from(elements)) {
      if (!options.requireLayout || isInLayout(element)) return element;
    }
  }
  return null;
}

interface MailTourProps {
  run: boolean;
  onDone: () => void;
}

export function MailTour({ run, onDone }: MailTourProps) {
  const isPhone = useLayoutMode() === "phone";
  const [index, setIndex] = useState(0);
  // null while the tip waits for its control; anchor null = show unanchored.
  const [placement, setPlacement] = useState<{ stepId: string; anchor: HTMLElement | null } | null>(null);
  const anchor = placement?.anchor ?? null;
  const settled = useConsentSettled();
  const active = run && settled;
  const step = TOUR_STEPS[index];
  const isLast = index === TOUR_STEPS.length - 1;

  // Find a laid-out anchor (the rail or the bottom nav), waiting briefly for
  // the layout to settle; the previous tip stays put meanwhile.
  useLayoutEffect(() => {
    if (!active || !step) {
      setPlacement(null);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let waited = 0;
    const attempt = () => {
      if (cancelled) return;
      const element = findTourAnchor(step, document, { requireLayout: true });
      if (element || waited >= TOUR_ANCHOR_WAIT_MS) {
        setPlacement({ stepId: step.id, anchor: element });
        return;
      }
      waited += TOUR_ANCHOR_RETRY_MS;
      timer = setTimeout(attempt, TOUR_ANCHOR_RETRY_MS);
    };
    attempt();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [active, step]);

  useEffect(() => {
    if (active) setIndex(0);
  }, [active]);

  if (!active || !step || !placement) return null;
  // A control that left the layout since (a resize swapped the rail for the
  // bottom bar) is not handed to MUI either.
  const liveAnchor = isInLayout(anchor) ? anchor : null;

  const finish = () => {
    setIndex(0);
    onDone();
    // The tip opened on first load, with nothing focused before it: put focus
    // on what it pointed at, so keyboard and screen-reader users keep a place.
    const target = anchor;
    window.requestAnimationFrame(() => {
      if (target?.isConnected) target.focus();
    });
  };

  return (
    <Popover
      open
      anchorEl={liveAnchor ?? undefined}
      anchorReference={liveAnchor ? "anchorEl" : "anchorPosition"}
      anchorPosition={liveAnchor ? undefined : { top: 96, left: Math.round((window.innerWidth || 360) / 2) }}
      anchorOrigin={
        isPhone ? { vertical: "top", horizontal: "center" } : { vertical: "center", horizontal: "right" }
      }
      transformOrigin={
        isPhone ? { vertical: "bottom", horizontal: "center" } : { vertical: "center", horizontal: "left" }
      }
      onClose={finish}
      disableRestoreFocus
      slotProps={{
        paper: {
          sx: { maxWidth: 320, m: 1, p: 2, display: "flex", flexDirection: "column", gap: 1 },
          "data-qmail-tour-step": step.id,
          // The Popover root is role=presentation; the tip itself is the dialog.
          role: "dialog",
          "aria-labelledby": "qmail-tour-title",
          "aria-describedby": "qmail-tour-progress qmail-tour-body",
        } as any,
      }}
    >
      <Typography id="qmail-tour-progress" variant="caption" color="text.secondary">
        Tip {index + 1} of {TOUR_STEPS.length}
      </Typography>
      <Typography id="qmail-tour-title" sx={{ fontWeight: 700, fontSize: "1.05rem" }}>
        {step.title}
      </Typography>
      <Typography id="qmail-tour-body" variant="body2">{step.body}</Typography>
      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 0.5 }}>
        {!isLast && (
          <Button variant="text" color="inherit" onClick={finish} sx={{ minHeight: 44 }}>
            Skip
          </Button>
        )}
        <Button
          variant="contained"
          autoFocus
          onClick={() => (isLast ? finish() : setIndex(index + 1))}
          sx={{ minHeight: 44, minWidth: 88 }}
        >
          {isLast ? "Done" : "Next"}
        </Button>
      </Box>
    </Popover>
  );
}
