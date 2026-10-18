/**
 * Share thumbnails, made on the device when a share is published: the first
 * image scaled to fit 640 px, or a frame from a video, as WebP (JPEG where
 * the browser can't write WebP) of at most 200 KB. Only the small result is
 * published (utils/publishPayload.ts, THUMBNAIL `qshare_thumb_…`).
 */
import { decodeImage, drawnCanvas, encodeCanvas } from "./coverImage";
import { fileKind } from "./fileKind";

export const THUMBNAIL_MAX = 640;
export const THUMBNAIL_MAX_BYTES = 200 * 1024;
/** Bigger images aren't read for a thumbnail on the device (a phone's memory). */
export const THUMBNAIL_SOURCE_MAX_BYTES = 40 * 1024 * 1024;
/** A video that won't give a frame by then gets no thumbnail. */
export const VIDEO_FRAME_TIMEOUT_MS = 10_000;

/** `width` × `height` scaled down (never up) to fit in `max` × `max`. */
export function fitWithin(width: number, height: number, max = THUMBNAIL_MAX): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** A thumbnail of an image file; rejects when it can't be read. */
export async function makeImageThumbnail(file: Blob): Promise<File> {
  const image = await decodeImage(file, (width, height) => fitWithin(width, height));
  try {
    if (!image.width || !image.height) throw new Error("The image is empty");
    const size = fitWithin(image.width, image.height);
    const canvas = drawnCanvas(size.width, size.height, (context) =>
      context.drawImage(image.source, 0, 0, size.width, size.height)
    );
    return await encodeCanvas(canvas, "thumbnail", THUMBNAIL_MAX_BYTES);
  } finally {
    image.close();
  }
}

function waitFor(video: HTMLVideoElement, event: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => done(new Error(`No ${event} in time`)), timeoutMs);
    const onEvent = () => done();
    const onError = () => done(new Error("The video can't be read"));
    function done(error?: Error) {
      clearTimeout(timer);
      video.removeEventListener(event, onEvent);
      video.removeEventListener("error", onError);
      if (error) reject(error);
      else resolve();
    }
    video.addEventListener(event, onEvent);
    video.addEventListener("error", onError);
  });
}

/** A thumbnail from a frame about a second (or a tenth) into a video; rejects when the browser can't play it. */
export async function makeVideoThumbnail(file: Blob, timeoutMs = VIDEO_FRAME_TIMEOUT_MS): Promise<File> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  try {
    const loaded = waitFor(video, "loadeddata", timeoutMs);
    video.src = url;
    await loaded;
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const seeked = waitFor(video, "seeked", timeoutMs);
    video.currentTime = Math.min(1, duration * 0.1);
    await seeked;
    if (!video.videoWidth || !video.videoHeight) throw new Error("The video has no picture");
    const size = fitWithin(video.videoWidth, video.videoHeight);
    const canvas = drawnCanvas(size.width, size.height, (context) => context.drawImage(video, 0, 0, size.width, size.height));
    return await encodeCanvas(canvas, "thumbnail", THUMBNAIL_MAX_BYTES);
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

/** What a thumbnail can be made from: the first image, else the first video. */
export function thumbnailSource<T extends { name: string; mimetype?: string; size?: number }>(files: T[]): { file: T; kind: "image" | "video" } | null {
  const usable = (f: T) => (f.size ?? 0) <= THUMBNAIL_SOURCE_MAX_BYTES;
  const image = files.find((f) => fileKind(f.mimetype, f.name) === "image" && usable(f));
  if (image) return { file: image, kind: "image" };
  const video = files.find((f) => fileKind(f.mimetype, f.name) === "video");
  return video ? { file: video, kind: "video" } : null;
}

/** A thumbnail of `blob` made the way its kind needs. */
export function makeThumbnail(blob: Blob, kind: "image" | "video"): Promise<File> {
  return kind === "image" ? makeImageThumbnail(blob) : makeVideoThumbnail(blob);
}
