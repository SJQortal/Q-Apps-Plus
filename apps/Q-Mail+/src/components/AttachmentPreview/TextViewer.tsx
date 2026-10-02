/**
 * Plain-text preview for .txt/.md/.json/.csv/… attachments: a wrapping <pre>
 * with a size cap (large files show the first part and say so), and a text
 * size control.
 */
import { useEffect, useState } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import TextDecreaseIcon from '@mui/icons-material/TextDecrease';
import TextIncreaseIcon from '@mui/icons-material/TextIncrease';
import { TEXT_SIZE_DEFAULT, TEXT_SIZE_MAX, TEXT_SIZE_MIN, TEXT_SIZE_STEPS, stepZoom } from '../../utils/pdf/documentZoom';
import { formatFileSize } from '../../utils/attachmentMeta';
import { ReaderButton, ReaderGroup, ReaderLabel, ReaderToolbar } from './ReaderToolbar';

/** Bytes shown before the preview is cut. */
export const TEXT_PREVIEW_LIMIT = 512 * 1024;

export async function readTextPreview(blob: Blob, limit = TEXT_PREVIEW_LIMIT): Promise<{ text: string; truncated: boolean }> {
  const truncated = blob.size > limit;
  const slice = truncated ? blob.slice(0, limit) : blob;
  const text = await slice.text();
  return { text, truncated };
}

export function TextViewer({ blob, title }: { blob: Blob; title: string }) {
  const theme = useTheme();
  const [state, setState] = useState<{ text: string; truncated: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState(TEXT_SIZE_DEFAULT);

  useEffect(() => {
    let cancelled = false;
    setState(null);
    setError(null);
    readTextPreview(blob)
      .then((result) => {
        if (!cancelled) setState(result);
      })
      .catch(() => {
        if (!cancelled) setError('This file could not be read as text.');
      });
    return () => {
      cancelled = true;
    };
  }, [blob]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <ReaderToolbar label="Text controls">
        <ReaderGroup>
          <ReaderButton label="Smaller text" disabled={size <= TEXT_SIZE_MIN} onClick={() => setSize(stepZoom(size, -1, TEXT_SIZE_STEPS))}>
            <TextDecreaseIcon />
          </ReaderButton>
          <ReaderLabel label={`Text size ${size}`}>{size}</ReaderLabel>
          <ReaderButton label="Larger text" disabled={size >= TEXT_SIZE_MAX} onClick={() => setSize(stepZoom(size, 1, TEXT_SIZE_STEPS))}>
            <TextIncreaseIcon />
          </ReaderButton>
        </ReaderGroup>
      </ReaderToolbar>
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
          bgcolor: theme.palette.background.paper,
          p: 2,
        }}
      >
        {error && (
          <Typography color="error" role="alert">
            {error}
          </Typography>
        )}
        {state && (
          <>
            <pre
              aria-label={title}
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
                fontSize: size,
                lineHeight: 1.5,
                color: theme.palette.text.primary,
              }}
            >
              {state.text}
            </pre>
            {state.truncated && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Showing the first {formatFileSize(TEXT_PREVIEW_LIMIT)} of {formatFileSize(blob.size)}. Save the file to read all of it.
              </Typography>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}
