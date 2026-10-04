/**
 * Opens a decrypted PDF attachment in Hub's own PDF reader, as Q-Share+ does
 * (docs/QORTAL.md pitfall 16).
 *
 * Hub's SHOW_PDF_READER takes one field, `blob`, which must be a Blob typed
 * `application/pdf`. Hub checks the type, then hands the Blob to its pdf.js
 * viewer through an in-memory event (`openPdf`): nothing is uploaded, written
 * or published, so the bytes decrypted here (DECRYPT_DATA) stay on this
 * device. It accepts no QDN reference, URL or base64, and has no prompt.
 *
 * Hub answers at once, so a reader that hasn't answered in a few seconds is
 * missing (an older Hub, or no Hub at all, as under `npm run dev`). Then the
 * caller opens the bundled pdf.js viewer instead, and later PDFs go straight
 * there for the rest of the session.
 */

/** Hub's reader gets the whole file in memory, so bigger PDFs are saved instead (Q-Share+'s cap). */
export const PDF_OPEN_MAX_BYTES = 100 * 1024 * 1024;

/** Hub answers SHOW_PDF_READER at once; the default qortalRequest wait is 10 s. */
export const PDF_READER_TIMEOUT_MS = 5000;

export const PDF_TOO_LARGE = 'Too large to open here. Download to view.';
export const PDF_NOT_A_PDF = "This file isn't a PDF. Download to view.";

export type HubPdfResult = 'opened' | 'too-large' | 'not-pdf' | 'unavailable';

let readerMissing = false;

/** Whether Hub's reader failed earlier this session (the bundled viewer is used then). */
export function hubPdfReaderMissing(): boolean {
  return readerMissing;
}

/** For tests. */
export function resetHubPdfReader(): void {
  readerMissing = false;
}

/** The PDF spec allows the `%PDF-` header anywhere in the first 1 KB. */
export function hasPdfHeader(bytes: Uint8Array): boolean {
  let text = '';
  for (let i = 0; i < Math.min(bytes.length, 1024); i += 1) text += String.fromCharCode(bytes[i]);
  return text.includes('%PDF-');
}

async function readHead(blob: Blob): Promise<Uint8Array> {
  const head = blob.slice(0, 1024);
  if (typeof head.arrayBuffer === 'function') return new Uint8Array(await head.arrayBuffer());
  // Older WebViews: Blob.arrayBuffer arrived late.
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(head);
  });
}

/** The request Hub's reader expects: the same bytes, re-typed (slice() does not copy them). */
export function pdfReaderRequest(blob: Blob): { action: 'SHOW_PDF_READER'; blob: Blob } {
  return { action: 'SHOW_PDF_READER', blob: blob.slice(0, blob.size, 'application/pdf') };
}

/**
 * Hands decrypted PDF bytes to Hub's reader. The sender chose the stored
 * type, so the bytes must really start like a PDF. Resolves to what happened;
 * 'unavailable' means the caller should use the bundled viewer.
 */
export async function openPdfInHub(blob: Blob): Promise<HubPdfResult> {
  if (blob.size > PDF_OPEN_MAX_BYTES) return 'too-large';
  try {
    if (!hasPdfHeader(await readHead(blob))) return 'not-pdf';
  } catch {
    return 'unavailable';
  }
  if (readerMissing) return 'unavailable';
  try {
    await qortalRequestWithTimeout(pdfReaderRequest(blob), PDF_READER_TIMEOUT_MS);
    return 'opened';
  } catch {
    readerMissing = true;
    return 'unavailable';
  }
}
