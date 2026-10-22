/**
 * A picture in the full-screen viewer that zooms (Simon: "when viewing the
 * product pictures in full screen user can zoom on the images"): the wheel
 * zooms at the pointer, two fingers pinch, a double click or double tap goes
 * to 2.5× there and back, and a zoomed picture is dragged around. Buttons
 * (Zoom in, Zoom out, Fit) and the + − 0 keys do the same without a pointer.
 *
 * The picture is laid out fitted (contain) and only transformed, so nothing
 * is decoded again; it never moves past its edges. While zoomed, swipes don't
 * change the picture (`onZoomedChange`). Give it `key={src}`: a new picture
 * starts fitted.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import ZoomInOutlinedIcon from "@mui/icons-material/ZoomInOutlined";
import ZoomOutOutlinedIcon from "@mui/icons-material/ZoomOutOutlined";
import FitScreenOutlinedIcon from "@mui/icons-material/FitScreenOutlined";

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 5;
const STEP = 1.5;
const DOUBLE_ZOOM = 2.5;
const DOUBLE_TAP_MS = 300;

interface View {
  scale: number;
  x: number;
  y: number;
}

const FIT: View = { scale: 1, x: 0, y: 0 };

const clampScale = (scale: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));

export function ZoomableImage({
  src,
  alt,
  onZoomedChange,
}: {
  src: string;
  alt: string;
  onZoomedChange?: (zoomed: boolean) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const [view, setView] = useState<View>(FIT);
  const viewRef = useRef(view);
  useLayoutEffect(() => {
    viewRef.current = view;
  }, [view]);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ view: View; mid: { x: number; y: number }; distance: number } | null>(null);
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null);

  /** The picture kept inside the frame: centred on an axis where it is smaller, never past an edge where it is larger. */
  const clamp = useCallback((next: View): View => {
    const frame = box.current?.getBoundingClientRect();
    const picture = img.current;
    const scale = clampScale(next.scale);
    if (!frame || !picture || scale === 1) return { scale, x: 0, y: 0 };
    const spareX = Math.max(0, (picture.offsetWidth * scale - frame.width) / 2);
    const spareY = Math.max(0, (picture.offsetHeight * scale - frame.height) / 2);
    return { scale, x: Math.min(spareX, Math.max(-spareX, next.x)), y: Math.min(spareY, Math.max(-spareY, next.y)) };
  }, []);

  /** Zoom to `scale`, keeping the picture's point under (clientX, clientY) where it is (the frame's centre by default). */
  const zoomTo = useCallback(
    (scale: number, at?: { x: number; y: number }, from: View = viewRef.current) => {
      const frame = box.current?.getBoundingClientRect();
      const target = clampScale(scale);
      if (!frame) return setView({ ...from, scale: target });
      const cx = frame.left + frame.width / 2;
      const cy = frame.top + frame.height / 2;
      const px = at?.x ?? cx;
      const py = at?.y ?? cy;
      const ratio = target / from.scale;
      setView(clamp({ scale: target, x: px - cx - (px - cx - from.x) * ratio, y: py - cy - (py - cy - from.y) * ratio }));
    },
    [clamp]
  );

  const zoomed = view.scale > 1.001;
  useEffect(() => onZoomedChange?.(zoomed), [zoomed, onZoomedChange]);

  // The wheel zooms at the pointer (a non-passive listener, so the dialog doesn't scroll instead).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomTo(viewRef.current.scale * Math.exp(-event.deltaY * 0.0015), { x: event.clientX, y: event.clientY });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomTo]);

  // + and − zoom, 0 fits, wherever focus is in the viewer.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(event.target.tagName)) return;
      if (event.key === "+" || event.key === "=") zoomTo(viewRef.current.scale * STEP);
      else if (event.key === "-" || event.key === "_") zoomTo(viewRef.current.scale / STEP);
      else if (event.key === "0") setView(FIT);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomTo]);

  const toggleAt = (x: number, y: number) => (zoomed ? setView(FIT) : zoomTo(DOUBLE_ZOOM, { x, y }));

  const startGesture = () => {
    const points = [...pointers.current.values()];
    if (points.length >= 2) {
      const [a, b] = points;
      gesture.current = { view: viewRef.current, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
    } else if (points.length === 1) {
      gesture.current = { view: viewRef.current, mid: points[0], distance: 0 };
    } else gesture.current = null;
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest("button")) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    startGesture();
    if (event.pointerType !== "mouse" && pointers.current.size === 1) {
      const tap = lastTap.current;
      const now = event.timeStamp;
      if (tap && now - tap.time < DOUBLE_TAP_MS && Math.hypot(tap.x - event.clientX, tap.y - event.clientY) < 30) {
        lastTap.current = null;
        toggleAt(event.clientX, event.clientY);
        gesture.current = null;
      } else lastTap.current = { time: now, x: event.clientX, y: event.clientY };
    }
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const start = gesture.current;
    if (!start) return;
    const points = [...pointers.current.values()];
    if (points.length >= 2 && start.distance > 0) {
      const [a, b] = points;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const frame = box.current?.getBoundingClientRect();
      const scale = clampScale((start.view.scale * Math.hypot(a.x - b.x, a.y - b.y)) / start.distance);
      if (!frame) return;
      const cx = frame.left + frame.width / 2;
      const cy = frame.top + frame.height / 2;
      // The picture's point under the fingers' first midpoint follows the midpoint.
      const ux = (start.mid.x - cx - start.view.x) / start.view.scale;
      const uy = (start.mid.y - cy - start.view.y) / start.view.scale;
      setView(clamp({ scale, x: mid.x - cx - ux * scale, y: mid.y - cy - uy * scale }));
    } else if (points.length === 1 && start.view.scale > 1) {
      setView(clamp({ ...start.view, x: start.view.x + points[0].x - start.mid.x, y: start.view.y + points[0].y - start.mid.y }));
    }
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    startGesture();
  };

  const percent = Math.round(view.scale * 100);

  return (
    <Box
      ref={box}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={(event) => toggleAt(event.clientX, event.clientY)}
      // Two fingers zoom the picture, not the page; one finger drags it once it's zoomed.
      sx={{ position: "relative", width: "100%", overflow: "hidden", touchAction: "none", cursor: zoomed ? "grab" : "zoom-in", userSelect: "none" }}
    >
      <Box
        ref={img}
        component="img"
        src={src}
        alt={alt}
        draggable={false}
        sx={{
          width: "100%",
          height: "auto",
          maxHeight: "75dvh",
          objectFit: "contain",
          display: "block",
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          transformOrigin: "center",
          willChange: zoomed ? "transform" : undefined,
        }}
      />
      <Box
        role="group"
        aria-label="Zoom"
        sx={{
          position: "absolute",
          right: 8,
          bottom: 8,
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          p: 0.5,
          borderRadius: 6,
          bgcolor: "background.paper",
          border: 1,
          borderColor: "divider",
        }}
      >
        <Tooltip title="Zoom out (−)">
          <span>
            <IconButton aria-label="Zoom out" onClick={() => zoomTo(view.scale / STEP)} disabled={!zoomed} sx={{ width: 44, height: 44 }}>
              <ZoomOutOutlinedIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Typography variant="body2" aria-live="polite" sx={{ minWidth: 44, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
          {percent} %
        </Typography>
        <Tooltip title="Zoom in (+)">
          <span>
            <IconButton aria-label="Zoom in" onClick={() => zoomTo(view.scale * STEP)} disabled={view.scale >= MAX_ZOOM} sx={{ width: 44, height: 44 }}>
              <ZoomInOutlinedIcon />
            </IconButton>
          </span>
        </Tooltip>
        {zoomed && (
          <Tooltip title="Fit (0)">
            <IconButton aria-label="Fit the picture" onClick={() => setView(FIT)} sx={{ width: 44, height: 44 }}>
              <FitScreenOutlinedIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Box>
  );
}
