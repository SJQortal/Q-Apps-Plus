/**
 * Hub-safe pdf.js bootstrap. Adapted from Torq (src/utils/pdfJsHub.ts).
 *
 * PDF.js normally parses in a Web Worker. Hub's `/render/APP/...` fails the
 * lazy `pdf.worker-*.js` fetch, and Hub/WebView can break the worker channel
 * so `getDocument` hangs until timeout.
 *
 * The worker module is imported together with PDF.js itself (pdfJsEngine.ts),
 * which loads with the first PDF through a dynamic import(). When
 * `globalThis.pdfjsWorker.WorkerMessageHandler` is set, PDF.js uses a
 * main-thread fake worker and never calls `new Worker(...)`.
 */

export type PdfJsLib = {
  GlobalWorkerOptions: { workerPort: Worker | null };
  /** Operator codes, for reading a page's drawing commands. */
  OPS: Record<string, number>;
  getDocument: (src: {
    data: Uint8Array;
    disableStream?: boolean;
    disableAutoFetch?: boolean;
    useWorkerFetch?: boolean;
    isOffscreenCanvasSupported?: boolean;
  }) => PdfJsLoadingTask;
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

export type PdfJsViewport = {
  width: number;
  height: number;
  /** Page space to canvas pixels. */
  transform: number[];
};

export type PdfJsPage = {
  getViewport: (opts: { scale: number }) => PdfJsViewport;
  getOperatorList: () => Promise<{
    fnArray: ArrayLike<number>;
    argsArray: ArrayLike<unknown>;
  }>;
  render: (opts: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }) => { promise: Promise<void>; cancel?: () => void };
};

let primeMainThreadHandlerPromise: Promise<void> | null = null;
let pdfjsMod: PdfJsLib | null = null;
let engine: Promise<typeof import('./pdfJsEngine')> | null = null;

function loadEngine(): Promise<typeof import('./pdfJsEngine')> {
  if (!engine) {
    engine = import('./pdfJsEngine').catch((error) => {
      engine = null;
      throw error;
    });
  }
  return engine;
}

async function installMainThreadHandler(): Promise<PdfJsLib> {
  const { WorkerMessageHandler, pdfjsLib } = await loadEngine();
  const g = globalThis as unknown as {
    pdfjsWorker?: { WorkerMessageHandler?: unknown };
  };
  if (WorkerMessageHandler == null) {
    throw new Error('pdf.worker.mjs missing WorkerMessageHandler');
  }
  if (!g.pdfjsWorker?.WorkerMessageHandler) {
    g.pdfjsWorker = { WorkerMessageHandler };
  }
  if (!pdfjsMod) {
    pdfjsMod = pdfjsLib as unknown as PdfJsLib;
  }
  try {
    pdfjsMod.GlobalWorkerOptions.workerPort = null;
  } catch {
    /* Hub / fake-worker path */
  }
  return pdfjsMod;
}

export async function ensurePdfjsMainThreadHandler(): Promise<void> {
  if (primeMainThreadHandlerPromise) {
    try {
      await primeMainThreadHandlerPromise;
      return;
    } catch {
      primeMainThreadHandlerPromise = null;
    }
  }
  primeMainThreadHandlerPromise = Promise.resolve().then(async () => {
    await installMainThreadHandler();
  });
  try {
    await primeMainThreadHandlerPromise;
  } catch (error) {
    primeMainThreadHandlerPromise = null;
    throw error;
  }
}

export async function loadPdfJs(): Promise<PdfJsLib> {
  await ensurePdfjsMainThreadHandler();
  return installMainThreadHandler();
}

/** Start loading the engine chunk before the bytes arrive, so the PDF opens sooner. */
export function prefetchPdfJsWorker(): void {
  void ensurePdfjsMainThreadHandler().catch(() => undefined);
}

export function resetPdfjsMainThreadHandlerCache(): void {
  primeMainThreadHandlerPromise = null;
}

/** Copy bytes so pdf.js cannot detach the source ArrayBuffer. */
export function copyPdfBytes(source: ArrayBuffer): Uint8Array {
  const raw = new Uint8Array(source);
  const data = new Uint8Array(raw.length);
  data.set(raw);
  return data;
}
