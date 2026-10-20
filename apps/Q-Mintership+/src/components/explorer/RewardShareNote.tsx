/**
 * Under any reward share the Explorer shows: how minting worked before
 * Oct 2024, and Q-Minter's history page, which explains reward shares for
 * anyone new to them (Simon, 2026-10-16). The words on the left, the button
 * to their right (Simon, 2026-10-17); stacked on phones.
 */
import { Box, Typography } from '@mui/material';
import { Q_MINTER_HISTORY_LINK } from '../../constants/qMinter';
import { QortalLinkButton } from '../common/QortalLinks';

/** How minting worked before Oct 2024, under any reward-share link. */
export const SPONSOR_ERA_NOTE =
  'Before Oct 2024 most new accounts started minting through another account’s reward share (a sponsor). Since then MINTER membership is what counts.';

export function RewardShareNote() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'flex-start', sm: 'center' },
        gap: { xs: 0.75, sm: 2 },
      }}
    >
      <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 0 }}>
        {SPONSOR_ERA_NOTE}
      </Typography>
      <Box sx={{ flexShrink: 0 }}>
        <QortalLinkButton link={Q_MINTER_HISTORY_LINK} label="How reward shares worked: Q-Minter" />
      </Box>
    </Box>
  );
}
