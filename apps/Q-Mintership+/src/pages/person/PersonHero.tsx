/**
 * The top of a person page: who they are (avatar, name, address), where they
 * stand in MINTER in one plain sentence, their level and blocks minted, and
 * what the viewer can do for them (nominate, support, or open the decision).
 */
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Chip, Typography, type ChipProps } from '@mui/material';
import type { Nomination } from '../../data/nominations';
import { ownAdminRole } from '../../rules/adminChange';
import { NOMINEE_BLOCK_TEXT, nomineeBlock } from '../../rules/nomination';
import type { MyStatus, StatusKind } from '../../rules/status';
import { AddressText } from '../../components/common/Person';
import { NameAvatar } from '../../components/common/NameAvatar';
import { Card, LevelBadge, ToneChip } from '../../components/common/Section';
import { usePhoneLayout } from '../../hooks/usePhoneLayout';
import { proposeNominationFor } from '../../constants/words';
import { decisionPath, nominatePath } from '../../routes/paths';
import { formatCount, formatDate } from '../../utils/format';
import { AdminRoleAction } from '../decisions/AdminRoleAction';
import { statusSentence } from './personWords';

const STATUS_CHIP: Record<
  Exclude<StatusKind, 'outsideHub' | 'signedOut'>,
  { label: string; color: ChipProps['color']; filled?: boolean }
> = {
  admin: { label: 'Minter Admin', color: 'primary', filled: true },
  memberNominator: { label: 'MINTER member', color: 'success', filled: true },
  member: { label: 'MINTER member', color: 'success', filled: true },
  formerBanned: { label: 'Banned from MINTER', color: 'error' },
  approvedInvite: { label: 'Approved: can join now', color: 'success' },
  nominated: { label: 'Nominated', color: 'primary' },
  formerKicked: { label: 'Former member', color: 'default' },
  formerLeft: { label: 'Former member', color: 'default' },
  newcomer: { label: 'Not in MINTER', color: 'default' },
};

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 700, fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </Box>
  );
}

export interface PersonHeroProps {
  address: string;
  person: MyStatus;
  self: boolean;
  memberSince: number | null;
  /** Their open nomination, if any. */
  open: Nomination | null;
  /** The signed-in viewer (undefined while loading or outside Hub). */
  viewer: MyStatus | undefined;
  /** Their own page: Join now when there is no open nomination card to carry it. */
  action?: ReactNode;
}

export function PersonHero({
  address,
  person,
  self,
  memberSince,
  open,
  viewer,
  action,
}: PersonHeroProps) {
  const phone = usePhoneLayout();
  // "Former member" only for someone who was one (not a removed join request or ban).
  const kind = person.kind === 'formerKicked' && !person.wasMember ? 'newcomer' : person.kind;
  const chip = STATUS_CHIP[kind as keyof typeof STATUS_CHIP] ?? STATUS_CHIP.newcomer;
  const next = person.progress;
  const block = nomineeBlock({
    self,
    isMember: person.isMember,
    activeBan: Boolean(person.activeBan),
    openNomination: Boolean(open),
    pendingInvite: Boolean(open?.decision),
    storedInvite: Boolean(person.storedInvite),
  });
  const shownName = person.name ?? null;
  const canNominate = Boolean(viewer?.canNominate);
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
  if (action) actions.push(<Box key="own">{action}</Box>);
  // Their own page: Become a Minter Admin, or Step down as Minter Admin.
  if (self && viewer?.address === address && ownAdminRole(viewer)) {
    actions.push(<AdminRoleAction key="role" status={viewer} />);
  }
  if (canNominate && (block === null || (block === 'open' && !mine))) {
    actions.push(
      <Button
        key="nominate"
        component={RouterLink}
        to={nominatePath(address)}
        variant="contained"
        sx={{ minHeight: 44 }}
      >
        {block === 'open' ? 'Add your support' : proposeNominationFor(shownName ?? 'this account')}
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

  return (
    <Card sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', minWidth: 0 }}>
        <NameAvatar name={shownName} size={phone ? 56 : 64} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            component="h2"
            sx={{ fontWeight: 800, fontSize: { xs: 20, sm: 24 }, overflowWrap: 'anywhere' }}
          >
            {shownName ?? 'No registered name'}
          </Typography>
          <AddressText address={address} full={!phone} />
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <LevelBadge level={person.level} />
        <ToneChip
          size="small"
          label={chip.label}
          color={chip.color}
          variant={chip.filled ? 'filled' : 'outlined'}
        />
        {person.hasJoinRequest && !person.isMember ? (
          <ToneChip size="small" color="success" variant="outlined" label="Join request sent" />
        ) : null}
        {self ? <Chip size="small" variant="outlined" label="You" /> : null}
      </Box>

      <Typography>{statusSentence(person, memberSince, self)}</Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 1.5,
        }}
      >
        <Fact label="Blocks minted" value={formatCount(person.blocksMinted)} />
        {next.nextLevelAt !== null && next.blocksToNextLevel !== null ? (
          <Fact
            label={`To level ${person.level + 1}`}
            value={`${formatCount(next.blocksToNextLevel)} blocks`}
          />
        ) : (
          <Fact label="Level" value="Top level" />
        )}
        {person.isMember && memberSince ? (
          <Fact label="In MINTER since" value={formatDate(memberSince)} />
        ) : null}
      </Box>

      {actions.length ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
          {actions}
        </Box>
      ) : null}
    </Card>
  );
}
