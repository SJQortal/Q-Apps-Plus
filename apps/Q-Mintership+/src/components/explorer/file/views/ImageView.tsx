/**
 * A picture: fits the viewer at 100%, zooms with buttons, pinch,
 * ctrl-wheel and double tap; a zoomed picture pans by scrolling. Its URL is
 * the node's own (it streams; nothing is held in the page). One the browser
 * can't draw (a HEIC, a broken file) says so; Save File is beside it.
 * Adapted from Q-Mail+ (src/components/AttachmentPreview/ImageViewer.tsx).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import RemoveOutlinedIcon from '@mui/icons-material/RemoveOutlined';
import {
  PDF_DOUBLE_TAP_ZOOM,
  PDF_ZOOM_MAX,
  PDF_ZOOM_MIN,
  PDF_ZOOM_STEPS,
  clampZoom,
  scrollAfterZoom,
  stepZoom,
} from '../../../../utils/pdf/documentZoom';
import { useReaderGestures, type ReaderPoint } from './useReaderGestures';
import { ReaderButton, ReaderGroup, ReaderLabel, ReaderToolbar } from './ReaderToolbar';

export const IMAGE_FAILED = 'This picture can’t be shown here. Save File keeps it on your device.';

export function ImageView({ src, alt }: { src: string; alt: string }) {
  const theme = useTheme();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageNode, setStageNode] = useState<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(100);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const pinchRef = useRef<{ zoom: number; focal: ReaderPoint } | null>(null);

  const setStage = useCallback((node: HTMLDivElement | null) => {
    stageRef.current = node;
    setStageNode(node);
  }, []);

  useEffect(() => {
    setZoom(100);
    setNatural(null);
    setFailed(false);
  }, [src]);

  /** Change zoom and keep the spot under `focal` (viewport coordinates) still. */
  const zoomAround = useCallback((target: number, focal?: ReaderPoint) => {
    const stage = stageRef.current;
    const next = Math.round(clampZoom(target, PDF_ZOOM_MIN, PDF_ZOOM_MAX));
    const current = zoomRef.current;
    if (next === current) return;
    if (stage) {
      const box = stage.getBoundingClientRect();
      const fx = focal ? focal.x - box.left : box.width / 2;
      const fy = focal ? focal.y - box.top : box.height / 2;
      const ratio = next / current;
      const left = scrollAfterZoom(stage.scrollLeft, fx, ratio);
      const top = scrollAfterZoom(stage.scrollTop, fy, ratio);
      requestAnimationFrame(() => {
        stage.scrollLeft = left;
        stage.scrollTop = top;
      });
    }
    setZoom(next);
  }, []);

  useReaderGestures(stageNode, {
    onPinchStart: (focal) => {
      pinchRef.current = { zoom: zoomRef.current, focal };
    },
    onPinch: (ratio, focal) => {
      const start = pinchRef.current;
      if (!start) return;
      zoomAround(start.zoom * ratio, focal);
    },
    onPinchEnd: () => {
      pinchRef.current = null;
    },
    onDoubleTap: (point) => zoomAround(zoomRef.current > 101 ? 100 : PDF_DOUBLE_TAP_ZOOM, point),
  });

  // At 100% the picture fits inside the stage (both ways); zoom scales from there.
  const fitWidth = (() => {
    const stage = stageNode;
    if (!stage || !natural) return '100%';
    const w = Math.max(1, stage.clientWidth - 16);
    const h = Math.max(1, stage.clientHeight - 16);
    const scale = Math.min(w / natural.w, h / natural.h, 1);
    return `${Math.round(natural.w * scale * (zoom / 100))}px`;
  })();

  if (failed)
    return (
      <Typography role="status" color="text.secondary" sx={{ py: 3 }}>
        {IMAGE_FAILED}
      </Typography>
    );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <ReaderToolbar label="Picture controls">
        <ReaderGroup>
          <ReaderButton
            label="Zoom out"
            disabled={zoom <= PDF_ZOOM_MIN}
            onClick={() => zoomAround(stepZoom(zoom, -1, PDF_ZOOM_STEPS))}
          >
            <RemoveOutlinedIcon />
          </ReaderButton>
          <ReaderLabel
            label={zoom === 100 ? `Zoom ${zoom}%` : 'Fit to the viewer'}
            onClick={zoom === 100 ? undefined : () => zoomAround(100)}
          >
            {zoom}%
          </ReaderLabel>
          <ReaderButton
            label="Zoom in"
            disabled={zoom >= PDF_ZOOM_MAX}
            onClick={() => zoomAround(stepZoom(zoom, 1, PDF_ZOOM_STEPS))}
          >
            <AddOutlinedIcon />
          </ReaderButton>
        </ReaderGroup>
      </ReaderToolbar>
      <Box
        ref={setStage}
        data-testid="file-image-stage"
        // Zoomed, a sideways drag pans the picture.
        data-no-swipe-back={zoom !== 100 ? '' : undefined}
        // Focusable, so a keyboard can pan a zoomed picture with the arrows.
        tabIndex={0}
        role="region"
        aria-label={`Picture: ${alt}`}
        sx={{
          flex: 1,
          minHeight: 240,
          overflow: 'auto',
          touchAction: 'pan-x pan-y',
          overscrollBehavior: 'contain',
          borderRadius: 1,
          bgcolor:
            theme.palette.mode === 'dark'
              ? theme.palette.background.default
              : theme.palette.grey[100],
          display: 'flex',
          '&:focus-visible': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: 2,
          },
        }}
      >
        <Box sx={{ m: 'auto', p: 1, display: 'flex' }}>
          <img
            src={src}
            alt={alt}
            draggable={false}
            onLoad={(event) => {
              const img = event.currentTarget;
              setNatural({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
            }}
            onError={() => setFailed(true)}
            style={{
              display: 'block',
              width: fitWidth,
              maxWidth: natural ? 'none' : '100%',
              height: 'auto',
              userSelect: 'none',
              borderRadius: 4,
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}
