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
import { avatarFailed, avatarLoaded, useAvatar } from '../../data/avatars';

export interface NameAvatarProps {
  name: string | null;
  size?: number;
}

export function NameAvatar({ name, size = 40 }: NameAvatarProps) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const avatar = useAvatar(name);
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

  const letter = name ? ([...name.trim()][0]?.toUpperCase() ?? '?') : '';
  const src = name && (visible || avatar.loaded) ? avatar.src : null;

  return (
    <Box
      ref={setNode}
      aria-hidden
      sx={(theme) => ({
        width: size,
        height: size,
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
        fontSize: Math.round(size * 0.42),
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
          onLoad={() => avatarLoaded(name as string, src)}
          onError={() => avatarFailed(name as string, src)}
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
