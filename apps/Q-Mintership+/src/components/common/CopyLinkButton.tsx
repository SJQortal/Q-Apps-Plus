/**
 * Copies a `qortal://APP/Q-Mintership+/…` link to one page (utils/links.ts
 * appLink: the `+` stays literal). An icon button for page headers, or a
 * "Copy link" text button for cards (every decision and nomination card).
 * The result is spoken: "Link copied", or "Couldn't copy" when the browser
 * refuses.
 */
import { useEffect, useRef, useState } from 'react';
import { Button, IconButton, Tooltip } from '@mui/material';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import { appLink, copyText } from '../../utils/links';

type Copied = 'idle' | 'copied' | 'failed';

function useCopy(path: string) {
  const [state, setState] = useState<Copied>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );
  const copy = async () => {
    const ok = await copyText(appLink(path));
    setState(ok ? 'copied' : 'failed');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), ok ? 1500 : 2500);
  };
  return { state, copy };
}

export interface CopyLinkButtonProps {
  /** The app path the link opens ("/decisions/…"). */
  path: string;
  /** What the link is to, for its name: "this decision", "the nomination of Ada". */
  what?: string;
  /** 'icon' (default): a header icon button; 'text': "Copy link" on a card. */
  variant?: 'icon' | 'text';
}

export function CopyLinkButton({
  path,
  what = 'this page',
  variant = 'icon',
}: CopyLinkButtonProps) {
  const { state, copy } = useCopy(path);
  if (variant === 'text') {
    const shown =
      state === 'copied' ? 'Link copied' : state === 'failed' ? 'Couldn’t copy' : 'Copy link';
    return (
      <Button
        size="small"
        startIcon={state === 'copied' ? <CheckOutlinedIcon /> : <LinkOutlinedIcon />}
        onClick={() => void copy()}
        // The name starts with the visible words, then says what the link is to.
        aria-label={state === 'idle' ? `Copy link to ${what}` : shown}
        sx={{ minHeight: 44 }}
      >
        <span aria-live="polite">{shown}</span>
      </Button>
    );
  }
  const label =
    state === 'copied'
      ? 'Link copied'
      : state === 'failed'
        ? 'Couldn’t copy the link'
        : `Copy a link to ${what}`;
  return (
    <Tooltip title={label}>
      <IconButton aria-label={label} onClick={() => void copy()} sx={{ width: 44, height: 44 }}>
        {state === 'copied' ? <CheckOutlinedIcon /> : <LinkOutlinedIcon />}
      </IconButton>
    </Tooltip>
  );
}
