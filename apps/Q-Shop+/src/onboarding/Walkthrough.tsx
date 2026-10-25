/**
 * The walkthrough (onboarding/tours.tsx): a few steps, each a picture, a line
 * and a few points, with Back, Next and Skip, full screen on phones. Welcome
 * opens by itself on someone's first visit, after the original's notice
 * (components/modals/ConsentModal.tsx), and the seller guide the first time
 * their own shop's page is ready; both open again from Settings, and the
 * seller guide from the shop checkup. One store opens it from anywhere.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import { Box, Button, Typography } from "@mui/material";
import { ResponsiveDialog } from "../components/common/mobile";
import { useSell, useSellLabel } from "../components/layout/shellState";
import { primarySoft } from "../hub-theme";
import { TOURS, type TourId } from "./tours";

/** The walkthrough version someone has seen: a new version (new features) shows again. */
export const WALKTHROUGH_KEY = "qshopplus-walkthrough";
export const WALKTHROUGH_VERSION = "1";

let open: TourId | null = null;
let suppressed = false;
const listeners = new Set<() => void>();
const emit = () => {
  for (const listener of [...listeners]) listener();
};

/** Opens a tour from anywhere (Settings, Manage Shop). */
export function openWalkthrough(tour: TourId): void {
  open = tour;
  emit();
}

function close(): void {
  open = null;
  emit();
}

function seen(): boolean {
  try {
    return localStorage.getItem(WALKTHROUGH_KEY) === WALKTHROUGH_VERSION;
  } catch {
    return true;
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(WALKTHROUGH_KEY, WALKTHROUGH_VERSION);
  } catch {
    // Private windows: it shows again next time.
  }
}

/** The seller guide opens by itself once, the first time someone's own shop page is ready. */
export const SELLER_GUIDE_KEY = "qshopplus-seller-guide";

export function useSellerGuideOnce(ready: boolean): void {
  useEffect(() => {
    if (!ready || suppressed || open !== null) return;
    try {
      if (localStorage.getItem(SELLER_GUIDE_KEY) === WALKTHROUGH_VERSION) return;
      localStorage.setItem(SELLER_GUIDE_KEY, WALKTHROUGH_VERSION);
    } catch {
      // Nowhere to remember it: better never than on every visit.
      return;
    }
    openWalkthrough("seller");
  }, [ready]);
}

/** Tests: the first-run tours don't open by themselves (their own tests turn them back on). */
export function suppressFirstRunForTests(on: boolean): void {
  suppressed = on;
}

/**
 * The walkthrough's host: Welcome on a first visit once `ready` (the
 * original's notice has been answered), and whichever tour is opened.
 */
export function WalkthroughHost({ ready }: { ready: boolean }) {
  const current = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => open
  );
  useEffect(() => {
    if (ready && !suppressed && !seen() && open === null) openWalkthrough("welcome");
  }, [ready]);
  if (!current) return null;
  return (
    <Walkthrough
      key={current}
      tour={current}
      onClose={() => {
        if (current === "welcome") markSeen();
        close();
      }}
    />
  );
}

export function Walkthrough({ tour, onClose }: { tour: TourId; onClose: () => void }) {
  // Manage Shop, or Create Shop for a name without one (Sign in when signed out).
  const sell = useSell();
  const sellLabel = useSellLabel();
  const { title, steps } = TOURS[tour];
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const last = index === steps.length - 1;

  return (
    <ResponsiveDialog
      open
      onClose={onClose}
      title={title}
      maxWidth="sm"
      actions={
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%", flexWrap: "wrap" }}>
          {!last && (
            <Button color="inherit" onClick={onClose} sx={{ mr: "auto" }}>
              Skip
            </Button>
          )}
          {last && tour === "welcome" && (
            <Button
              color="inherit"
              onClick={() => {
                onClose();
                sell();
              }}
              sx={{ mr: "auto" }}
            >
              {sellLabel}
            </Button>
          )}
          {index > 0 && (
            <Button color="inherit" onClick={() => setIndex((i) => i - 1)}>
              Back
            </Button>
          )}
          <Button variant="contained" onClick={() => (last ? onClose() : setIndex((i) => i + 1))} sx={{ minWidth: 120 }}>
            {last ? (tour === "welcome" ? "Start" : "Done") : "Next"}
          </Button>
        </Box>
      }
    >
      <Box component="section" aria-roledescription="slide" aria-label={`${index + 1} of ${steps.length}: ${step.title}`} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box
            aria-hidden
            sx={{ width: 56, height: 56, borderRadius: "50%", display: "grid", placeItems: "center", bgcolor: primarySoft, color: "primary.main", flexShrink: 0, "& svg": { fontSize: 30 } }}
          >
            {step.icon}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography component="h2" sx={{ fontWeight: 700, fontSize: 20, lineHeight: 1.3 }}>
              {step.title}
            </Typography>
            {/* Sizes of its own: Classic's 23 px body text would outgrow the step's title. */}
            <Typography color="text.secondary" sx={{ fontSize: 16, lineHeight: 1.5 }}>
              {step.intro}
            </Typography>
          </Box>
        </Box>
        <Box component="ul" sx={{ m: 0, pl: 2.5, display: "flex", flexDirection: "column", gap: 1 }}>
          {step.points.map(([lead, rest]) => (
            <Typography component="li" key={lead} sx={{ fontSize: 16, lineHeight: 1.5 }}>
              <strong>{lead}</strong>: {rest}
            </Typography>
          ))}
        </Box>
        <Box role="group" aria-label="Steps" sx={{ display: "flex", justifyContent: "center", pt: 1 }}>
          {steps.map((s, i) => (
            <Box
              key={s.id}
              component="button"
              type="button"
              aria-label={`Step ${i + 1}: ${s.title}`}
              aria-current={i === index ? "step" : undefined}
              onClick={() => setIndex(i)}
              sx={{
                // A 44 px target around a small dot.
                width: 44,
                height: 44,
                p: 0,
                border: 0,
                background: "transparent",
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
                "&::after": { content: '""', width: i === index ? 20 : 8, height: 8, borderRadius: 4, bgcolor: i === index ? "primary.main" : "action.disabled", transition: "width 150ms ease" },
                "&:focus-visible": { outline: 2, outlineStyle: "solid", outlineColor: "primary.main", borderRadius: 1 },
              }}
            />
          ))}
        </Box>
      </Box>
    </ResponsiveDialog>
  );
}
