/**
 * Every name the account owns, 20 at a time, in the order picked (primary
 * first by default: names/sortNames.ts), as a grid of cards (the default)
 * or a list (useNamesView.ts: kept on this device). Each name shows its
 * avatar, reads its own record once it nears the screen (registered,
 * updated, for sale), notes on how the name is written, and its own
 * history beside it: under the name in a card, to its right in the list
 * (under it on phones). Below, the names it had (sold, or renamed), each
 * with who has it now and its history, laid out the same way. Core's list
 * stops at 500 here, and says so.
 */
import { useState, type ReactNode } from 'react';
import { Box, Button, Skeleton, TextField, Typography } from '@mui/material';
import { visuallyHidden } from '@mui/utils';
import { Card, Section } from '../../../../components/common/Section';
import { EmptyState, ErrorState, ListSkeleton } from '../../../../components/common/states';
import { getNameData, type NamesOf } from '../../../../data/explorer/account';
import { useInView } from '../../../../hooks/useInView';
import { useQuery, type UseQueryResult } from '../../../../hooks/useQuery';
import { PersonInline } from '../../../../components/common/Person';
import type { NameHistory } from '../../../../data/explorer/nameHistory';
import type { TxRow } from '../../../../data/types';
import { historyByName, pastNames } from './byName';
import { NameHistoryList } from './NameHistoryList';
import { isNameSort, NAME_SORTS, sortNames, type NameSort } from './sortNames';
import { useNamesView, type NamesView } from './useNamesView';
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
import { FIELD_BLOCK_SX } from '../../../../components/explorer/fieldBlock';
import { ViewToggle } from '../ViewToggle';
import { StatusChip } from '../../../../components/explorer/StatusChip';

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

/**
 * One name's box: what it is on one side, its history on the other. A card
 * in the grid (history under the name); a row in the list (history to the
 * right from 600 px, under it on phones).
 */
function NameItem({
  view,
  setNode,
  about,
  history,
}: {
  view: NamesView;
  setNode: (node: HTMLLIElement | null) => void;
  about: ReactNode;
  history: ReactNode;
}) {
  const grid = view === 'grid';
  return (
    <Box
      component="li"
      ref={setNode}
      tabIndex={-1}
      sx={{
        display: 'grid',
        gap: grid ? 1.5 : { xs: 1, sm: 3 },
        alignContent: 'start',
        minWidth: 0,
        ...(grid
          ? {
              gridTemplateColumns: 'minmax(0, 1fr)',
              p: 2,
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
              bgcolor: 'background.paper',
            }
          : {
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                sm: 'minmax(0, 2fr) minmax(0, 3fr)',
              },
              py: 1.5,
              borderTop: 1,
              borderColor: 'divider',
              '&:first-of-type': { borderTop: 0, pt: 0 },
            }),
        ...FOCUSABLE_ROW_SX,
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}>{about}</Box>
      {/* Its history on a panel of its own (fieldBlock.ts). */}
      <Box sx={FIELD_BLOCK_SX}>{history}</Box>
    </Box>
  );
}

/** The list sits in a card; the grid's cards stand on their own. */
function NamesFrame({ view, children }: { view: NamesView; children: ReactNode }) {
  return view === 'list' ? <Card>{children}</Card> : <>{children}</>;
}

/** The list of names in the view picked. */
function itemsSx(view: NamesView) {
  return view === 'grid'
    ? {
        listStyle: 'none',
        m: 0,
        p: 0,
        display: 'grid',
        gap: 1.5,
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))',
      }
    : { listStyle: 'none', m: 0, p: 0 };
}

/** Sort and Grid/List, above the names. */
function NamesControls({
  sort,
  onSort,
  view,
  onView,
}: {
  sort: NameSort;
  onSort: (sort: NameSort) => void;
  view: NamesView;
  onView: (view: NamesView) => void;
}) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
      <TextField
        select
        label="Sort"
        size="small"
        value={sort}
        onChange={(e) => {
          if (isNameSort(e.target.value)) onSort(e.target.value);
        }}
        slotProps={{ select: { native: true } }}
        sx={{ flex: '1 1 200px', maxWidth: { sm: 260 }, '& .MuiInputBase-root': { minHeight: 44 } }}
      >
        {NAME_SORTS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </TextField>
      <ViewToggle view={view} onView={onView} label="Show the names as" />
    </Box>
  );
}

/** A name it had: its avatar, who has it now, and its history. */
function PastNameRow({
  name,
  address,
  txs,
  view,
}: {
  name: string;
  address: string;
  txs: readonly TxRow[];
  view: NamesView;
}) {
  const [node, setNode] = useState<HTMLLIElement | null>(null);
  const near = useInView(node);
  return (
    <NameItem
      view={view}
      setNode={setNode}
      about={
        <>
          <NameHead name={name} />
          <NowOwnedBy name={name} near={near} address={address} />
        </>
      }
      history={<NameHistoryList name={name} txs={txs} address={address} />}
    />
  );
}

/** A name's avatar and the name, and "Primary" on the primary one. */
function NameHead({ name, primary = false }: { name: string; primary?: boolean }) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, minWidth: 0 }}>
      <NameAvatar name={name} size={40} />
      <Typography
        component="span"
        sx={{
          fontWeight: 700,
          fontSize: 17,
          overflowWrap: 'anywhere',
          minWidth: 0,
          flex: '0 1 auto',
        }}
      >
        <NameText name={name} quoted={false} avatar={false} />
      </Typography>
      {primary ? <StatusChip label="Primary" kind="primary" /> : null}
    </Box>
  );
}

function NameRow({
  name,
  address,
  primary,
  txs,
  view,
}: {
  name: string;
  address: string;
  primary: boolean;
  /** Its transactions about this name; undefined while they load or when they couldn't be read. */
  txs: readonly TxRow[] | undefined;
  view: NamesView;
}) {
  const [node, setNode] = useState<HTMLLIElement | null>(null);
  const near = useInView(node);
  const notes = nameNotes(name, address);
  return (
    <NameItem
      view={view}
      setNode={setNode}
      about={
        <>
          <NameHead name={name} primary={primary} />
          <NameDetails name={name} near={near} />
          {notes.map((note) => (
            <Typography key={note.kind} variant="body2" sx={{ overflowWrap: 'anywhere' }}>
              {note.text}
            </Typography>
          ))}
        </>
      }
      history={<NameHistoryList name={name} txs={txs} address={address} />}
    />
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
  const [sort, setSort] = useState<NameSort>('primary');
  const [view, setView] = useNamesView();
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
    const ordered = sortNames(all, sort, primary, byName);
    const visible = ordered.slice(0, shown);
    const left = ordered.length - visible.length;
    body = (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
        {all.length > 1 ? (
          <NamesControls sort={sort} onSort={setSort} view={view} onView={setView} />
        ) : null}
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
        <NamesFrame view={view}>
          <Box component="ul" ref={listRef} aria-label="Its names" sx={itemsSx(view)}>
            {visible.map((name) => (
              <NameRow
                key={name}
                name={name}
                address={address}
                primary={hasPrimary && name === primary}
                txs={byName ? (byName.get(name) ?? []) : undefined}
                view={view}
              />
            ))}
          </Box>
        </NamesFrame>
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
      </Box>
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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary">
              Names it sold, or renamed to something else.
            </Typography>
            <NamesFrame view={view}>
              <Box component="ul" aria-label="Names it had" sx={itemsSx(view)}>
                {had.map((name) => (
                  <PastNameRow
                    key={name}
                    name={name}
                    address={address}
                    txs={byName.get(name) ?? []}
                    view={view}
                  />
                ))}
              </Box>
            </NamesFrame>
          </Box>
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
