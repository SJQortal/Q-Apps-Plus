/**
 * A Minter Profile's actions, on the Explorer's Minter Profile tab (Simon,
 * 2026-10-17: the MINTER profile page "merged into … Minter Profile in
 * Explorer"). The Explorer itself stays read-only (eslint.config.js): these
 * come from the profile's own module, the one place in it that acts.
 *
 * - On one's own profile: Accept nomination or Join now (on the open
 *   nomination's card, or here when there is none), and Become a Minter
 *   Admin or Step down as Minter Admin.
 * - For a level 5+ member or a Minter Admin: Propose nomination for them,
 *   or Add your support to their open nomination.
 * - For a Minter Admin, while a decision about them is open: Open in
 *   Decisions.
 * - Otherwise why not, said politely: "You nominated them.", a ban to lift
 *   first, the viewer's own reason they can't nominate yet.
 */
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import type { ChainNow } from '../../data/chain';
import type { Nomination } from '../../data/nominations';
import { NominationCard } from '../../components/nomination/NominationCard';
import { NomineeAction } from '../../components/nomination/NomineeAction';
import { nomineeStep, type NomineeStep } from '../../components/nomination/nomineeStep';
import { proposeNominationFor } from '../../constants/words';
import { hasRegisteredName } from '../../data/accounts';
import { useQuery } from '../../hooks/useQuery';
import { decisionPath, nominatePath } from '../../routes/paths';
import { ownAdminRole } from '../../rules/adminChange';
import { isOpenState, NOMINEE_BLOCK_TEXT, nomineeBlock } from '../../rules/nomination';
import type { MyStatus } from '../../rules/status';
import { signerOf, useSession } from '../../state/session';
import { AdminRoleAction } from '../decisions/AdminRoleAction';

export interface ProfileFacts {
  address: string;
  /** Where the account stands in MINTER (rules/status.ts). */
  person: MyStatus;
  /** The signed-in account is this one. */
  self: boolean;
  /** Its open nomination, if any. */
  open: Nomination | null;
  /** The signed-in viewer (undefined while loading or outside Hub). */
  viewer: MyStatus | undefined;
}

/** The account's own next step on its own profile (Accept nomination, Join now), or null. */
function ownStepOf({ person, self, open }: ProfileFacts): NomineeStep {
  if (!self) return null;
  return nomineeStep({
    isMember: person.isMember,
    activeBan: Boolean(person.activeBan),
    hasJoinRequest: person.hasJoinRequest || Boolean(open?.hasJoinRequest),
    storedInvite: Boolean(person.storedInvite) || Boolean(open?.hasStoredInvite),
    state: open?.state ?? null,
    rejectedEnd: open?.decision?.phase === 'rejectedMet',
  });
}

function OwnNextStep({ facts }: { facts: ProfileFacts }) {
  const session = useSession();
  const step = ownStepOf(facts);
  if (!step) return null;
  const { open } = facts;
  return (
    <NomineeAction
      step={step}
      signer={signerOf(session)}
      needed={open?.decision?.tally?.needed ?? null}
      askWho={open?.nomination?.publisher.name ?? null}
    />
  );
}

/** What the viewer can do for the account, or why not; null when there is nothing to say. */
export function ProfileActions({ facts }: { facts: ProfileFacts }) {
  const { address, person, self, open, viewer } = facts;
  const canNominate = Boolean(viewer?.canNominate);
  // A nominee needs a registered name: its primary one, else one light read (only when it matters).
  const named = useQuery(
    canNominate && !person.name && !open ? `hasname:${address}` : null,
    (force) => hasRegisteredName(address, { force })
  );
  const hasName = person.name ? true : named.data;
  const block = nomineeBlock({
    self,
    isMember: person.isMember,
    activeBan: Boolean(person.activeBan),
    openNomination: Boolean(open),
    pendingInvite: Boolean(open?.decision),
    storedInvite: Boolean(person.storedInvite),
    hasName,
  });
  const signedIn = viewer && viewer.kind !== 'outsideHub' && viewer.kind !== 'signedOut';
  // The viewer's own part in an open nomination, if they have one.
  const mine = viewer?.address
    ? open?.nomination?.publisher.address === viewer.address
      ? 'You nominated them.'
      : open?.supporters.some((s) => s.publisher.address === viewer.address)
        ? 'You support this nomination.'
        : null
    : null;

  const actions: ReactNode[] = [];
  // Their own next step: on the open nomination's card when there is one, else here.
  if (!open && ownStepOf(facts)) {
    actions.push(
      <Box key="own">
        <OwnNextStep facts={facts} />
      </Box>
    );
  }
  if (self && viewer?.address === address && ownAdminRole(viewer)) {
    actions.push(<AdminRoleAction key="role" status={viewer} />);
  }
  // Until it's known whether they have a name, no Propose nomination.
  const nameKnown = hasName !== undefined || Boolean(open);
  if (canNominate && nameKnown && (block === null || (block === 'open' && !mine))) {
    actions.push(
      <Button
        key="nominate"
        component={RouterLink}
        to={nominatePath(address)}
        variant="contained"
        sx={{ minHeight: 44 }}
      >
        {block === 'open'
          ? 'Add your support'
          : proposeNominationFor(person.name ?? 'this account')}
      </Button>
    );
  }
  if (viewer?.isAdmin && open?.decision) {
    actions.push(
      <Button
        key="decision"
        component={RouterLink}
        to={decisionPath(open.decision.signature)}
        variant="outlined"
        sx={{ minHeight: 44 }}
      >
        Open in Decisions
      </Button>
    );
  }
  // Why they can't be nominated now (being a member, or being you, needs no note).
  const blockNote =
    block && block !== 'self' && block !== 'member' && block !== 'open'
      ? NOMINEE_BLOCK_TEXT[block]
      : null;
  const note =
    mine ??
    blockNote ??
    (signedIn && !canNominate && block === null ? viewer?.nominateBlock : null);
  if (note) {
    actions.push(
      <Typography key="note" variant="body2" color="text.secondary" sx={{ flex: '1 1 220px' }}>
        {note}
      </Typography>
    );
  }
  if (!actions.length) return null;
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>{actions}</Box>
  );
}

/**
 * Its nomination in full, the open one or the latest: who nominated, who
 * supports, the reason, comments and votes; the account's own next step on
 * its own open nomination; when a decided one ended.
 */
export function ProfileNominationCard({
  facts,
  nomination,
  now,
  endedAt,
}: {
  facts: ProfileFacts;
  nomination: Nomination;
  now: ChainNow;
  endedAt: number | null;
}) {
  const open = isOpenState(nomination.state);
  return (
    <NominationCard
      nomination={nomination}
      now={now}
      hideNominee
      compact={!open}
      endedAt={open ? null : endedAt}
      comments
      forNominee={facts.self}
      actions={open ? <OwnNextStep facts={facts} /> : null}
    />
  );
}
