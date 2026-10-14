/**
 * A Qortal name's avatar (its `qortal_avatar` thumbnail), loaded only once
 * it scrolls into view (MUI's Avatar would load on mount; docs/QORTAL.md
 * pitfall 5), and only tried once per name per session. Until then, and for
 * names without one, it shows the first letter. Accounts without a name get
 * a neutral circle. Hidden from screen readers: the name beside it says it.
 */
import { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { primarySoft } from '../../hub-theme';
import { avatarUrl } from '../../data/accounts';

const broken = new Set<string>();
const loaded = new Set<string>();

export interface NameAvatarProps {
  name: string | null;
  size?: number;
}

export function NameAvatar({ name, size = 40 }: NameAvatarProps) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [visible, setVisible] = useState(() => (name ? loaded.has(name) : false));
  const [failed, setFailed] = useState(() => (name ? broken.has(name) : true));

  useEffect(() => {
    if (!node || visible || !name || failed) return;
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
  }, [node, visible, name, failed]);

  const letter = name ? ([...name.trim()][0]?.toUpperCase() ?? '?') : '';
  const showImage = Boolean(name && visible && !failed);

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
      {showImage ? (
        <Box
          component="img"
          src={avatarUrl(name as string)}
          alt=""
          decoding="async"
          onLoad={() => loaded.add(name as string)}
          onError={() => {
            broken.add(name as string);
            setFailed(true);
          }}
          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        letter
      )}
    </Box>
  );
}
