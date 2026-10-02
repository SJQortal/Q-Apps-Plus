/**
 * First-run tips: three small popovers anchored to the real controls
 * (Compose, the mailboxes, Aliases) instead of react-joyride (UX #25,
 * Bugs #10). Seen once per browser: localStorage `tourStatus-qmail`
 * (the same key the original app used) is set when the tips finish or
 * are skipped. The disclaimer lives in ConsentModal only, and the tips
 * wait until it has been shown and closed: both are first-run, and the
 * first tip used to open on top of the welcome dialog in Hub.
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

export function findTourAnchor(step: TourStep, root: ParentNode = document): HTMLElement | null {
  for (const selector of step.selectors) {
    const element = root.querySelector<HTMLElement>(selector);
    if (element) return element;
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
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const settled = useConsentSettled();
  const active = run && settled;
  const step = TOUR_STEPS[index];
  const isLast = index === TOUR_STEPS.length - 1;

  // Find the anchor after the layout settled (the rail or the bottom nav).
  useLayoutEffect(() => {
    if (!active) return;
    setAnchor(findTourAnchor(step));
  }, [active, step]);

  useEffect(() => {
    if (active) setIndex(0);
  }, [active]);

  if (!active || !step) return null;

  const finish = () => {
    setIndex(0);
    onDone();
  };

  return (
    <Popover
      open
      anchorEl={anchor ?? undefined}
      anchorReference={anchor ? "anchorEl" : "anchorPosition"}
      anchorPosition={anchor ? undefined : { top: 96, left: Math.round((window.innerWidth || 360) / 2) }}
      anchorOrigin={
        isPhone ? { vertical: "top", horizontal: "center" } : { vertical: "center", horizontal: "right" }
      }
      transformOrigin={
        isPhone ? { vertical: "bottom", horizontal: "center" } : { vertical: "center", horizontal: "left" }
      }
      onClose={finish}
      disableRestoreFocus
      aria-labelledby="qmail-tour-title"
      slotProps={{
        paper: {
          sx: { maxWidth: 320, m: 1, p: 2, display: "flex", flexDirection: "column", gap: 1 },
          "data-qmail-tour-step": step.id,
        } as any,
      }}
    >
      <Typography variant="caption" color="text.secondary">
        Tip {index + 1} of {TOUR_STEPS.length}
      </Typography>
      <Typography id="qmail-tour-title" sx={{ fontWeight: 700, fontSize: "1.05rem" }}>
        {step.title}
      </Typography>
      <Typography variant="body2">{step.body}</Typography>
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
