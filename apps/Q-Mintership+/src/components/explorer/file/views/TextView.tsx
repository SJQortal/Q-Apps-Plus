/**
 * A text file: its words in a wrapping monospace box, a text size control,
 * and a line under it when only its first part was read. HTML shows as its
 * source and never runs. Adapted from Q-Mail+
 * (src/components/AttachmentPreview/TextViewer.tsx).
 */
import { useState, type ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import TextDecreaseOutlinedIcon from '@mui/icons-material/TextDecreaseOutlined';
import TextIncreaseOutlinedIcon from '@mui/icons-material/TextIncreaseOutlined';
import {
  TEXT_SIZE_MAX,
  TEXT_SIZE_MIN,
  TEXT_SIZE_STEPS,
  stepZoom,
} from '../../../../utils/pdf/documentZoom';
import { ReaderButton, ReaderGroup, ReaderLabel, ReaderToolbar } from './ReaderToolbar';
import { PartNote } from './PartNote';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';
const SIZE_DEFAULT = 14;

export function TextView({
  text,
  label,
  shown,
  size,
  more,
  note,
  extra,
}: {
  text: string;
  label: string;
  /** Bytes shown, and the file's size: the line under it when there is more. */
  shown: number;
  size: number | null;
  more: boolean;
  /** A line above the text ("The page's source. It isn't run here."). */
  note?: string;
  /** More controls in the toolbar (a table's "Show as table"). */
  extra?: ReactNode;
}) {
  const [fontSize, setFontSize] = useState(SIZE_DEFAULT);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 0.5 }}>
      <ReaderToolbar label="Text controls">
        <ReaderGroup>
          <ReaderButton
            label="Smaller text"
            disabled={fontSize <= TEXT_SIZE_MIN}
            onClick={() => setFontSize(stepZoom(fontSize, -1, TEXT_SIZE_STEPS))}
          >
            <TextDecreaseOutlinedIcon />
          </ReaderButton>
          <ReaderLabel label={`Text size ${fontSize}`}>{fontSize}</ReaderLabel>
          <ReaderButton
            label="Larger text"
            disabled={fontSize >= TEXT_SIZE_MAX}
            onClick={() => setFontSize(stepZoom(fontSize, 1, TEXT_SIZE_STEPS))}
          >
            <TextIncreaseOutlinedIcon />
          </ReaderButton>
        </ReaderGroup>
        {extra ? <ReaderGroup>{extra}</ReaderGroup> : null}
      </ReaderToolbar>
      {note ? (
        <Typography variant="body2" color="text.secondary">
          {note}
        </Typography>
      ) : null}
      <Box
        component="pre"
        role="region"
        tabIndex={0}
        aria-label={label}
        sx={(theme) => ({
          m: 0,
          flex: 1,
          minHeight: 160,
          overflow: 'auto',
          p: 2,
          borderRadius: 1,
          border: 1,
          borderColor: 'divider',
          bgcolor: 'background.default',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          fontFamily: MONO,
          fontSize,
          lineHeight: 1.5,
          color: 'text.primary',
          '&:focus-visible': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: 2,
          },
        })}
      >
        {text || ' '}
      </Box>
      {text === '' && !more ? (
        <Typography variant="body2" color="text.secondary">
          The file is empty.
        </Typography>
      ) : null}
      <PartNote shown={shown} size={size} more={more} />
    </Box>
  );
}
