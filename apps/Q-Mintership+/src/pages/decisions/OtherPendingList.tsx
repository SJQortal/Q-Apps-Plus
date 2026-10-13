/**
 * Minter Admins only: pending transactions that wait for MINTER's admins
 * but aren't MINTER group changes. Read-only, with no Sign button.
 */
import { Box, Typography } from '@mui/material';
import type { ChainNow } from '../../data/chain';
import type { OtherPending } from '../../rules/decision';
import { PersonChip } from '../../components/common/Person';
import { Card } from '../../components/common/Section';
import { formatRelative } from '../../utils/format';
import { decisionCardId } from './decisionUi';

export function OtherPendingList({ items, now }: { items: OtherPending[]; now: ChainNow }) {
  return (
    <Box
      component="ul"
      aria-label="Other transactions waiting for Minter Admins"
      sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}
    >
      {items.map((item) => (
        <Card
          as="li"
          key={item.signature}
          id={decisionCardId(item.signature)}
          tabIndex={-1}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            scrollMarginTop: 'calc(var(--qmp-header-offset, 0px) + 16px)',
          }}
        >
          <Typography sx={{ fontWeight: 700 }}>
            {item.label}
            {item.groupId !== null ? ` · group ${item.groupId}` : ''}
            <Typography component="span" variant="body2" color="text.secondary">
              {' '}
              · {formatRelative(item.createdAt, now.timestamp)}
            </Typography>
          </Typography>
          {item.creatorAddress ? (
            <PersonChip address={item.creatorAddress} size={32} secondary="Sender" />
          ) : null}
          <Typography variant="body2">
            Not a MINTER group change, so it can’t be signed here.
          </Typography>
        </Card>
      ))}
    </Box>
  );
}
