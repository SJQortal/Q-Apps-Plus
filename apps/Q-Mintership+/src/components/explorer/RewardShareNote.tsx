/**
 * Under any reward share the Explorer shows: how minting worked before
 * Oct 2024, and Q-Minter's history page, which explains reward shares for
 * anyone new to them (Simon, 2026-10-16).
 */
import { Box, Typography } from '@mui/material';
import { Q_MINTER_HISTORY_LINK } from '../../constants/qMinter';
import { QortalLinkButton } from '../common/QortalLinks';

/** How minting worked before Oct 2024, under any reward-share link. */
export const SPONSOR_ERA_NOTE =
  'Before Oct 2024 most new accounts started minting through another account’s reward share (a sponsor). Since then MINTER membership is what counts.';

export function RewardShareNote() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.75 }}>
      <Typography variant="body2" color="text.secondary">
        {SPONSOR_ERA_NOTE}
      </Typography>
      <QortalLinkButton link={Q_MINTER_HISTORY_LINK} label="How reward shares worked: Q-Minter" />
    </Box>
  );
}
