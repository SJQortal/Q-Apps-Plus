/**
 * Every name the account owns: the primary one first (marked "Primary"),
 * then Core's order (when each was registered), 20 at a time. Each row
 * shows the name's avatar, reads its own record once it nears the screen
 * (registered, updated, for sale), shows notes on how the name is written,
 * and opens to its own history ("History · 3"). Below, the names it had
 * (sold, or renamed), each with who has it now and the same history. Core's
 * list stops at 500 here, and says so.
 */
import { useState } from 'react';
import { Box, Button, Skeleton, Typography } from '@mui/material';
import { visuallyHidden } from '@mui/utils';
import { Card, Section, ToneChip } from '../../../../components/common/Section';
import { EmptyState, ErrorState, ListSkeleton } from '../../../../components/common/states';
import { getNameData, type NamesOf } from '../../../../data/explorer/account';
import { useInView } from '../../../../hooks/useInView';
import { useQuery, type UseQueryResult } from '../../../../hooks/useQuery';
import { PersonInline } from '../../../../components/common/Person';
import type { NameHistory } from '../../../../data/explorer/nameHistory';
import type { TxRow } from '../../../../data/types';
import { historyByName, pastNames } from './byName';
import { NameHistoryToggle } from './NameHistoryToggle';
import { nameNotes } from '../../../../rules/explorer/nameNotes';
import { NameAvatar } from '../../../../components/common/NameAvatar';
import { NameText } from './NameText';
import {
  historyCoverage,
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

/** Who has a name the account no longer owns ("Now owned by Nora"), once the row is near. */
function NowOwnedBy({ name, near, address }: { name: string; near: boolean; address: string }) {
  const data = useQuery(near ? `xnamedata:${name}` : null, () => getNameData(name));
  if (data.isError && data.data === undefined)
    return (
      <ErrorState
        compact
        title="Couldn't read who has this name now."
        error={data.error}
        onRetry={() => void data.refetch()}
      />
    );
  if (data.data === undefined)
    return (
      <Typography variant="body2" component="div">
        <Skeleton variant="text" width="40%" aria-hidden />
        <Box component="span" sx={visuallyHidden}>
          Reading who has this name now
        </Box>
      </Typography>
    );
  if (data.data === null)
    return (
      <Typography variant="body2" color="text.secondary">
        No one has this name now.
      </Typography>
    );
  if (data.data.owner === address)
    return (
      <Typography variant="body2" color="text.secondary">
        Its own again.
      </Typography>
    );
  return (
    <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
      Now owned by <PersonInline address={data.data.owner} />
    </Typography>
  );
}

/** A name it had: its avatar, who has it now, and its history. */
function PastNameRow({
  name,
  address,
  txs,
}: {
  name: string;
  address: string;
  txs: readonly TxRow[];
}) {
  const [node, setNode] = useState<HTMLLIElement | null>(null);
  const near = useInView(node);
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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        <NameAvatar name={name} size={32} />
        <Typography
          component="span"
          sx={{ fontWeight: 700, fontSize: 17, overflowWrap: 'anywhere', minWidth: 0 }}
        >
          <NameText name={name} quoted={false} avatar={false} />
        </Typography>
      </Box>
      <NowOwnedBy name={name} near={near} address={address} />
      <NameHistoryToggle name={name} txs={txs} address={address} />
    </Box>
  );
}

function NameRow({
  name,
  address,
  primary,
  txs,
}: {
  name: string;
  address: string;
  primary: boolean;
  /** Its transactions about this name; undefined while they load or when they couldn't be read. */
  txs: readonly TxRow[] | undefined;
}) {
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
        <NameAvatar name={name} size={32} />
        <Typography
          component="span"
          sx={{ fontWeight: 700, fontSize: 17, overflowWrap: 'anywhere', minWidth: 0 }}
        >
          <NameText name={name} quoted={false} avatar={false} />
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
      {txs && txs.length ? <NameHistoryToggle name={name} txs={txs} address={address} /> : null}
    </Box>
  );
}

export function NamesList({
  address,
  names,
  primary,
  primaryError,
  history,
}: {
  address: string;
  names: UseQueryResult<NamesOf>;
  /** Its name transactions (one read), which each name's history comes from. */
  history: UseQueryResult<NameHistory>;
  /** undefined while loading; null for none (or when it couldn't be read). */
  primary: string | null | undefined;
  /** The primary name couldn't be read: said, with Retry, never as "No primary name". */
  primaryError?: { error: unknown; retry: () => void };
}) {
  const { shown, showMore, listRef } = useShowMore(NAMES_PAGE);
  const byName = history.data ? historyByName(history.data.rows) : null;

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
            <NameRow
              key={name}
              name={name}
              address={address}
              primary={hasPrimary && i === 0}
              txs={byName ? (byName.get(name) ?? []) : undefined}
            />
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
        <HistoryState history={history} />
      </Card>
    );
  }
  // The names it had: only once its history is read (a name it never owned now can't be listed otherwise).
  const had =
    byName && names.data && !names.data.truncated ? pastNames(byName, names.data.names) : [];
  return (
    <>
      <Section title={namesTitle(names.data)} id="names-list">
        {body}
      </Section>
      {had.length && byName ? (
        <Section title={`Names it had (${had.length})`} id="names-had">
          <Card sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Names it sold, or renamed to something else.
            </Typography>
            <Box component="ul" aria-label="Names it had" sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {had.map((name) => (
                <PastNameRow
                  key={name}
                  name={name}
                  address={address}
                  txs={byName.get(name) ?? []}
                />
              ))}
            </Box>
          </Card>
        </Section>
      ) : null}
    </>
  );
}

/** How far each name's history goes: a line when the read was capped, an error with Retry, a quiet loader. */
function HistoryState({ history }: { history: UseQueryResult<NameHistory> }) {
  if (history.isError && !history.data)
    return (
      <ErrorState
        compact
        title="Couldn't load its name history."
        error={history.error}
        onRetry={() => void history.refetch()}
      />
    );
  if (!history.data)
    return (
      <Typography variant="body2" color="text.secondary" role="status">
        Reading its name history…
      </Typography>
    );
  return history.data.capped ? (
    <Typography variant="body2" color="text.secondary">
      {historyCoverage(history.data.rows.length, true)}
    </Typography>
  ) : null;
}
