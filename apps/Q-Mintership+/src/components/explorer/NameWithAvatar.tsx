/**
 * A name with its own avatar beside it, for a name in a line of text: a
 * primary or a secondary name, each showing the avatar published under that
 * name (loaded once it nears the screen, its first letter until then). The
 * name is isolated in `<bdi>`, so right-to-left marks or label-like words
 * can't change how the line reads, with invisible characters shown as "·".
 */
import { Box } from '@mui/material';
import { MarkedName } from '../common/MarkedName';
import { NameAvatar } from '../common/NameAvatar';
import { visibleName } from '../../rules/explorer/nameNotes';

export interface NameWithAvatarProps {
  name: string;
  /** In quotes, as a name inside a sentence (“foo”). */
  quoted?: boolean;
  /** The avatar's size in px (default 20, the line's height). */
  size?: number;
  /** Bold name (default true). */
  strong?: boolean;
  /** Text that belongs to the name, kept in its box ("’s" in "Bob’s nomination"). */
  suffix?: string;
}

export function NameWithAvatar({
  name,
  quoted = false,
  size = 20,
  strong = true,
  suffix,
}: NameWithAvatarProps) {
  // Plain inline text with the avatar as an inline box before it: the name
  // wraps with the line, and the line's words read on without an extra gap.
  return (
    <Box component="span" sx={{ overflowWrap: 'anywhere' }}>
      <Box
        component="span"
        sx={{ display: 'inline-block', verticalAlign: 'middle', mr: 0.5, lineHeight: 0 }}
      >
        <NameAvatar name={name} size={size} />
      </Box>
      {quoted ? '“' : null}
      <bdi dir="auto" style={strong ? { fontWeight: 600 } : undefined}>
        <MarkedName name={name}>{visibleName(name)}</MarkedName>
      </bdi>
      {quoted ? '”' : null}
      {suffix}
    </Box>
  );
}
