/**
 * "Copy" for a piece of text on screen (a signature): a small text button
 * whose tick pops in, and a status region that says "Copied" once, or
 * "Couldn't copy it" when the browser refuses. Its name stays the same, so
 * going back to "Copy" isn't read out as news.
 */
import { useEffect, useRef, useState } from 'react';
import { Button } from '@mui/material';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import { copyText } from '../../utils/links';

export function CopyTextButton({
  text,
  what,
}: {
  text: string;
  /** "the signature" */ what: string;
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );
  const copy = async () => {
    setState('idle');
    const ok = await copyText(text);
    setState(ok ? 'copied' : 'failed');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), ok ? 1500 : 2500);
  };
  return (
    <>
      <Button
        size="small"
        onClick={() => void copy()}
        aria-label={`Copy ${what}`}
        startIcon={
          state === 'copied' ? (
            <CheckOutlinedIcon className="qmp-pop" />
          ) : (
            <ContentCopyOutlinedIcon />
          )
        }
        sx={{ minHeight: 44, flexShrink: 0 }}
      >
        Copy
      </Button>
      <span role="status" className="qmp-visually-hidden">
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Couldn’t copy it' : ''}
      </span>
    </>
  );
}
