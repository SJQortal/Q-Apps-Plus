/**
 * A transaction's raw API response, easy to read: Core's JSON in its own
 * layout, keys, strings, numbers and true/false/null each in a colour of
 * the theme (shaded to read at 4.5:1 on the box and on its stripes), every other line
 * faintly striped, and a long value wrapping under itself rather than back
 * to the edge, one line per box (so a selection copies as lines). "Copy"
 * copies the text exactly as JSON.stringify lays it out. A response taller
 * than the box scrolls inside it (a named region that takes focus, so a
 * keyboard can scroll it).
 *
 * RawResponse is the toggle a transaction shows it behind (in a list
 * row's details and on its own page): closed at first, and nothing is laid
 * out until it opens. It shows what may show (rules/explorer/rawTx.ts: no
 * message content, no encrypted resource's identifier).
 */
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Box, Button, Typography } from '@mui/material';
import {
  alpha,
  darken,
  decomposeColor,
  getContrastRatio,
  lighten,
  recomposeColor,
  type Theme,
} from '@mui/material/styles';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import type { TxRow } from '../../data/types';
import { rawForDisplay } from '../../rules/explorer/rawTx';
import { jsonLines, jsonText } from '../../utils/jsonLines';
import { ExpandChevron } from '../common/ExpandChevron';
import { SmoothReveal } from '../common/SmoothReveal';
import { copyText } from '../../utils/links';
import { readableTone } from '../../utils/readable';
import { useViewState } from '../../hooks/useViewState';

export const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
/** Every other line's tint (of the text colour over the box). */
const STRIPE = 0.04;

/** The box's striped lines: the text colour at STRIPE over the box's own background. */
function stripeOf(theme: Theme): string {
  const bg = decomposeColor(theme.palette.background.default).values;
  const fg = decomposeColor(theme.palette.text.primary).values;
  const mix = [0, 1, 2].map((i) => Math.round(bg[i] * (1 - STRIPE) + fg[i] * STRIPE));
  return recomposeColor({ type: 'rgb', values: [mix[0], mix[1], mix[2]] });
}

/**
 * A tone readable on the theme's surfaces (utils/readable.ts) and on the
 * striped lines too, shaded a little further when a stripe needs it.
 */
function lineTone(theme: Theme, tone: 'primary' | 'success' | 'warning' | 'error'): string {
  const base = readableTone(theme, tone);
  const stripe = stripeOf(theme);
  const shift = theme.palette.mode === 'dark' ? lighten : darken;
  for (let step = 0; step <= 10; step++) {
    const colour = step === 0 ? base : shift(base, step / 20);
    if (getContrastRatio(colour, stripe) >= 4.6) return colour;
  }
  return theme.palette.text.primary;
}

export function RawJson({
  value,
  label,
  caption = 'Your node’s answer, as JSON',
  fill = false,
}: {
  value: unknown;
  label: string;
  /** The line above it, beside Copy. */
  caption?: string;
  /** As tall as its container (a file in Open File's viewer), instead of up to 480 px. */
  fill?: boolean;
}) {
  const lines = useMemo(() => jsonLines(value), [value]);
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );
  const copy = async () => {
    setCopied('idle');
    const ok = await copyText(jsonText(lines));
    setCopied(ok ? 'copied' : 'failed');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied('idle'), ok ? 1500 : 2500);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        minWidth: 0,
        ...(fill ? { flex: 1, minHeight: 0 } : {}),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 0 }}>
          {caption}
        </Typography>
        <Button
          size="small"
          onClick={() => void copy()}
          startIcon={copied === 'copied' ? <CheckOutlinedIcon /> : <ContentCopyOutlinedIcon />}
          sx={{ minHeight: 44, flexShrink: 0 }}
        >
          Copy
        </Button>
        <span role="status" className="qmp-visually-hidden">
          {copied === 'copied' ? 'Copied' : copied === 'failed' ? 'Couldn’t copy it' : ''}
        </span>
      </Box>
      <Box
        component="pre"
        role="region"
        tabIndex={0}
        aria-label={label}
        sx={(theme) => ({
          m: 0,
          py: 1,
          ...(fill ? { flex: 1, minHeight: 120 } : { maxHeight: 'min(480px, 60vh)' }),
          overflow: 'auto',
          borderRadius: 1,
          border: 1,
          borderColor: 'divider',
          bgcolor: 'background.default',
          fontFamily: MONO,
          fontSize: 13,
          lineHeight: 1.55,
          color: 'text.secondary',
          '&:focus-visible': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: 2,
          },
          '& > span': { display: 'flex', px: 1.5, minWidth: 0 },
          '& > span:nth-of-type(even)': { bgcolor: alpha(theme.palette.text.primary, STRIPE) },
          '& [data-i]': { flexShrink: 0 },
          '& [data-v]': { minWidth: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' },
          '& [data-k="key"]': { color: lineTone(theme, 'primary') },
          '& [data-k="string"]': { color: lineTone(theme, 'success') },
          '& [data-k="number"]': { color: lineTone(theme, 'warning') },
          '& [data-k="boolean"], & [data-k="null"]': { color: lineTone(theme, 'error') },
        })}
      >
        {lines.map((line, i) => (
          <span key={i}>
            <span data-i="" style={{ width: `${line.depth * 2}ch` }} />
            <span data-v="">
              {line.parts.map((part, j) =>
                part.kind === 'punct' ? (
                  part.text
                ) : (
                  <span key={j} data-k={part.kind}>
                    {part.text}
                  </span>
                )
              )}
            </span>
          </span>
        ))}
      </Box>
    </Box>
  );
}

export const RAW_LABEL = 'Raw API response';

/**
 * "Raw API response", opening to the transaction's response (laid out once
 * opened) under the row of buttons it sits in; `before` goes first in that
 * row ("Open transaction").
 */
export function RawResponse({ tx, before }: { tx: TxRow; before?: ReactNode }) {
  const [open, setOpen] = useViewState(`raw:${tx.signature}`, false);
  const id = useId();
  const shown = useMemo(() => (open ? rawForDisplay(tx) : null), [open, tx]);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        {before}
        <Button
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          endIcon={<ExpandChevron open={open} />}
          sx={{ minHeight: 44 }}
        >
          {RAW_LABEL}
        </Button>
      </Box>
      <SmoothReveal open={open}>
        <Box id={id}>{shown ? <RawJson value={shown} label={RAW_LABEL} /> : null}</Box>
      </SmoothReveal>
    </Box>
  );
}
