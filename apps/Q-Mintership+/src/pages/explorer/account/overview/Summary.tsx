/**
 * The Overview's first line: the account in one sentence, "Level 7 · in
 * MINTER since Mar 2024 · owns 88 names · first seen Oct 2021 · last sent a
 * transaction 3 days ago". A part that has a tab links to it (MINTER →
 * Mintership, names → Names). Parts still loading show as a short skeleton
 * at the end; a part that failed is left out (its own section says so and
 * offers Retry). An account that never sent anything has no "last sent".
 */
import { Fragment, type ReactNode } from 'react';
import { Box, Skeleton, Typography } from '@mui/material';
import { visuallyHidden } from '@mui/utils';
import type { FirstSeen, NamesOf } from '../../../../data/explorer/account';
import type { LastSent } from '../../../../data/explorer/lastSent';
import type { MyStatus } from '../../../../rules/status';
import {
  firstSeenPart,
  lastSentPart,
  levelPart,
  minterPart,
  namesPart,
  NO_NAMES_PART,
} from './overviewWords';
import { TabLink } from './TabLink';

/** undefined while loading, null when it failed or doesn't apply. */
type Part<T> = T | null | undefined;

export function Summary({
  address,
  level,
  status,
  memberSince,
  names,
  firstSeen,
  lastSent,
}: {
  address: string;
  level: number;
  status: Part<MyStatus>;
  memberSince: number | null;
  names: Part<NamesOf>;
  firstSeen: Part<FirstSeen>;
  lastSent: Part<LastSent>;
}) {
  const parts: Array<{ key: string; node: ReactNode }> = [{ key: 'level', node: levelPart(level) }];
  if (status)
    parts.push({
      key: 'minter',
      node: (
        <TabLink address={address} tab="mintership">
          {minterPart(status, memberSince)}
        </TabLink>
      ),
    });
  if (names) {
    const owns = namesPart(names);
    parts.push({
      key: 'names',
      node: owns ? (
        <TabLink address={address} tab="names">
          {owns}
        </TabLink>
      ) : (
        NO_NAMES_PART
      ),
    });
  }
  if (firstSeen?.firstSeen)
    parts.push({ key: 'first', node: firstSeenPart(firstSeen.firstSeen.timestamp) });
  if (lastSent) parts.push({ key: 'last', node: lastSentPart(lastSent.timestamp) });
  const loading = [status, names, firstSeen, lastSent].some((part) => part === undefined);
  return (
    <Typography component="p" sx={{ m: 0, fontSize: 17, overflowWrap: 'anywhere' }}>
      {parts.map((part, i) => (
        <Fragment key={part.key}>
          {i > 0 ? ' · ' : null}
          {part.node}
        </Fragment>
      ))}
      {loading ? (
        <>
          {' · '}
          <Skeleton
            variant="text"
            width={120}
            aria-hidden
            sx={{ display: 'inline-block', verticalAlign: 'middle' }}
          />
          <Box component="span" sx={visuallyHidden}>
            Loading more
          </Box>
        </>
      ) : null}
    </Typography>
  );
}
