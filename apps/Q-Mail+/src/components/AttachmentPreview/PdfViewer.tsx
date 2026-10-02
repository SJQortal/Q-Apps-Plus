/**
 * Canvas PDF reader. Native iframe/embed PDF plugins fail inside Hub's
 * already-iframed Q-App, so pages are drawn with pdf.js (loaded on first use,
 * see utils/pdf/pdfJsHub.ts). Adapted from Torq's PdfJsCanvasViewer.tsx:
 * zoom (buttons, pinch, ctrl-wheel, double tap), page navigation (buttons,
 * swipe, arrow keys) and a "smart dark" view that is on by default in the
 * dark themes.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, CircularProgress, Typography, useTheme } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ContrastIcon from '@mui/icons-material/Contrast';
import RemoveIcon from '@mui/icons-material/Remove';
import {
  copyPdfBytes,
  loadPdfJs,
  resetPdfjsMainThreadHandlerCache,
  type PdfJsDocument,
  type PdfJsLoadingTask,
} from '../../utils/pdf/pdfJsHub';
import { applySmartDark, pageImageRects, type PixelRect } from '../../utils/pdf/pdfSmartDark';
import {
  PDF_DOUBLE_TAP_ZOOM,
  PDF_ZOOM_MAX,
  PDF_ZOOM_MIN,
  PDF_ZOOM_STEPS,
  canvasPixelRatio,
  clampZoom,
  stepZoom,
} from '../../utils/pdf/documentZoom';
import { useReaderGestures, type ReaderPoint } from './useReaderGestures';
import { ReaderButton, ReaderGroup, ReaderLabel, ReaderToolbar } from './ReaderToolbar';

const PDF_STALL_MS = 240_000;
/** Gap around the page. */
const STAGE_PAD = 8;
/** At 100% a page fills the width, up to this, so a wide screen stays readable. */
const FIT_MAX_WIDTH = 1000;

type PinchStart = { zoom: number; width: number; height: number; fx: number; fy: number };

function fraction(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function PdfViewer({ data, title }: { data: ArrayBuffer; title: string }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageNode, setStageNode] = useState<HTMLDivElement | null>(null);
  const pdfRef = useRef<PdfJsDocument | null>(null);
  const opsRef = useRef<Record<string, number> | null>(null);
  const renderIdRef = useRef(0);
  const renderTaskRef = useRef<{ cancel?: () => void } | null>(null);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shownPageRef = useRef(0);
  const pinchRef = useRef<PinchStart | null>(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [loadPct, setLoadPct] = useState<number | null>(null);
  const [smartDark, setSmartDark] = useState(isDark);
  const [pdfRetryKey, setPdfRetryKey] = useState(0);

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const setStage = useCallback((node: HTMLDivElement | null) => {
    stageRef.current = node;
    setStageNode(node);
  }, []);

  const cancelRender = useCallback(() => {
    if (!renderTaskRef.current?.cancel) return;
    try {
      renderTaskRef.current.cancel();
    } catch {
      /* */
    }
  }, []);

  const renderCurrentPage = useCallback(async () => {
    const doc = pdfRef.current;
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!doc || !canvas || !stage) return;
    const maxP = doc.numPages || 1;
    if (maxP < 1) return;

    const clamped = Math.min(Math.max(1, page), maxP);
    if (clamped !== page) setPage(clamped);

    const renderId = ++renderIdRef.current;
    cancelRender();
    const pdfPage = await doc.getPage(clamped);
    if (renderId !== renderIdRef.current) return;

    const baseVp = pdfPage.getViewport({ scale: 1 });
    const usableW = Math.min(FIT_MAX_WIDTH, Math.max(160, stage.clientWidth - 2 * STAGE_PAD));
    const cssScale = (usableW / baseVp.width) * (zoom / 100);
    const cssWidth = Math.floor(baseVp.width * cssScale);
    const cssHeight = Math.floor(baseVp.height * cssScale);
    // Draw at the screen's pixel density so text stays sharp on a phone.
    const pixelRatio = canvasPixelRatio(cssWidth, cssHeight, window.devicePixelRatio);
    const viewport = pdfPage.getViewport({ scale: cssScale * pixelRatio });

    // Draw off screen so the current page stays up until the new one is ready.
    const scratch = document.createElement('canvas');
    scratch.width = Math.floor(viewport.width);
    scratch.height = Math.floor(viewport.height);
    const ctx = scratch.getContext('2d', { alpha: false });
    if (!ctx) return;

    const task = pdfPage.render({ canvasContext: ctx, viewport });
    renderTaskRef.current = task;
    try {
      await task.promise;
    } catch (error: unknown) {
      const name = error && typeof error === 'object' && 'name' in error ? String((error as { name: string }).name) : '';
      if (name !== 'RenderingCancelledException') throw error;
      return; // A newer render owns the canvas now.
    }
    if (renderId !== renderIdRef.current) return;

    if (smartDark) {
      let pictures: PixelRect[] = [];
      const ops = opsRef.current;
      if (ops) {
        try {
          pictures = pageImageRects(await pdfPage.getOperatorList(), ops, viewport.transform, scratch.width, scratch.height);
        } catch {
          // Without picture boxes the whole page is judged as paper.
        }
      }
      if (renderId !== renderIdRef.current) return;
      const image = ctx.getImageData(0, 0, scratch.width, scratch.height);
      applySmartDark(image.data, scratch.width, scratch.height, pictures);
      ctx.putImageData(image, 0, 0);
    }

    canvas.width = scratch.width;
    canvas.height = scratch.height;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    canvas.getContext('2d', { alpha: false })?.drawImage(scratch, 0, 0);
    scratch.width = 0;
    scratch.height = 0;
    if (shownPageRef.current !== clamped) {
      shownPageRef.current = clamped;
      stage.scrollTop = 0;
    }
  }, [cancelRender, page, smartDark, zoom]);

  const renderRef = useRef(renderCurrentPage);
  renderRef.current = renderCurrentPage;

  useEffect(() => {
    let alive = true;
    let loadingTask: PdfJsLoadingTask | null = null;
    let tid: number | null = null;

    const armTimeout = () => {
      if (tid !== null) window.clearTimeout(tid);
      tid = window.setTimeout(() => {
        if (!alive) return;
        try {
          loadingTask?.destroy?.();
        } catch {
          /* */
        }
        setErr('The PDF preview timed out. Try Save instead.');
        setLoading(false);
        setLoadPct(null);
      }, PDF_STALL_MS);
    };

    setLoading(true);
    setErr(null);
    setLoadPct(null);
    armTimeout();

    void (async () => {
      try {
        const pdfjs = await loadPdfJs();
        opsRef.current = pdfjs.OPS ?? null;
        const bytes = copyPdfBytes(data);
        loadingTask = pdfjs.getDocument({
          data: bytes,
          disableStream: true,
          disableAutoFetch: true,
          useWorkerFetch: false,
          isOffscreenCanvasSupported: false,
        });
        loadingTask.onProgress = (progress) => {
          if (!alive || !progress?.total) return;
          armTimeout();
          setLoadPct(Math.min(100, Math.round((100 * progress.loaded) / progress.total)));
        };
        const pdf = await loadingTask.promise;
        if (tid !== null) {
          window.clearTimeout(tid);
          tid = null;
        }
        if (!alive) {
          pdf.destroy();
          return;
        }
        pdfRef.current = pdf;
        shownPageRef.current = 0;
        setNumPages(pdf.numPages || 1);
        setPage(1);
        setLoadPct(null);
        setLoading(false);
      } catch (error) {
        if (tid !== null) {
          window.clearTimeout(tid);
          tid = null;
        }
        if (!alive) return;
        setErr(error instanceof Error ? error.message : 'This PDF could not be opened. Try Save instead.');
        setLoadPct(null);
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
      if (tid !== null) window.clearTimeout(tid);
      try {
        loadingTask?.destroy?.();
      } catch {
        /* */
      }
      if (renderTaskRef.current?.cancel) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          /* */
        }
      }
      renderTaskRef.current = null;
      pdfRef.current?.destroy();
      pdfRef.current = null;
    };
  }, [data, pdfRetryKey]);

  useEffect(() => {
    if (loading || err || !pdfRef.current) return;
    void renderCurrentPage().catch((error) => {
      setErr(error instanceof Error ? error.message : 'The page could not be drawn.');
    });
  }, [loading, err, renderCurrentPage, numPages]);

  // Refit when the reader changes width: rotation, a resized window.
  useEffect(() => {
    if (!stageNode) return;
    let lastWidth = stageNode.clientWidth;
    const refit = () => {
      if (stageNode.clientWidth === lastWidth) return;
      lastWidth = stageNode.clientWidth;
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(() => {
        void renderRef.current().catch(() => undefined);
      }, 120);
    };
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver === 'function') {
      observer = new ResizeObserver(refit);
      observer.observe(stageNode);
    } else {
      window.addEventListener('resize', refit);
    }
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', refit);
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
    };
  }, [stageNode]);

  const canPrev = page > 1;
  const canNext = numPages > 0 && page < numPages;

  const goPage = useCallback(
    (step: 1 | -1) => {
      setPage((current) => Math.min(Math.max(1, current + step), Math.max(1, numPages)));
    },
    [numPages]
  );

  const beginPinch = (focal: ReaderPoint) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // A page still drawing at the old size would snap back mid-pinch.
    renderIdRef.current += 1;
    cancelRender();
    const rect = canvas.getBoundingClientRect();
    pinchRef.current = {
      zoom: zoomRef.current,
      width: rect.width,
      height: rect.height,
      fx: rect.width > 0 ? fraction((focal.x - rect.left) / rect.width) : 0.5,
      fy: rect.height > 0 ? fraction((focal.y - rect.top) / rect.height) : 0,
    };
  };

  /** Stretch the drawn page while the fingers move; it is redrawn sharp after. */
  const stretchPage = (ratio: number, focal: ReaderPoint) => {
    const start = pinchRef.current;
    if (!start) return null;
    const next = Math.round(clampZoom(start.zoom * ratio, PDF_ZOOM_MIN, PDF_ZOOM_MAX));
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage || start.width <= 0) return next;
    const scale = next / start.zoom;
    canvas.style.width = `${start.width * scale}px`;
    canvas.style.height = `${start.height * scale}px`;
    const rect = canvas.getBoundingClientRect();
    stage.scrollLeft += rect.left + start.fx * rect.width - focal.x;
    stage.scrollTop += rect.top + start.fy * rect.height - focal.y;
    return next;
  };

  const finishPinch = (ratio: number, focal: ReaderPoint) => {
    const next = stretchPage(ratio, focal);
    pinchRef.current = null;
    if (next == null) return;
    if (next !== zoomRef.current) setZoom(next);
    else void renderRef.current().catch(() => undefined);
  };

  const zoomAround = (target: number, focal?: ReaderPoint) => {
    const stage = stageRef.current;
    const next = Math.round(clampZoom(target, PDF_ZOOM_MIN, PDF_ZOOM_MAX));
    if (!stage || next === zoomRef.current) return;
    const box = stage.getBoundingClientRect();
    const point = focal ?? { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    beginPinch(point);
    finishPinch(next / zoomRef.current, point);
  };

  useReaderGestures(stageNode, {
    onPinchStart: beginPinch,
    onPinch: (ratio, focal) => {
      stretchPage(ratio, focal);
    },
    onPinchEnd: finishPinch,
    onDoubleTap: (point) => {
      zoomAround(zoomRef.current > 101 ? 100 : PDF_DOUBLE_TAP_ZOOM, point);
    },
    onSwipe: (direction) => {
      const stage = stageRef.current;
      // A zoomed page pans sideways instead.
      if (!stage || stage.scrollWidth > stage.clientWidth + 1) return;
      goPage(direction);
    },
  });

  useEffect(() => {
    if (loading || err) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]')) return;
      const stage = stageRef.current;
      const panning = stage ? stage.scrollWidth > stage.clientWidth + 1 : false;
      if (event.key === 'ArrowRight' && !panning) goPage(1);
      else if (event.key === 'ArrowLeft' && !panning) goPage(-1);
      else if (event.key === '+' || event.key === '=') zoomAround(stepZoom(zoomRef.current, 1, PDF_ZOOM_STEPS));
      else if (event.key === '-') zoomAround(stepZoom(zoomRef.current, -1, PDF_ZOOM_STEPS));
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const stageBg = smartDark || isDark ? theme.palette.background.default : theme.palette.grey[200];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative' }}>
      {loading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, py: 8 }} role="status">
          <CircularProgress />
          <Typography color="text.secondary">
            Opening PDF…
            {loadPct != null && loadPct >= 0 ? ` ${loadPct}%` : ''}
          </Typography>
        </Box>
      ) : err ? (
        <Box sx={{ py: 3 }} role="alert">
          <Typography color="error" sx={{ mb: 2 }}>
            {err}
          </Typography>
          <Button
            variant="outlined"
            sx={{ minHeight: 44 }}
            onClick={() => {
              resetPdfjsMainThreadHandlerCache();
              setPdfRetryKey((key) => key + 1);
            }}
          >
            Retry
          </Button>
        </Box>
      ) : (
        <>
          <ReaderToolbar label="PDF controls">
            <ReaderGroup>
              <ReaderButton label="Previous page" disabled={!canPrev} onClick={() => goPage(-1)}>
                <ChevronLeftIcon />
              </ReaderButton>
              <ReaderLabel label={`Page ${page} of ${numPages || 1}`}>
                {page} / {numPages || 1}
              </ReaderLabel>
              <ReaderButton label="Next page" disabled={!canNext} onClick={() => goPage(1)}>
                <ChevronRightIcon />
              </ReaderButton>
            </ReaderGroup>
            <ReaderGroup>
              <ReaderButton label="Zoom out" disabled={zoom <= PDF_ZOOM_MIN} onClick={() => zoomAround(stepZoom(zoom, -1, PDF_ZOOM_STEPS))}>
                <RemoveIcon />
              </ReaderButton>
              <ReaderLabel label={zoom === 100 ? `Zoom ${zoom}%` : 'Fit page width'} onClick={zoom === 100 ? undefined : () => zoomAround(100)}>
                {zoom}%
              </ReaderLabel>
              <ReaderButton label="Zoom in" disabled={zoom >= PDF_ZOOM_MAX} onClick={() => zoomAround(stepZoom(zoom, 1, PDF_ZOOM_STEPS))}>
                <AddIcon />
              </ReaderButton>
            </ReaderGroup>
            <ReaderGroup>
              <ReaderButton label={smartDark ? 'Show the page as printed' : 'Dark page (keeps photos)'} pressed={smartDark} onClick={() => setSmartDark((v) => !v)}>
                <ContrastIcon />
              </ReaderButton>
            </ReaderGroup>
          </ReaderToolbar>
          <Box
            ref={setStage}
            data-testid="pdf-preview-stage"
            tabIndex={0}
            aria-label={`${title}, page ${page} of ${numPages || 1}`}
            sx={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              // A scrollbar showing up after the first draw would make a
              // fitted page too wide by its thickness.
              scrollbarGutter: 'stable',
              touchAction: 'pan-x pan-y',
              overscrollBehavior: 'contain',
              borderRadius: 2,
              bgcolor: stageBg,
            }}
          >
            <Box sx={{ width: 'max-content', minWidth: '100%', boxSizing: 'border-box', p: `${STAGE_PAD}px` }}>
              <canvas ref={canvasRef} aria-label={title} data-testid="pdf-preview-canvas" style={{ display: 'block', margin: '0 auto' }} />
            </Box>
            {numPages > 1 ? (
              <Box sx={{ position: 'sticky', left: 0, display: 'flex', justifyContent: 'center', gap: 1, pt: 1.5, pb: 1.5 }}>
                <Button size="small" disabled={!canPrev} startIcon={<ChevronLeftIcon />} onClick={() => goPage(-1)} sx={{ minHeight: 44 }}>
                  Previous
                </Button>
                <Button size="small" disabled={!canNext} endIcon={<ChevronRightIcon />} onClick={() => goPage(1)} sx={{ minHeight: 44 }}>
                  Next
                </Button>
              </Box>
            ) : null}
          </Box>
        </>
      )}
    </Box>
  );
}

export default PdfViewer;
