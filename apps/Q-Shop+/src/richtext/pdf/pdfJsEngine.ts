/**
 * PDF.js with its worker code (see pdfJsHub.ts), after Torq's
 * utils/pdfJsEngine.ts. About 1.6 MB, so it loads when a buyer first opens a
 * PDF's preview, never with the app.
 */
import * as pdfjsLib from "pdfjs-dist";

export { WorkerMessageHandler } from "pdfjs-dist/build/pdf.worker.mjs";
export { pdfjsLib };
