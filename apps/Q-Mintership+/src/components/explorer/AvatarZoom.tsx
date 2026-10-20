/**
 * A name's avatar that opens bigger when pressed (Simon, 2026-10-17: "I want
 * to be able to click on avatar to see it bigger"). Once its image has
 * loaded it is a button, a 44 px target whatever its size; pressed, a dialog
 * shows the whole image (not cut to a circle), as large as the screen allows
 * up to 400 px, under the name. It is the image the avatar already loaded:
 * nothing more is read. Without an image (none published, or not in yet) it
 * is the plain avatar, its letter.
 */
import { useState } from 'react';
import { Box, ButtonBase } from '@mui/material';
import { NameAvatar } from '../common/NameAvatar';
import { ResponsiveDialog } from '../common/ResponsiveDialog';
import { PERSON_AVATAR, useAvatar } from '../../data/avatars';
import { visibleName } from '../../rules/explorer/nameNotes';

/** A pointer or a finger needs this much, however small the avatar is drawn. */
const TARGET = 44;

export function AvatarZoom({
  name,
  size,
  phoneSize,
}: {
  name: string | null;
  size: number;
  /** A smaller size under 600 px, as NameAvatar's. */
  phoneSize?: number;
}) {
  const avatar = useAvatar(name, PERSON_AVATAR);
  const [open, setOpen] = useState(false);
  const plain = <NameAvatar name={name} size={size} phoneSize={phoneSize} />;
  if (!name || !avatar.loaded || !avatar.src) return plain;
  const shown = visibleName(name);
  // The target grows past a small avatar without moving what is around it.
  const margin = (s: number) => `${-Math.max(0, (TARGET - s) / 2)}px`;
  const sized = (px: (s: number) => string | number) =>
    phoneSize === undefined ? px(size) : { xs: px(phoneSize), sm: px(size) };
  return (
    <>
      <ButtonBase
        onClick={() => setOpen(true)}
        aria-label={`Show ${shown}’s avatar bigger`}
        aria-haspopup="dialog"
        sx={{
          flexShrink: 0,
          borderRadius: '50%',
          minWidth: TARGET,
          minHeight: TARGET,
          m: sized(margin),
          '&:hover [data-avatar]': { filter: 'brightness(1.08)' },
          '&.Mui-focusVisible': { outline: 2, outlineColor: 'primary.main', outlineOffset: 2 },
        }}
      >
        {plain}
      </ButtonBase>
      <ResponsiveDialog open={open} onClose={() => setOpen(false)} title={shown}>
        <Box
          component="img"
          src={avatar.src}
          alt={`${shown}’s avatar`}
          sx={{
            display: 'block',
            width: '100%',
            maxWidth: 400,
            maxHeight: 'min(400px, 60vh)',
            objectFit: 'contain',
            mx: 'auto',
            borderRadius: 2,
          }}
        />
      </ResponsiveDialog>
    </>
  );
}
