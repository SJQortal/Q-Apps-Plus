/**
 * A PDF: read whole from the node (pdf.js needs every byte), up to
 * PDF_MAX_BYTES, while pdf.js itself loads (its own chunk, about 1.6 MB,
 * fetched the first time a PDF opens); then drawn page by page
 * (PdfCanvas). Bigger ones say so: Save File keeps them.
 */
import { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { ErrorState } from '../../../common/states';
import { readFileBlob, type QdnResourceRef } from '../../../../data/explorer/qdnFile';
import { sizeWords } from '../../../../rules/explorer/txWords';
import { prefetchPdfJsWorker } from '../../../../utils/pdf/pdfJsHub';
import { PdfCanvas } from './PdfCanvas';

/** PDFs shown at most this big (as Q-Mail+ and Hub's own reader). */
export const PDF_MAX_BYTES = 100 * 1024 * 1024;

export function PdfView({
  fileRef,
  filepath,
  size,
  title,
}: {
  fileRef: QdnResourceRef;
  filepath: string | null;
  size: number | null;
  title: string;
}) {
  const tooBig = size !== null && size > PDF_MAX_BYTES;
  const [state, setState] = useState<
    | { phase: 'loading' }
    | { phase: 'ready'; data: ArrayBuffer }
    | { phase: 'error'; error: unknown }
  >({ phase: 'loading' });
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (tooBig) return;
    let stopped = false;
    setState({ phase: 'loading' });
    // pdf.js loads while the bytes arrive.
    prefetchPdfJsWorker();
    readFileBlob(fileRef, filepath, 'application/pdf')
      .then((blob) => blob.arrayBuffer())
      .then((data) => {
        if (!stopped) setState({ phase: 'ready', data });
      })
      .catch((error: unknown) => {
        if (!stopped) setState({ phase: 'error', error });
      });
    return () => {
      stopped = true;
    };
  }, [fileRef, filepath, tooBig, run]);

  if (tooBig)
    return (
      <Typography role="status" color="text.secondary" sx={{ py: 2 }}>
        This PDF is {sizeWords(size as number)}, too big to show here (the viewer reads up to{' '}
        {sizeWords(PDF_MAX_BYTES)}). Save File keeps it on your device.
      </Typography>
    );
  if (state.phase === 'error')
    return (
      <ErrorState
        compact
        title="Couldn’t read the PDF from your node."
        error={state.error}
        onRetry={() => setRun((value) => value + 1)}
      />
    );
  if (state.phase === 'loading')
    return (
      <Box
        role="status"
        sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, py: 6 }}
      >
        <CircularProgress aria-hidden />
        <Typography color="text.secondary">Opening the PDF…</Typography>
      </Box>
    );
  return <PdfCanvas data={state.data} title={title} />;
}
