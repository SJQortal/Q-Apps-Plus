/**
 * Every name the account owns: the primary one first (marked "Primary"),
 * then Core's order (when each was registered), 20 at a time. Each row
 * reads its name's own record once it nears the screen (registered,
 * updated, for sale) and shows notes on how the name is written. The names
 * are plain text: they are this account's. Core's list stops at 500 here,
 * and says so.
 */
import { useState } from 'react';
import { Box, Button, Skeleton, Typography } from '@mui/material';
import { visuallyHidden } from '@mui/utils';
import { Card, Section, ToneChip } from '../../../../components/common/Section';
import { EmptyState, ErrorState, ListSkeleton } from '../../../../components/common/states';
import { getNameData, type NamesOf } from '../../../../data/explorer/account';
import { useInView } from '../../../../hooks/useInView';
import { useQuery, type UseQueryResult } from '../../../../hooks/useQuery';
import { nameNotes } from '../../../../rules/explorer/nameNotes';
import { NameText } from './NameText';
import {
  NO_NAMES,
  NO_PRIMARY,
  nameDataParts,
  namesTitle,
  showMoreWords,
  truncatedLine,
} from './namesWords';
import { FOCUSABLE_ROW_SX, useShowMore } from './useShowMore';

/** Names shown at first, and added by each "Show more". */
export const NAMES_PAGE = 20;

function NameDetails({ name, near }: { name: string; near: boolean }) {
  const data = useQuery(near ? `xnamedata:${name}` : null, () => getNameData(name));
  if (data.isError && data.data === undefined)
    return (
      <ErrorState
        compact
        title="Couldn't load this name's record."
        error={data.error}
        onRetry={() => void data.refetch()}
      />
    );
  if (data.data === undefined)
    return (
      <Typography variant="body2" component="div">
        <Skeleton variant="text" width="55%" aria-hidden />
        <Box component="span" sx={visuallyHidden}>
          Loading this name's record
        </Box>
      </Typography>
    );
  const parts = data.data ? nameDataParts(data.data) : ['Core has no record of this name now.'];
  return (
    <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
      {parts.join(' · ')}
    </Typography>
  );
}

function NameRow({ name, address, primary }: { name: string; address: string; primary: boolean }) {
  const [node, setNode] = useState<HTMLLIElement | null>(null);
  const near = useInView(node);
  const notes = nameNotes(name, address);
  return (
    <Box
      component="li"
      ref={setNode}
      tabIndex={-1}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        py: 1.25,
        borderTop: 1,
        borderColor: 'divider',
        minWidth: 0,
        '&:first-of-type': { borderTop: 0, pt: 0 },
        ...FOCUSABLE_ROW_SX,
      }}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, minWidth: 0 }}>
        <Typography
          component="span"
          sx={{ fontWeight: 700, fontSize: 17, overflowWrap: 'anywhere', minWidth: 0 }}
        >
          <NameText name={name} quoted={false} />
        </Typography>
        {primary ? (
          <ToneChip size="small" variant="outlined" label="Primary" sx={{ fontSize: 14 }} />
        ) : null}
      </Box>
      <NameDetails name={name} near={near} />
      {notes.map((note) => (
        <Typography key={note.kind} variant="body2" sx={{ overflowWrap: 'anywhere' }}>
          {note.text}
        </Typography>
      ))}
    </Box>
  );
}

export function NamesList({
  address,
  names,
  primary,
  primaryError,
}: {
  address: string;
  names: UseQueryResult<NamesOf>;
  /** undefined while loading; null for none (or when it couldn't be read). */
  primary: string | null | undefined;
  /** The primary name couldn't be read: said, with Retry, never as "No primary name". */
  primaryError?: { error: unknown; retry: () => void };
}) {
  const { shown, showMore, listRef } = useShowMore(NAMES_PAGE);

  let body: React.ReactNode;
  if (names.isError && !names.data)
    body = (
      <ErrorState
        title="Couldn't load its names."
        error={names.error}
        onRetry={() => void names.refetch()}
      />
    );
  else if (!names.data || primary === undefined)
    body = <ListSkeleton count={2} label="Loading its names" />;
  else if (!names.data.names.length) body = <EmptyState title={NO_NAMES} />;
  else {
    const all = names.data.names;
    const hasPrimary = primary !== null && all.includes(primary);
    const ordered = hasPrimary ? [primary, ...all.filter((n) => n !== primary)] : all;
    const visible = ordered.slice(0, shown);
    const left = ordered.length - visible.length;
    body = (
      <Card sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {primaryError ? (
          <ErrorState
            compact
            title="Couldn't read its primary name."
            error={primaryError.error}
            onRetry={primaryError.retry}
          />
        ) : !hasPrimary ? (
          <Typography variant="body2" color="text.secondary">
            {NO_PRIMARY}
          </Typography>
        ) : null}
        <Box
          component="ul"
          ref={listRef}
          aria-label="Its names"
          sx={{ listStyle: 'none', m: 0, p: 0 }}
        >
          {visible.map((name, i) => (
            <NameRow key={name} name={name} address={address} primary={hasPrimary && i === 0} />
          ))}
        </Box>
        {left > 0 ? (
          <Button onClick={showMore} sx={{ alignSelf: 'flex-start', minHeight: 44 }}>
            {showMoreWords(left, NAMES_PAGE)}
          </Button>
        ) : null}
        {names.data.truncated ? (
          <Typography variant="body2" color="text.secondary">
            {truncatedLine(all.length)}
          </Typography>
        ) : null}
      </Card>
    );
  }
  return (
    <Section title={namesTitle(names.data)} id="names-list">
      {body}
    </Section>
  );
}
