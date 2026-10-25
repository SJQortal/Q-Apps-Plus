/**
 * The seller page's unpublished changes (seller/usePendingChanges.ts):
 *
 * - a Publish changes button in the warning colour, at the bottom right of
 *   the screen (above the phone's bottom bar) whenever anything waits, with
 *   what does under it (one kind: its publish starts; several: a list to
 *   publish or discard each). Simon: "only make the button orange, not the
 *   whole panel … to the right side";
 * - leaving the seller page with changes asks first: publish them, keep
 *   them as drafts (they're kept on this device), or discard them.
 */
import { useContext, useState } from "react";
import { UNSAFE_DataRouterContext, useBlocker } from "react-router-dom";
import { Box, Button, Typography } from "@mui/material";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import { ResponsiveDialog } from "../components/common/mobile";
import { useBottomChromeHeight } from "../components/layout/BottomNav/BottomNav";
import { takeLeaveWithoutAsking, type ChangeArea, type PendingChange } from "./usePendingChanges";

export const PUBLISH_BAR_SPACE = 84;

function ChangeList({ changes, onPublish, busy }: { changes: PendingChange[]; onPublish: (area: ChangeArea) => void; busy: boolean }) {
  return (
    <Box component="ul" aria-label="Unpublished changes" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 1 }}>
      {changes.map((c) => (
        <Box component="li" key={c.area} sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", p: 1.5, border: 1, borderColor: "divider", borderRadius: 1.5 }}>
          <Typography sx={{ flex: "1 1 160px", fontWeight: 600 }}>{c.label}</Typography>
          <Button color="inherit" onClick={c.discard} disabled={busy} sx={{ minHeight: 44 }}>
            Discard
          </Button>
          <Button variant="contained" color="warning" onClick={() => onPublish(c.area)} disabled={busy} sx={{ minHeight: 44 }}>
            Publish
          </Button>
        </Box>
      ))}
    </Box>
  );
}

export function PublishBar({ changes, onPublish, busy = false }: { changes: PendingChange[]; onPublish: (area: ChangeArea) => void; busy?: boolean }) {
  const bottom = useBottomChromeHeight();
  const [listOpen, setListOpen] = useState(false);
  // Leaving needs the app's data router (main.tsx); a test may render the page under a plain one.
  const dataRouter = useContext(UNSAFE_DataRouterContext);
  const publish = (area: ChangeArea) => {
    setListOpen(false);
    onPublish(area);
  };
  const publishChanges = () => (changes.length === 1 ? publish(changes[0].area) : setListOpen(true));
  const summary = changes.map((c) => c.label).join(" · ");

  return (
    <>
      {changes.length > 0 && (
        <Box
          role="region"
          aria-label="Unpublished changes"
          sx={{
            position: "fixed",
            right: { xs: 16, sm: 24 },
            bottom: `${bottom + 16}px`,
            zIndex: (theme) => theme.zIndex.appBar - 1,
            maxWidth: "calc(100% - 32px)",
          }}
        >
          <Button
            variant="contained"
            color="warning"
            startIcon={<CloudUploadOutlinedIcon />}
            onClick={publishChanges}
            disabled={busy}
            sx={{ minHeight: 52, px: 2.5, borderRadius: 3, boxShadow: 6, textTransform: "none", justifyContent: "flex-start", textAlign: "left" }}
          >
            <Box component="span" sx={{ display: "flex", flexDirection: "column", minWidth: 0, lineHeight: 1.2 }}>
              <Box component="span" sx={{ fontWeight: 700 }}>
                Publish changes
              </Box>
              <Box component="span" sx={{ fontSize: 12, fontWeight: 500, overflowWrap: "anywhere" }}>
                {summary}
              </Box>
            </Box>
          </Button>
        </Box>
      )}
      {listOpen && changes.length > 0 && (
        <ResponsiveDialog open onClose={() => setListOpen(false)} title="Publish changes" maxWidth="xs">
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Each kind is published on its own; Hub asks you to confirm each.
            </Typography>
            <ChangeList changes={changes} onPublish={publish} busy={busy} />
          </Box>
        </ResponsiveDialog>
      )}
      {dataRouter && <LeaveGuard changes={changes} summary={summary} onPublish={publishChanges} />}
    </>
  );
}

/** Leaving the seller page (not switching its tabs) with changes asks first. */
function LeaveGuard({ changes, summary, onPublish }: { changes: PendingChange[]; summary: string; onPublish: () => void }) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      changes.length > 0 && currentLocation.pathname !== nextLocation.pathname && !nextLocation.pathname.startsWith("/product-manager") && !takeLeaveWithoutAsking()
  );
  return (
    <>
      {blocker.state === "blocked" && (
        <ResponsiveDialog
          open
          onClose={() => blocker.reset()}
          title="Your changes aren't published"
          maxWidth="xs"
          actions={
            <>
              <Button
                color="inherit"
                onClick={() => {
                  for (const c of changes) c.discard();
                  blocker.proceed();
                }}
                sx={{ minHeight: 44 }}
              >
                Discard
              </Button>
              <Button color="inherit" onClick={() => blocker.proceed()} sx={{ minHeight: 44 }}>
                Keep as drafts
              </Button>
              <Button
                variant="contained"
                color="warning"
                onClick={() => {
                  blocker.reset();
                  onPublish();
                }}
                sx={{ minHeight: 44 }}
              >
                Publish now
              </Button>
            </>
          }
        >
          <Typography>Buyers don&apos;t see these until you publish them: {summary}.</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Kept as drafts, they wait on this device for you, here in Manage Shop.
          </Typography>
        </ResponsiveDialog>
      )}
    </>
  );
}
