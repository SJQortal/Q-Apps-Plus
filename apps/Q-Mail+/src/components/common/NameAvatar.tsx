/**
 * A registered name's avatar (its `qortal_avatar` thumbnail) for name lists
 * such as the name switcher. It asks Qortal only once the avatar is on
 * screen, and only once per name per session (useLazyAvatarUrl, the shared
 * avatar cache). Until then, and for a name without one, it shows the name's
 * first letter, or with `fallback` "space" or "none" no picture at all.
 *
 * Hidden from screen readers: the name beside it says it. The letter is drawn
 * by CSS, so it stays out of the row's text: a menu's type-to-jump matches
 * "carol", not "Ccarol".
 */
import { useState } from 'react';
import { Avatar, Box } from '@mui/material';
import { primarySoft } from '../../hub-theme';
import { useLazyAvatarUrl } from '../../utils/avatarCache';
import { firstVisibleChar } from '../../utils/invisibleCharacters';

export interface NameAvatarProps {
  name: string;
  size: number;
  /** A URL already loaded elsewhere (the signed-in name's header avatar). */
  known?: string;
  /**
   * What shows while there is no picture (not asked yet, none, or broken):
   * - "letter" (default): the name's first letter in a circle;
   * - "space": nothing, in an empty square of `size`, so names in a list line up;
   * - "none": nothing, taking no room (a closed field shows no gap).
   */
  fallback?: 'letter' | 'space' | 'none';
  /** Room after the picture in px, kept only while a picture shows ("space" and "none"). */
  gap?: number;
}

export function NameAvatar({ name, size, known, fallback = 'letter', gap = 0 }: NameAvatarProps) {
  const [node, setNode] = useState<Element | null>(null);
  const url = useLazyAvatarUrl(name, node, known);
  const [brokenUrl, setBrokenUrl] = useState('');
  const letter = firstVisibleChar(name).toUpperCase();

  if (fallback !== 'letter') {
    if (!url || url === brokenUrl) {
      // Still observed (a zero-width span is in view too), so the picture
      // loads once the row scrolls into view.
      return (
        <Box
          ref={setNode}
          component="span"
          aria-hidden
          data-avatar="none"
          sx={{ display: 'inline-block', flexShrink: 0, width: fallback === 'space' ? size : 0, height: size }}
        />
      );
    }
    return (
      <Box
        ref={setNode}
        component="img"
        src={url}
        alt=""
        aria-hidden
        decoding="async"
        data-avatar="picture"
        onError={() => setBrokenUrl(url)}
        sx={{
          display: 'block',
          flexShrink: 0,
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          mr: gap ? `${gap}px` : undefined,
        }}
      />
    );
  }

  return (
    <Avatar
      ref={setNode}
      aria-hidden
      src={url || undefined}
      alt=""
      sx={(theme) => ({
        width: size,
        height: size,
        fontSize: Math.round(size * 0.45),
        fontWeight: 700,
        // MUI's default grey fallback reads below 4.5:1 in every theme.
        bgcolor: primarySoft(theme),
        color: theme.palette.primary.main,
        '& > span[data-letter]::before': { content: 'attr(data-letter)' },
      })}
    >
      {/* Always a child: without one MUI draws its generic person icon. */}
      <span data-letter={letter} />
    </Avatar>
  );
}
