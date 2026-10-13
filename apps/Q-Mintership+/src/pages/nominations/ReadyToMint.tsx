/**
 * Ready to mint (`/nominations?show=ready`): the people who asked to join
 * MINTER, for everyone to see, so nominators can find them. Level 5+ members
 * and Minter Admins get Nominate on each row, or Add your support where an
 * open nomination already exists. Twenty rows at a time, in Core's order;
 * each row's level, blocks minted and name are read only once it is shown.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Skeleton, Typography } from '@mui/material';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import { PersonChip } from '../../components/common/Person';
import { Section } from '../../components/common/Section';
import { EmptyState, ErrorState, ListSkeleton } from '../../components/common/states';
import { effectiveBlocksMinted } from '../../data/accounts';
import type { Nomination } from '../../data/nominations';
import { READY_PAGE, loadReadyDetails, type ReadyToMint } from '../../data/readyToMint';
import type { AccountInfo } from '../../data/types';
import type { UseQueryResult } from '../../hooks/useQuery';
import { nominatePath } from '../../routes/paths';
import { displayName, formatCount } from '../../utils/format';
import { readable } from '../../utils/readable';
import { usePendingWrite, writeKeys } from '../../writes/optimistic';
import { isStillOpenForSupport, myPart } from './filters';
import { useStoredValue } from './useReadyToMint';

export interface ReadyToMintSectionProps {
  ready: UseQueryResult<ReadyToMint>;
  /** Open nominations by nominee; null until they load (no actions until then). */
  open: Map<string, Nomination> | null;
  me: string;
  canNominate: boolean;
  /** Can publish a support record (eligible, with a name). */
  canSupport: boolean;
  onSupport: (n: Nomination) => void;
}

export function ReadyToMintSection({
  ready,
  open,
  me,
  canNominate,
  canSupport,
  onSupport,
}: ReadyToMintSectionProps) {
  const [shown, setShown] = useState(READY_PAGE);
  const listRef = useRef<HTMLUListElement | null>(null);
  const focusRow = useRef<number | null>(null);
  const people = ready.data?.people;
  const visible = people ? people.slice(0, shown) : [];
  const visibleKey = visible.join(',');

  // Only the rows on screen are read, six reads at a time; leaving stops new reads.
  // Each refresh of the list (every minute, or Refresh) reads again the rows whose
  // read failed or is older than 10 minutes; the rest are cached and cost nothing.
  const listUpdatedAt = ready.updatedAt;
  useEffect(() => {
    if (!visibleKey) return;
    const controller = new AbortController();
    void loadReadyDetails(visibleKey.split(','), { signal: controller.signal });
    return () => controller.abort();
  }, [visibleKey, listUpdatedAt]);

  // After "Show more", focus moves to the first new row.
  useEffect(() => {
    if (focusRow.current === null) return;
    listRef.current?.children[focusRow.current]?.querySelector<HTMLElement>('a, button')?.focus();
    focusRow.current = null;
  }, [shown]);

  let body: ReactNode;
  if (!people && ready.isError) {
    body = (
      <ErrorState
        title="Couldn’t load the people ready to mint."
        error={ready.error}
        onRetry={() => void ready.refetch()}
      />
    );
  } else if (!people) {
    body = <ListSkeleton count={3} label="Loading the people ready to mint" />;
  } else if (people.length === 0) {
    body = (
      <EmptyState
        title="No one has asked to join right now"
        description="When someone sends MINTER a join request, they show up here, ready for a nomination."
      />
    );
  } else {
    const left = people.length - visible.length;
    body = (
      <>
        <Box
          component="ul"
          ref={listRef}
          aria-label="Ready to mint"
          sx={{
            listStyle: 'none',
            m: 0,
            p: 0,
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'background.paper',
          }}
        >
          {visible.map((address) => (
            <ReadyRow
              key={address}
              address={address}
              nomination={open ? (open.get(address) ?? null) : undefined}
              me={me}
              canNominate={canNominate}
              canSupport={canSupport}
              onSupport={onSupport}
            />
          ))}
        </Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: 1.5,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {formatCount(visible.length)} of {formatCount(people.length)} shown
          </Typography>
          {left > 0 ? (
            <Button
              variant="outlined"
              onClick={() => {
                focusRow.current = visible.length;
                setShown(shown + READY_PAGE);
              }}
              sx={{ minHeight: 44 }}
            >
              Show {formatCount(Math.min(READY_PAGE, left))} more
            </Button>
          ) : null}
        </Box>
        {ready.data?.truncated ? (
          <Typography variant="body2" color="text.secondary" role="note" sx={{ px: 0.5 }}>
            The member list was too long to read in full, so someone here may already be a member.
          </Typography>
        ) : null}
      </>
    );
  }

  return (
    <Section title="Ready to mint" id="ready">
      <Typography variant="body2" color="text.secondary" sx={{ px: 0.5 }}>
        People who asked to join MINTER. They need a nomination from a level 5+ minter or a Minter
        Admin. Join requests carry no date, so this is the order your node lists them in.
      </Typography>
      {body}
    </Section>
  );
}

function blocksMintedText(blocks: number): string {
  if (blocks <= 0) return 'no blocks minted yet';
  return `${formatCount(blocks)} ${blocks === 1 ? 'block' : 'blocks'} minted`;
}

/** One person: avatar, name or short address (to their page), level and blocks minted, the action. */
function ReadyRow({
  address,
  nomination,
  me,
  canNominate,
  canSupport,
  onSupport,
}: {
  address: string;
  /** Their open nomination, null for none, undefined while the nominations load. */
  nomination: Nomination | null | undefined;
  me: string;
  canNominate: boolean;
  canSupport: boolean;
  onSupport: (n: Nomination) => void;
}) {
  const navigate = useNavigate();
  const account = useStoredValue<AccountInfo>(`account:${address}`);
  const name = useStoredValue<string | null>(`name:${address}`);
  const supportPending = usePendingWrite(nomination ? writeKeys.support(address) : null);
  const nominatePending = usePendingWrite(writeKeys.nominate(address));
  // Never undefined: PersonChip would look the name up itself, outside the six-at-a-time reads.
  const shownName = name.data ?? null;
  const label = displayName(shownName, address);

  const secondary = account.data ? (
    `Level ${account.data.level} · ${blocksMintedText(effectiveBlocksMinted(account.data))}`
  ) : account.status === 'error' ? (
    'Level not available right now'
  ) : (
    <Skeleton variant="text" width={180} aria-hidden />
  );

  // `mine`: something the signed-in member did (green, with a tick); otherwise a plain fact.
  let done: { label: string; live: boolean; mine: boolean } | null = null;
  let action: ReactNode = null;
  if (address === me) {
    done = { label: 'That’s you', live: false, mine: false };
  } else if (nomination) {
    const part = myPart(nomination, me, supportPending);
    if (part) done = { label: part.label, live: part.inFlight, mine: true };
    else {
      done = {
        label: nomination.state === 'approved' ? 'Approved' : 'Nominated',
        live: false,
        mine: false,
      };
      if (canSupport && isStillOpenForSupport(nomination)) {
        action = (
          <Button
            variant="outlined"
            onClick={() => onSupport(nomination)}
            aria-label={`Add your support for ${label}`}
            sx={{ minHeight: 44 }}
          >
            Add your support
          </Button>
        );
      }
    }
  } else if (nominatePending && nominatePending.status !== 'failed') {
    done = {
      label: nominatePending.status === 'sending' ? 'Sending…' : 'Nomination sent ✓ (confirming…)',
      live: true,
      mine: true,
    };
  } else if (nomination === null && canNominate) {
    action = (
      <Button
        variant="outlined"
        onClick={() => navigate(nominatePath(address))}
        aria-label={`Nominate ${label}`}
        sx={{ minHeight: 44 }}
      >
        Nominate
      </Button>
    );
  }

  return (
    <Box
      component="li"
      sx={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        columnGap: 2,
        rowGap: 1,
        px: { xs: 1.5, sm: 2 },
        py: 1.25,
        minHeight: 64,
        '& + &': { borderTop: 1, borderColor: 'divider' },
      }}
    >
      <Box sx={{ flex: '1 1 220px', minWidth: 0 }}>
        <PersonChip address={address} name={shownName} size={40} secondary={secondary} />
      </Box>
      {done || action ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            gap: 1,
            ml: 'auto',
          }}
        >
          {done ? (
            <Typography
              variant="body2"
              role={done.live ? 'status' : undefined}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                color: done.mine ? readable('success') : 'text.secondary',
                fontWeight: done.mine ? 400 : 600,
              }}
            >
              {done.mine ? (
                <CheckCircleOutlineOutlinedIcon aria-hidden sx={{ fontSize: 18 }} />
              ) : null}
              {done.label}
            </Typography>
          ) : null}
          {action}
        </Box>
      ) : null}
    </Box>
  );
}
