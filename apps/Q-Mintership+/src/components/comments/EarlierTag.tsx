/**
 * Beside the writer of a comment from the nominee's earlier nomination, in
 * the place of their answer on this one (Simon, 2026-11-24: "in the place of
 * old vote make that Tag that this comment is from the previous nomination").
 * Pointing at it says when it was written and how that nomination ended;
 * pressing it (a tap, Enter) says the same with "See how it ended": the
 * decision that ended it, or History's lapsed nominations from its date.
 */
import { useId, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Popover, Tooltip, Typography } from '@mui/material';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import type { EarlierRound } from '../../rules/nomination';
import { ToneChip } from '../common/Section';
import { earlierOutcomePath, earlierTagText } from './earlierWords';

export function EarlierTag({ round, postedAt }: { round: EarlierRound; postedAt: number }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const id = useId();
  const text = earlierTagText(round, postedAt);
  return (
    <>
      <Tooltip
        // While its details are open, the tip isn't needed.
        title={anchor ? '' : text}
        describeChild
        arrow
        slotProps={{ tooltip: { sx: { fontSize: 14, lineHeight: 1.45, maxWidth: 340 } } }}
      >
        <ToneChip
          size="small"
          variant="outlined"
          icon={<HistoryOutlinedIcon aria-hidden />}
          label="Previous nomination"
          onClick={(event) => setAnchor(event.currentTarget)}
          aria-haspopup="dialog"
          aria-expanded={Boolean(anchor)}
          aria-controls={anchor ? id : undefined}
          sx={{ fontWeight: 600 }}
        />
      </Tooltip>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            id,
            role: 'dialog',
            'aria-label': 'Previous nomination',
            sx: { p: 1.5, maxWidth: 340 },
          },
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start' }}>
          <Typography variant="body2">{text}</Typography>
          <Button
            variant="outlined"
            size="small"
            component={RouterLink}
            to={earlierOutcomePath(round)}
            sx={{ minHeight: 44 }}
          >
            See how it ended
          </Button>
        </Box>
      </Popover>
    </>
  );
}
