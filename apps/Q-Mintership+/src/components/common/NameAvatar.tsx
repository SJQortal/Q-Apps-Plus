/**
 * A Qortal name's avatar (its `qortal_avatar` thumbnail), loaded only once
 * it scrolls into view (MUI's Avatar would load on mount; docs/QORTAL.md
 * pitfall 5). The first letter shows until the image has loaded, and stays
 * for names without one; an avatar Core is still fetching comes in when it
 * can (data/avatars.ts). Accounts without a name get a neutral circle.
 * Hidden from screen readers: the name beside it says it.
 */
import { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { primarySoft } from '../../hub-theme';
import {
  avatarFailed,
  avatarKey,
  avatarLoaded,
  PERSON_AVATAR,
  useAvatar,
} from '../../data/avatars';

export interface NameAvatarProps {
  /** The name the avatar is published under. */
  name: string | null;
  size?: number;
  /** A smaller size under 600 px (a CSS breakpoint, so it costs no screen-size listener). */
  phoneSize?: number;
  /** Another of the name's THUMBNAILs, e.g. a group's `qortal_group_avatar_<id>`. */
  identifier?: string;
  /** What the letter is taken from, when it isn't the name (a group's own name). */
  letterFrom?: string | null;
}

export function NameAvatar({
  name,
  size = 40,
  phoneSize,
  identifier = PERSON_AVATAR,
  letterFrom,
}: NameAvatarProps) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const avatar = useAvatar(name, identifier);
  const key = name ? avatarKey(name, identifier) : null;
  const [visible, setVisible] = useState(avatar.loaded);

  useEffect(() => {
    if (!node || visible || !name || !avatar.src) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, visible, name, avatar.src]);

  const letterSource = letterFrom ?? name;
  const letter = letterSource ? ([...letterSource.trim()][0]?.toUpperCase() ?? '?') : '';
  const sized = (px: (s: number) => number) =>
    phoneSize === undefined ? px(size) : { xs: px(phoneSize), sm: px(size) };
  const src = name && (visible || avatar.loaded) ? avatar.src : null;

  return (
    <Box
      // A span, so it can sit inside a line of text (a <p>) as well as a list.
      component="span"
      ref={setNode}
      aria-hidden
      // Marked, so a line of text that makes its spans inline (PersonInline) leaves it a circle.
      data-avatar=""
      sx={(theme) => ({
        width: sized((s) => s),
        height: sized((s) => s),
        flexShrink: 0,
        borderRadius: '50%',
        overflow: 'hidden',
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: primarySoft(theme),
        color: theme.palette.primary.main,
        fontWeight: 700,
        // Readable even on the smallest (20 px, in a line of text).
        fontSize: sized((s) => Math.max(10, Math.round(s * 0.42))),
        lineHeight: 1,
        userSelect: 'none',
      })}
    >
      {src && avatar.loaded ? null : letter}
      {src ? (
        <Box
          key={src}
          component="img"
          src={src}
          alt=""
          decoding="async"
          onLoad={() => avatarLoaded(key as string, src)}
          onError={() => avatarFailed(key as string, src)}
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            opacity: avatar.loaded ? 1 : 0,
          }}
        />
      ) : null}
    </Box>
  );
}
