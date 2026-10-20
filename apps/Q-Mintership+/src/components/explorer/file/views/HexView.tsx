/**
 * A file the viewer can't show as anything else: what it is in words, and
 * its first bytes as a hex dump (rules/explorer/fileText.ts hexRows), 512
 * bytes and then up to the 4 KB read. Save File keeps it.
 */
import { useMemo, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { hexRows } from '../../../../rules/explorer/fileText';
import { sizeWords } from '../../../../rules/explorer/txWords';

const FIRST = 512;
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

export function HexView({
  head,
  size,
  typeWords,
}: {
  head: Uint8Array;
  size: number | null;
  /** What it is: "A Word document (DOCX)", "Binary data". */
  typeWords: string;
}) {
  const [all, setAll] = useState(false);
  const bytes = all ? head : head.subarray(0, FIRST);
  const rows = useMemo(() => hexRows(bytes), [bytes]);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
      <Typography>
        {typeWords}. It can’t be shown here: Save File keeps it on your device, to open with a
        program that reads it.
      </Typography>
      {head.length ? (
        <>
          <Typography variant="body2" color="text.secondary">
            Its first {sizeWords(bytes.length)}
            {size !== null ? ` of ${sizeWords(size)}` : ''}, byte by byte:
          </Typography>
          <Box
            component="pre"
            role="region"
            tabIndex={0}
            aria-label="The file’s first bytes in hex"
            sx={(theme) => ({
              m: 0,
              p: 1.5,
              overflow: 'auto',
              maxHeight: 'min(420px, 50vh)',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: 'background.default',
              fontFamily: MONO,
              fontSize: 13,
              lineHeight: 1.6,
              '& [data-o]': { color: 'text.secondary', mr: 2 },
              '& [data-t]': { color: 'text.secondary', ml: 2 },
              '&:focus-visible': {
                outline: `2px solid ${theme.palette.primary.main}`,
                outlineOffset: 2,
              },
            })}
          >
            {rows.map((row) => (
              <div key={row.offset}>
                <span data-o="">{row.offset}</span>
                <span>{row.hex.padEnd(48, ' ')}</span>
                <span data-t="">{row.text}</span>
              </div>
            ))}
          </Box>
          {!all && head.length > FIRST ? (
            <Button onClick={() => setAll(true)} sx={{ alignSelf: 'flex-start', minHeight: 44 }}>
              Show the first {sizeWords(head.length)}
            </Button>
          ) : null}
        </>
      ) : null}
    </Box>
  );
}
