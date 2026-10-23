import type { Track } from "../../state/features/playerSlice";

/** The filename without its extension. */
export function trackTitle(track: Pick<Track, "filename">): string {
  const name = track.filename || "Untitled";
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

/** 3:07, or 1:02:03 for an hour and more; "–:––" while unknown. */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "–:––";
  const whole = Math.floor(seconds);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = String(whole % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
