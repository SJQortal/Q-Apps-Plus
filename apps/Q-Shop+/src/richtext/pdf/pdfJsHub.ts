/**
 * pdf.js the way it works inside Hub, after Torq's utils/pdfJsHub.ts:
 * pdf.js normally reads a PDF in a Web Worker, but Hub's `/render/APP/…`
 * fails a lazily loaded `pdf.worker-*.js`, and Hub's frame or GO's WebView
 * can break the worker's channel, so `getDocument` hangs. The worker's code
 * comes with pdf.js itself (pdfJsEngine.ts); with
 * `globalThis.pdfjsWorker.WorkerMessageHandler` set, pdf.js runs it on the
 * main thread and never calls `new Worker(...)`. A failed download of the
 * engine is tried again on the next Preview.
 */
export type PdfJsLib = {
  GlobalWorkerOptions: { workerPort: Worker | null };
  getDocument: (src: { data: Uint8Array; disableStream?: boolean; disableAutoFetch?: boolean; isOffscreenCanvasSupported?: boolean }) => PdfJsLoadingTask;
};

export type PdfJsLoadingTask = {
  onProgress?: (progress: { loaded: number; total: number }) => void;
  destroy?: () => void;
  promise: Promise<PdfJsDocument>;
};

export type PdfJsDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfJsPage>;
  destroy: () => void;
};

export type PdfJsPage = {
  getViewport: (opts: { scale: number }) => { width: number; height: number };
  render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => {
    promise: Promise<void>;
    cancel?: () => void;
  };
};

let engine: Promise<typeof import("./pdfJsEngine")> | null = null;

function loadEngine(): Promise<typeof import("./pdfJsEngine")> {
  if (!engine) {
    engine = import("./pdfJsEngine").catch((error: unknown) => {
      engine = null;
      throw error;
    });
  }
  return engine;
}

/** pdf.js, with its worker on the main thread. */
export async function loadPdfJs(): Promise<PdfJsLib> {
  const { WorkerMessageHandler, pdfjsLib } = await loadEngine();
  if (WorkerMessageHandler == null) throw new Error("pdf.worker.mjs has no WorkerMessageHandler");
  const g = globalThis as unknown as { pdfjsWorker?: { WorkerMessageHandler?: unknown } };
  if (!g.pdfjsWorker?.WorkerMessageHandler) g.pdfjsWorker = { WorkerMessageHandler };
  const lib = pdfjsLib as unknown as PdfJsLib;
  try {
    lib.GlobalWorkerOptions.workerPort = null;
  } catch {
    // The fake-worker path.
  }
  return lib;
}

/** A copy of the bytes, so pdf.js can't detach the buffer the caller keeps. */
export function copyPdfBytes(source: ArrayBuffer): Uint8Array {
  const data = new Uint8Array(source.byteLength);
  data.set(new Uint8Array(source));
  return data;
}

/** Canvas pixels per CSS pixel: the screen's density, lower for a huge page (a canvas has a size limit). */
export function canvasPixelRatio(cssWidth: number, cssHeight: number, devicePixelRatio = 1): number {
  const ratio = Math.min(3, Math.max(1, devicePixelRatio || 1));
  const MAX_PIXELS = 16_000_000;
  const area = cssWidth * cssHeight * ratio * ratio;
  return area > MAX_PIXELS ? Math.max(1, Math.sqrt(MAX_PIXELS / (cssWidth * cssHeight))) : ratio;
}
