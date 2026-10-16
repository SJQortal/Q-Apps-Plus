/**
 * The accounts a sponsor sponsored, one row each: the account (its name
 * opens it in the Explorer), when it was sponsored and at what percent,
 * whether the share was removed, where it stands in MINTER now (from the
 * cached member list and the app's own ban check), whether it mints now,
 * and its level and any minting penalty (its account read once the row
 * nears the screen). A checkbox picks it for Compare (up to 4).
 * Neutral chips: no colour says good or bad.
 */
import { useState } from 'react';
import { Box, Checkbox, Typography } from '@mui/material';
import { PersonChip } from '../../../components/common/Person';
import { ToneChip } from '../../../components/common/Section';
import { getAccount } from '../../../data/accounts';
import type { SponseeRow } from '../../../data/explorer/sets';
import { useDisplayName } from '../../../hooks/useDisplayName';
import { useInView } from '../../../hooks/useInView';
import { useQuery } from '../../../hooks/useQuery';
import { formatCount, formatDate, plural } from '../../../utils/format';

export const SET_LIST_SX = {
  listStyle: 'none',
  m: 0,
  p: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 1.5,
} as const;

function Fact({ label }: { label: string }) {
  return (
    <li>
      <ToneChip size="small" variant="outlined" label={label} sx={{ fontSize: 14 }} />
    </li>
  );
}

export interface SponseeRowProps {
  row: SponseeRow;
  /** The member list is loaded, so "Not in MINTER" can be said. */
  membersKnown: boolean;
  picked: boolean;
  /** Four are picked and this one isn't. */
  full: boolean;
  onPick: (address: string, picked: boolean) => void;
}

export function SponseeRowItem({ row, membersKnown, picked, full, onPick }: SponseeRowProps) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const near = useInView(node);
  const account = useQuery(near ? `account:${row.address}` : null, (force) =>
    getAccount(row.address, { force })
  );
  const label = useDisplayName(row.address).label;
  const facts = [
    row.member
      ? row.member.joined
        ? `In MINTER since ${formatDate(row.member.joined)}`
        : 'In MINTER'
      : membersKnown
        ? 'Not in MINTER'
        : null,
    row.banned ? 'Banned from MINTER' : null,
    row.mintingNow ? 'Minting now' : null,
    account.data ? `Level ${account.data.level}` : null,
    account.data && account.data.blocksMintedPenalty !== 0 ? 'Minting penalty' : null,
  ].filter((fact): fact is string => fact !== null);
  return (
    <Box
      component="li"
      ref={setNode}
      sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, minWidth: 0 }}
    >
      <Checkbox
        checked={picked}
        disabled={full && !picked}
        onChange={(event) => onPick(row.address, event.target.checked)}
        slotProps={{ input: { 'aria-label': `Pick ${label} to compare` } }}
        sx={{ width: 44, height: 44, flexShrink: 0, mt: -0.25 }}
      />
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <PersonChip address={row.address} size={32} />
        <Typography sx={{ overflowWrap: 'anywhere' }}>
          Sponsored {formatDate(row.start.timestamp)} at {row.percent} % (block{' '}
          {formatCount(row.start.height)})
          {row.removal
            ? `, removed ${plural(row.blocks ?? 0, 'block')} later (block ${formatCount(row.removal.height)})`
            : ', not removed'}
          {row.shares > 1 ? `; ${formatCount(row.shares)} reward shares in all` : ''}
          {row.removal && row.active ? ', sponsored again since' : ''}
        </Typography>
        {facts.length ? (
          <Box
            component="ul"
            aria-label={`About ${label}`}
            sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}
          >
            {facts.map((fact) => (
              <Fact key={fact} label={fact} />
            ))}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
