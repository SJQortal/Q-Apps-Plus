/**
 * Image preview: fits the screen at 100%, zooms with buttons, pinch,
 * ctrl-wheel and double tap; a zoomed image pans by scrolling.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, useTheme } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { PDF_DOUBLE_TAP_ZOOM, PDF_ZOOM_MAX, PDF_ZOOM_MIN, PDF_ZOOM_STEPS, clampZoom, scrollAfterZoom, stepZoom } from '../../utils/pdf/documentZoom';
import { useReaderGestures, type ReaderPoint } from './useReaderGestures';
import { ReaderButton, ReaderGroup, ReaderLabel, ReaderToolbar } from './ReaderToolbar';

export function ImageViewer({ src, alt, onSwipe }: { src: string; alt: string; onSwipe?: (direction: 1 | -1) => void }) {
  const theme = useTheme();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageNode, setStageNode] = useState<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(100);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
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
    onSwipe: (direction) => {
      const stage = stageRef.current;
      if (!onSwipe || !stage || stage.scrollWidth > stage.clientWidth + 1) return;
      onSwipe(direction);
    },
  });

  // At 100% the image fits inside the stage (both axes); zoom scales from there.
  const fitWidth = (() => {
    const stage = stageNode;
    if (!stage || !natural) return '100%';
    const w = Math.max(1, stage.clientWidth - 16);
    const h = Math.max(1, stage.clientHeight - 16);
    const scale = Math.min(w / natural.w, h / natural.h, 1);
    return `${Math.round(natural.w * scale * (zoom / 100))}px`;
  })();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <ReaderToolbar label="Image controls">
        <ReaderGroup>
          <ReaderButton label="Zoom out" disabled={zoom <= PDF_ZOOM_MIN} onClick={() => zoomAround(stepZoom(zoom, -1, PDF_ZOOM_STEPS))}>
            <RemoveIcon />
          </ReaderButton>
          <ReaderLabel label={zoom === 100 ? `Zoom ${zoom}%` : 'Fit to screen'} onClick={zoom === 100 ? undefined : () => zoomAround(100)}>
            {zoom}%
          </ReaderLabel>
          <ReaderButton label="Zoom in" disabled={zoom >= PDF_ZOOM_MAX} onClick={() => zoomAround(stepZoom(zoom, 1, PDF_ZOOM_STEPS))}>
            <AddIcon />
          </ReaderButton>
        </ReaderGroup>
      </ReaderToolbar>
      <Box
        ref={setStage}
        data-testid="image-preview-stage"
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          touchAction: 'pan-x pan-y',
          overscrollBehavior: 'contain',
          borderRadius: 2,
          bgcolor: theme.palette.mode === 'dark' ? theme.palette.background.default : theme.palette.grey[100],
          display: 'flex',
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
