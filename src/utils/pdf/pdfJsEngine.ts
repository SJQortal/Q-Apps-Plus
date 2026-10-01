/**
 * PDF.js with its worker code (see pdfJsHub.ts). About 1.6 MB minified, so
 * it is only loaded, with a dynamic import(), when a PDF is first opened,
 * and lands in its own chunk. Nothing may import this module statically.
 * Adapted from Torq (src/utils/pdfJsEngine.ts).
 */
import * as pdfjsLib from 'pdfjs-dist';

export { WorkerMessageHandler } from 'pdfjs-dist/build/pdf.worker.mjs';
export { pdfjsLib };
