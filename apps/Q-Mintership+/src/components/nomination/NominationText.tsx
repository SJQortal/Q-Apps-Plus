/**
 * A nomination's reason and links, or, when its text wasn't read on this
 * node, a note in their place saying why: its nominator is on the node's
 * block list (Core never fetches a blocked name's data), or the node hasn't
 * got it yet. Who nominated whom, and when, show above it either way (Simon,
 * 2026-11-25: Minter Admins who block a nominator still see the nomination).
 */
import BlockOutlined from '@mui/icons-material/BlockOutlined';
import HourglassEmptyOutlined from '@mui/icons-material/HourglassEmptyOutlined';
import { Box, Typography } from '@mui/material';
import type { NominationEntry } from '../../data/nominations';
import { FramedText } from '../common/FramedText';

export function NominationText({
  entry,
  compact = false,
}: {
  entry: NominationEntry;
  /** Three lines at most, no button (compact cards). */
  compact?: boolean;
}) {
  if (!entry.unread)
    return (
      <FramedText
        text={entry.record.reason}
        links={entry.record.links}
        moreLabel="Show the whole reason"
        compact={compact}
      />
    );
  const blocked = entry.unread === 'blocked';
  const Icon = blocked ? BlockOutlined : HourglassEmptyOutlined;
  const name = <bdi>{entry.publisher.name}</bdi>;
  return (
    <Box
      role="note"
      sx={(theme) => ({
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
        minWidth: 0,
        px: { xs: 1.25, sm: 1.5 },
        py: 1,
        border: 1,
        borderStyle: 'dashed',
        borderColor: 'divider',
        borderRadius: `${theme.shape.borderRadius}px`,
      })}
    >
      <Icon fontSize="small" aria-hidden sx={{ mt: 0.25, color: 'text.secondary' }} />
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ minWidth: 0, overflowWrap: 'anywhere' }}
      >
        {blocked ? (
          <>
            {name} is blocked on your node, so your node doesn’t fetch the text of this
            nomination. To read it, unblock {name} in Hub’s Blocked users.
          </>
        ) : (
          'The text of this nomination isn’t on your node yet. It shows here when it arrives.'
        )}
      </Typography>
    </Box>
  );
}
