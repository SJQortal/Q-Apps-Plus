/**
 * A name written with the blank Braille character (U+2800, "⠀"), crossed
 * out in red wherever the app shows it (rules/markedName.ts); every other
 * name shows as it is. For a name inside a line of text, see markedText.tsx.
 *
 *   <MarkedName name={name} />                                 the name itself
 *   <MarkedName name={name}>{visibleName(name)}</MarkedName>   the name as shown
 */
import type { ReactNode } from 'react';
import { Box } from '@mui/material';
import { visuallyHidden } from '@mui/utils';
import { hasBrailleBlank, MARKED_NAME_NOTE } from '../../rules/markedName';

export function MarkedName({
  name,
  children,
}: {
  /** The name as published (checked for the character). */
  name: string | null | undefined;
  /** What to show for it, when not the name itself (a short address, dots for blanks). */
  children?: ReactNode;
}) {
  const shown = children ?? name ?? '';
  if (!hasBrailleBlank(name)) return <>{shown}</>;
  return (
    <Box
      component="s"
      title={`This name is ${MARKED_NAME_NOTE}.`}
      sx={{
        textDecorationLine: 'line-through',
        textDecorationColor: (theme) => theme.palette.error.main,
        textDecorationThickness: '2px',
      }}
    >
      {shown}
      <Box component="span" sx={visuallyHidden}>
        {` (${MARKED_NAME_NOTE})`}
      </Box>
    </Box>
  );
}
