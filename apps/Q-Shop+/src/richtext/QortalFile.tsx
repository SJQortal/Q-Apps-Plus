/**
 * A file in a product description (a PDF, mostly): a card with its name and
 * size, Preview for a PDF, and Open in Q-Share when it is a share. Preview
 * gets the file onto the node (with progress), reads it and draws it with
 * pdf.js in a full-screen viewer (richtext/pdf/PdfViewer.tsx, loaded then).
 */
import { lazy, Suspense, useEffect, useState } from "react";
import { Box, Button, CircularProgress, Link, Typography } from "@mui/material";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { ResponsiveDialog } from "../components/common/mobile";
import { ResourceUnavailableError, resourceUrl, waitForResource } from "../qdn/resourceStatus";
import { isPdf, type FileEmbed } from "./embeds";
import { MAX_PDF_BYTES } from "./qortalSources";
import { useReadingMode } from "./pdf/useReadingMode";

const PdfViewer = lazy(() => import("./pdf/PdfViewer"));

export function formatBytes(bytes: number | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

type Phase = { kind: "fetching"; percent: number | null } | { kind: "ready"; data: ArrayBuffer } | { kind: "failed"; message: string };

function PdfPreview({ embed, onClose }: { embed: FileEmbed; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>({ kind: "fetching", percent: null });
  const [attempt, setAttempt] = useState(0);
  const title = embed.filename || embed.title || "PDF";
  const { reading, toggleReading } = useReadingMode();

  useEffect(() => {
    const controller = new AbortController();
    const ref = { service: "FILE" as const, name: embed.name, identifier: embed.identifier };
    void (async () => {
      try {
        // Known too big: not fetched at all (the node would download it first).
        if (embed.size && embed.size > MAX_PDF_BYTES) throw new Error("too big");
        await waitForResource(ref, {
          signal: controller.signal,
          onStatus: (s) => {
            if (!controller.signal.aborted) setPhase({ kind: "fetching", percent: typeof s.percentLoaded === "number" ? Math.round(s.percentLoaded) : null });
          },
        });
        const response = await fetch(resourceUrl(ref), { signal: controller.signal });
        if (!response.ok) throw new Error(`The node answered ${response.status}`);
        const length = Number(response.headers?.get?.("content-length") ?? 0);
        if (length > MAX_PDF_BYTES) throw new Error("too big");
        const data = await response.arrayBuffer();
        if (!controller.signal.aborted) setPhase({ kind: "ready", data });
      } catch (error) {
        if (controller.signal.aborted) return;
        setPhase({
          kind: "failed",
          message:
            error instanceof ResourceUnavailableError
              ? error.message
              : (error as Error)?.message === "too big"
                ? "This PDF is too big to preview here. Open it in Q-Share."
                : "Your node couldn't get the PDF right now.",
        });
      }
    })();
    return () => controller.abort();
  }, [embed.name, embed.identifier, embed.size, attempt]);

  return (
    <ResponsiveDialog open onClose={onClose} title={title} maxWidth="lg" fullScreen={reading}>
      <Box sx={{ display: "flex", flexDirection: "column", minHeight: reading ? "100%" : "min(70dvh, 900px)", height: reading ? "100%" : undefined }}>
        {phase.kind === "ready" ? (
          <Suspense
            fallback={
              <Box role="status" sx={{ m: "auto", display: "flex", gap: 1.5, alignItems: "center" }}>
                <CircularProgress size={24} />
                <Typography>Opening the PDF…</Typography>
              </Box>
            }
          >
            <PdfViewer data={phase.data} title={title} reading={reading} onToggleReading={toggleReading} />
          </Suspense>
        ) : phase.kind === "fetching" ? (
          <Box role="status" sx={{ m: "auto", display: "flex", gap: 1.5, alignItems: "center" }}>
            <CircularProgress size={24} />
            <Typography>Getting the PDF from peers{phase.percent ? `… ${phase.percent} %` : "…"}</Typography>
          </Box>
        ) : (
          <Box role="alert" sx={{ m: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 1, textAlign: "center" }}>
            <Typography>{phase.message}</Typography>
            <Button
              variant="outlined"
              color="inherit"
              onClick={() => {
                setPhase({ kind: "fetching", percent: null });
                setAttempt((n) => n + 1);
              }}
              sx={{ minHeight: 44 }}
            >
              Try again
            </Button>
          </Box>
        )}
      </Box>
    </ResponsiveDialog>
  );
}

export function QortalFile({ embed }: { embed: FileEmbed }) {
  const [preview, setPreview] = useState(false);
  const pdf = isPdf(embed);
  const name = embed.title || embed.filename || "File";
  const details = [embed.title && embed.filename && embed.filename !== embed.title ? embed.filename : "", formatBytes(embed.size), `by ${embed.name}`]
    .filter(Boolean)
    .join(" · ");
  const qshare = embed.link?.toLowerCase().startsWith("qortal://app/q-share/");
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 1.5,
        p: 1.5,
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: "background.paper",
      }}
    >
      <Box aria-hidden sx={{ width: 44, height: 44, borderRadius: 1.5, display: "grid", placeItems: "center", bgcolor: "action.hover", color: pdf ? "error.main" : "text.secondary", flexShrink: 0 }}>
        {pdf ? <PictureAsPdfOutlinedIcon /> : <InsertDriveFileOutlinedIcon />}
      </Box>
      <Box sx={{ flex: "1 1 160px", minWidth: 0 }}>
        <Typography sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>{name}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
          {pdf ? `PDF · ${details}` : details}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        {pdf && (
          <Button variant="contained" startIcon={<VisibilityOutlinedIcon />} onClick={() => setPreview(true)} aria-label={`Preview ${name}`} sx={{ minHeight: 44 }}>
            Preview
          </Button>
        )}
        {embed.link && (
          <Button component={Link} href={embed.link} className="qortal-link" variant="outlined" color="inherit" sx={{ minHeight: 44 }}>
            {qshare ? "Open in Q-Share" : "Open"}
          </Button>
        )}
      </Box>
      {preview && <PdfPreview embed={embed} onClose={() => setPreview(false)} />}
    </Box>
  );
}
