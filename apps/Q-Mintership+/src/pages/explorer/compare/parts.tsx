/**
 * Small pieces Compare's sections share: a line that says what a section is
 * still reading (with a skeleton under it), a sub-heading, a plain note, a
 * list shown 20 rows at a time, and "Copy findings".
 */
import { useState, type ReactNode } from 'react';
import { Box, Button, Skeleton, Typography } from '@mui/material';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import { copyText } from '../../../utils/links';
import { formatCount } from '../../../utils/format';

/** Rows a list shows before "Show more" (each person in a row looks up a name). */
export const ROWS_SHOWN = 20;

export const LIST_SX = {
  listStyle: 'none',
  m: 0,
  p: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 1.25,
  minWidth: 0,
} as const;

/** "Reading …": what a section waits for, said in words, over a placeholder. */
export function Waiting({ children }: { children: ReactNode }) {
  return (
    <Box role="status" sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
        {children}
      </Typography>
      <Skeleton variant="text" width="85%" aria-hidden />
      <Skeleton variant="text" width="60%" aria-hidden />
    </Box>
  );
}

export function SubHeading({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <Typography
      component="h3"
      id={id}
      sx={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3, mt: 0.5, overflowWrap: 'anywhere' }}
    >
      {children}
    </Typography>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
      {children}
    </Typography>
  );
}

/** A list of `items`, 20 at a time with "Show more". */
export function SteppedList<T>({
  items,
  label,
  keyOf,
  render,
  ordered = false,
}: {
  items: readonly T[];
  label: string;
  keyOf: (item: T) => string;
  render: (item: T, index: number) => ReactNode;
  ordered?: boolean;
}) {
  const [shown, setShown] = useState(ROWS_SHOWN);
  const left = items.length - shown;
  return (
    <>
      <Box component={ordered ? 'ol' : 'ul'} aria-label={label} sx={LIST_SX}>
        {items.slice(0, shown).map((item, i) => (
          <Box component="li" key={keyOf(item)} sx={{ minWidth: 0 }}>
            {render(item, i)}
          </Box>
        ))}
      </Box>
      {left > 0 ? (
        <Button
          onClick={() => setShown((n) => n + ROWS_SHOWN)}
          sx={{ alignSelf: 'flex-start', minHeight: 44 }}
        >
          Show more ({formatCount(left)} left)
        </Button>
      ) : null}
    </>
  );
}

/** Copies the findings as text; says once whether it worked. */
export function CopyFindingsButton({ build }: { build: () => Promise<string> }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Button
        variant="outlined"
        startIcon={state === 'copied' ? <CheckOutlinedIcon /> : <ContentCopyOutlinedIcon />}
        onClick={async () => {
          setState('idle');
          const ok = await copyText(await build());
          setState(ok ? 'copied' : 'failed');
        }}
        sx={{ minHeight: 44 }}
      >
        {state === 'copied' ? 'Findings copied' : 'Copy findings'}
      </Button>
      <span role="status" className="qmp-visually-hidden">
        {state === 'copied'
          ? 'Findings copied'
          : state === 'failed'
            ? 'Couldn’t copy the findings'
            : ''}
      </span>
    </Box>
  );
}
