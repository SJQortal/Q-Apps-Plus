/**
 * Copies a `qortal://APP/Q-Mintership+/…` link to one page (utils/links.ts
 * appLink: the `+` stays literal). An icon button for page headers, or a
 * "Copy link" text button for cards (every decision and nomination card).
 * The result is spoken once: "Link copied", or "Couldn't copy the link"
 * when the browser refuses, from a status region beside the button. The
 * button's name never changes, so going back to "Copy link" isn't read out
 * as news. The tick pops in (index.css → .qmp-pop).
 *
 * CopyShownLinkButton, in the Explorer's headers, copies the page as it is
 * on screen instead.
 */
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button, IconButton, Tooltip } from '@mui/material';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined';
import { appSearch } from '../../routes/hubLocation';
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
    // Back to idle first, so a second press within the timeout is said again.
    setState('idle');
    const ok = await copyText(appLink(path));
    setState(ok ? 'copied' : 'failed');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), ok ? 1500 : 2500);
  };
  // Emptied on idle: a removal, which isn't announced.
  const status = (
    <span role="status" className="qmp-visually-hidden">
      {state === 'copied' ? 'Link copied' : state === 'failed' ? 'Couldn’t copy the link' : ''}
    </span>
  );
  return { state, copy, status };
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
  return variant === 'text' ? (
    <CopyTextButton path={path} what={what} />
  ) : (
    <CopyIconButton path={path} name={`Copy a link to ${what}`} />
  );
}

/**
 * "Copy the link" to the page exactly as it is on screen: its tab, filters
 * and search, the app's own query without Hub's (Simon, 2026-10-19: "it
 * should copy the link that the user is currently viewing"). For the
 * Explorer's headers.
 */
export function CopyShownLinkButton() {
  const location = useLocation();
  return (
    <CopyIconButton path={location.pathname + appSearch(location.search)} name="Copy the link" />
  );
}

function CopyTextButton({ path, what }: { path: string; what: string }) {
  const { state, copy, status } = useCopy(path);
  const shown =
    state === 'copied' ? 'Link copied' : state === 'failed' ? 'Couldn’t copy' : 'Copy link';
  return (
    <>
      <Button
        size="small"
        startIcon={
          state === 'copied' ? <CheckOutlinedIcon className="qmp-pop" /> : <LinkOutlinedIcon />
        }
        onClick={() => void copy()}
        // A fixed name: it starts with the visible words, then says what the link is to.
        aria-label={`Copy link to ${what}`}
        sx={{ minHeight: 44 }}
      >
        {shown}
      </Button>
      {status}
    </>
  );
}

function CopyIconButton({ path, name }: { path: string; name: string }) {
  const { state, copy, status } = useCopy(path);
  const title =
    state === 'copied' ? 'Link copied' : state === 'failed' ? 'Couldn’t copy the link' : name;
  return (
    <>
      <Tooltip title={title}>
        <IconButton aria-label={name} onClick={() => void copy()} sx={{ width: 44, height: 44 }}>
          {state === 'copied' ? <CheckOutlinedIcon className="qmp-pop" /> : <LinkOutlinedIcon />}
        </IconButton>
      </Tooltip>
      {status}
    </>
  );
}
