/**
 * Minter Admins only: MINTER transactions flagged by the integrity check,
 * listed with a neutral label and no Sign button.
 */
import { Box, Typography } from '@mui/material';
import type { ChainNow } from '../../data/chain';
import { decisionTitle, type Decision } from '../../rules/decision';
import { PersonChip } from '../../components/common/Person';
import { Card } from '../../components/common/Section';
import { formatRelative } from '../../utils/format';

export function UnusualList({ decisions, now }: { decisions: Decision[]; now: ChainNow }) {
  return (
    <Box
      component="ul"
      aria-label="Unusual approval route"
      sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}
    >
      {decisions.map((d) => (
        <Card
          as="li"
          key={d.signature}
          sx={{ display: 'flex', flexDirection: 'column', gap: 1, borderColor: 'warning.main' }}
        >
          <Typography sx={{ fontWeight: 700 }}>
            {decisionTitle(d)}
            <Typography component="span" variant="body2" color="text.secondary">
              {' '}
              · {formatRelative(d.createdAt, now.timestamp)}
            </Typography>
          </Typography>
          {d.subject ? <PersonChip address={d.subject} size={32} /> : null}
          <Typography variant="body2">
            This one can’t be approved here. Check it with the other Minter Admins.
          </Typography>
        </Card>
      ))}
    </Box>
  );
}
