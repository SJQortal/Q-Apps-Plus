/**
 * A PDF drawn page by page on a canvas, after Torq's PdfJsCanvasViewer
 * (Hub's frame and GO's WebView have no PDF plugin, so an <iframe> or
 * <embed> stays blank: docs/QORTAL.md, pitfall 16). One page at a time, at
 * the screen's pixel density so text stays sharp on a phone; at 100 % it
 * fills the width (up to 1000 px). Previous/Next and ← →, zoom − + and Fit
 * and − + 0; a zoomed page scrolls. The page is drawn off screen first, so
 * the one shown stays until the next is ready.
 *
 * Loaded on its own (with pdf.js) when a buyer first opens a PDF preview.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, CircularProgress, IconButton, Typography } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ZoomInOutlinedIcon from "@mui/icons-material/ZoomInOutlined";
import ZoomOutOutlinedIcon from "@mui/icons-material/ZoomOutOutlined";
import FitScreenOutlinedIcon from "@mui/icons-material/FitScreenOutlined";
import { visuallyHiddenSx } from "../../pages/Store/a11y";
import { canvasPixelRatio, copyPdfBytes, loadPdfJs, type PdfJsDocument, type PdfJsLoadingTask } from "./pdfJsHub";

const ZOOM_STEPS = [50, 75, 100, 125, 150, 200, 300, 400];
const FIT_MAX_WIDTH = 1000;
const STAGE_PAD = 8;

function stepZoom(zoom: number, direction: 1 | -1): number {
  if (direction > 0) return ZOOM_STEPS.find((z) => z > zoom) ?? zoom;
  return [...ZOOM_STEPS].reverse().find((z) => z < zoom) ?? zoom;
}

export default function PdfViewer({ data, title }: { data: ArrayBuffer; title: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<PdfJsDocument | null>(null);
  const renderId = useRef(0);
  const task = useRef<{ cancel?: () => void } | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [width, setWidth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Open the document (again on Try again).
  useEffect(() => {
    let alive = true;
    let loadingTask: PdfJsLoadingTask | null = null;
    void (async () => {
      try {
        const pdfjs = await loadPdfJs();
        loadingTask = pdfjs.getDocument({ data: copyPdfBytes(data), disableStream: true, disableAutoFetch: true, isOffscreenCanvasSupported: false });
        const doc = await loadingTask.promise;
        if (!alive) return doc.destroy();
        docRef.current = doc;
        setNumPages(doc.numPages);
        setPage(1);
        setLoading(false);
      } catch {
        if (alive) {
          setError("This PDF couldn't be opened. It may be damaged, or not a PDF.");
          setLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
      loadingTask?.destroy?.();
      docRef.current?.destroy();
      docRef.current = null;
    };
  }, [data, attempt]);

  // The stage's width, for "fit".
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => setWidth(stage.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const draw = useCallback(async () => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || width <= 0) return;
    const id = ++renderId.current;
    try {
      task.current?.cancel?.();
    } catch {
      // nothing to cancel
    }
    const pdfPage = await doc.getPage(Math.min(Math.max(1, page), doc.numPages));
    if (id !== renderId.current) return;
    const base = pdfPage.getViewport({ scale: 1 });
    const usable = Math.min(FIT_MAX_WIDTH, Math.max(160, width - 2 * STAGE_PAD));
    const cssScale = (usable / base.width) * (zoom / 100);
    const cssWidth = Math.floor(base.width * cssScale);
    const cssHeight = Math.floor(base.height * cssScale);
    const ratio = canvasPixelRatio(cssWidth, cssHeight, window.devicePixelRatio);
    const viewport = pdfPage.getViewport({ scale: cssScale * ratio });
    const scratch = document.createElement("canvas");
    scratch.width = Math.floor(viewport.width);
    scratch.height = Math.floor(viewport.height);
    const ctx = scratch.getContext("2d", { alpha: false });
    if (!ctx) return;
    const run = pdfPage.render({ canvasContext: ctx, viewport });
    task.current = run;
    try {
      await run.promise;
    } catch (e) {
      if ((e as { name?: string } | null)?.name === "RenderingCancelledException") return;
      throw e;
    }
    if (id !== renderId.current) return;
    canvas.width = scratch.width;
    canvas.height = scratch.height;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    canvas.getContext("2d")?.drawImage(scratch, 0, 0);
  }, [page, zoom, width]);

  useEffect(() => {
    if (loading || error) return;
    draw().catch(() => setError("This page couldn't be drawn."));
  }, [draw, loading, error]);

  // ← → pages, − + 0 zoom, anywhere in the viewer's dialog.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") setPage((p) => Math.max(1, p - 1));
      else if (event.key === "ArrowRight") setPage((p) => Math.min(numPages || 1, p + 1));
      else if (event.key === "+" || event.key === "=") setZoom((z) => stepZoom(z, 1));
      else if (event.key === "-" || event.key === "_") setZoom((z) => stepZoom(z, -1));
      else if (event.key === "0") setZoom(100);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [numPages]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minHeight: 0, flex: 1 }}>
      <Box
        role="toolbar"
        aria-label="PDF"
        sx={{ display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 0.5 }}
      >
        <IconButton title="Previous page (←)" aria-label="Previous page" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || loading} sx={{ width: 44, height: 44 }}>
              <ChevronLeftIcon />
            </IconButton>
        <Typography variant="body2" aria-live="polite" sx={{ minWidth: 48, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
          <Box component="span" aria-hidden>
            {numPages ? `${page} / ${numPages}` : "…"}
          </Box>
          {numPages > 0 && <Box component="span" sx={visuallyHiddenSx}>{`Page ${page} of ${numPages}`}</Box>}
        </Typography>
        <IconButton title="Next page (→)" aria-label="Next page" onClick={() => setPage((p) => Math.min(numPages || 1, p + 1))} disabled={page >= numPages || loading} sx={{ width: 44, height: 44 }}>
              <ChevronRightIcon />
            </IconButton>
        <IconButton title="Zoom out (−)" aria-label="Zoom out" onClick={() => setZoom((z) => stepZoom(z, -1))} disabled={zoom <= ZOOM_STEPS[0] || loading} sx={{ width: 44, height: 44 }}>
              <ZoomOutOutlinedIcon />
            </IconButton>
        <Typography variant="body2" sx={{ minWidth: 48, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
          {zoom} %
        </Typography>
        <IconButton title="Zoom in (+)" aria-label="Zoom in" onClick={() => setZoom((z) => stepZoom(z, 1))} disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1] || loading} sx={{ width: 44, height: 44 }}>
              <ZoomInOutlinedIcon />
            </IconButton>
        <IconButton title="Fit the width (0)" aria-label="Fit the width" onClick={() => setZoom(100)} disabled={zoom === 100 || loading} sx={{ width: 44, height: 44 }}>
              <FitScreenOutlinedIcon />
            </IconButton>
      </Box>
      <Box
        ref={stageRef}
        // A dim frame around the white page, in every theme.
        sx={{
          position: "relative",
          flex: 1,
          minHeight: 240,
          overflow: "auto",
          p: `${STAGE_PAD}px`,
          borderRadius: 2,
          bgcolor: "action.selected",
          display: "flex",
          justifyContent: zoom > 100 ? "flex-start" : "center",
          alignItems: "flex-start",
        }}
      >
        {loading && (
          <Box role="status" sx={{ m: "auto", display: "flex", alignItems: "center", gap: 1.5 }}>
            <CircularProgress size={24} />
            <Typography>Opening the PDF…</Typography>
          </Box>
        )}
        {error && (
          <Box role="alert" sx={{ m: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 1, textAlign: "center" }}>
            <Typography>{error}</Typography>
            <Button
              variant="outlined"
              color="inherit"
              onClick={() => {
                setError(null);
                setLoading(true);
                setAttempt((n) => n + 1);
              }}
              sx={{ minHeight: 44 }}
            >
              Try again
            </Button>
          </Box>
        )}
        <Box
          component="canvas"
          ref={canvasRef}
          role="img"
          aria-label={`${title}, page ${page}${numPages ? ` of ${numPages}` : ""}`}
          sx={{ display: loading || error ? "none" : "block", boxShadow: 2, flexShrink: 0 }}
        />
      </Box>
    </Box>
  );
}
