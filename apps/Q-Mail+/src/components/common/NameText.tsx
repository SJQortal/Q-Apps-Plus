/**
 * A Qortal name (or an alias) shown as text.
 *
 * Names hiding invisible characters (hasInvisibleCharacters, Qortal Hub's
 * rule) are impostors' copies of a real name, so they are struck through in
 * the theme's error colour, exactly as Hub does, with a tooltip and a
 * screen-reader note, in an inline span, so the parent's typography,
 * truncation and ellipsis keep working. Other names render as plain text
 * (or a span when given sx, className, a component or other props).
 *
 * Only for names: never pass an address. The name itself is never changed.
 * `children` replaces the visible text (search highlighting) while `name`
 * still decides the strike.
 */
import type { ElementType, ReactNode } from 'react';
import { Box, type BoxProps } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { hasInvisibleCharacters } from '../../utils/invisibleCharacters';

export const HIDDEN_CHARACTERS_TITLE = 'This name has hidden characters and may imitate another name.';
export const HIDDEN_CHARACTERS_SR = ', name has hidden characters';

/** Qortal Hub's style for these names (DirectsSidebar, UserLookup, …). */
export const strikeNameSx = (theme: Theme) => ({
  textDecorationLine: 'line-through',
  textDecorationThickness: '2px',
  textDecorationColor: theme.palette.error.main,
});

/** The same strike for a text field's own text (To, alias and reply alias fields). */
export const strikeInputSx = (theme: Theme) => ({ '& .MuiInputBase-input': strikeNameSx(theme) });

/** MUI's visuallyHidden, inline so the kit needs no @mui/utils import. */
const srOnly = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  height: '1px',
  margin: '-1px',
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
  width: '1px',
  textDecoration: 'none',
} as const;

export type NameTextProps = Omit<BoxProps, 'children' | 'component'> & {
  name: string | null | undefined;
  children?: ReactNode;
  component?: ElementType;
};

export function NameText({ name, children, sx, component = 'span', ...rest }: NameTextProps) {
  const text = children ?? name ?? '';
  // Older rows can carry a non-string here; only a string is ever tested.
  const unsafe = typeof name === 'string' && hasInvisibleCharacters(name);
  const sxList = Array.isArray(sx) ? sx : sx ? [sx] : [];

  if (!unsafe) {
    // An ordinary name adds no element unless the caller styles it, so the
    // DOM (and text matching on it) stays exactly as before.
    if (!sx && component === 'span' && Object.keys(rest).length === 0) return <>{text}</>;
    return (
      <Box component={component} sx={sxList as SxProps<Theme>} {...rest}>
        {text}
      </Box>
    );
  }
  return (
    <Box
      component={component}
      title={HIDDEN_CHARACTERS_TITLE}
      data-hidden-characters=""
      {...rest}
      sx={[strikeNameSx, ...sxList] as SxProps<Theme>}
    >
      {text}
      <Box component="span" sx={srOnly}>
        {HIDDEN_CHARACTERS_SR}
      </Box>
    </Box>
  );
}
