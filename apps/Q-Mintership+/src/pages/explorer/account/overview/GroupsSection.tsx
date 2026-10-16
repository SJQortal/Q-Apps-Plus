/**
 * Overview's Groups: every group the account is in, as a grid of cards (the
 * default) or a list, kept on this device (useListView), in the order
 * picked (rules/explorer/sortGroups.ts: MINTER first by default). Each group
 * shows its avatar, name, members, the account's part (Owner, Admin) and, in
 * the grid, its own description. The first GROUPS_SHOWN, then the rest on
 * request. The same read as At a glance's count (`xgroups:<address>`).
 */
import { useId, useState } from 'react';
import { Box, Button, TextField, Typography } from '@mui/material';
import { GroupAvatar } from '../../../../components/common/GroupAvatar';
import { Card, Section } from '../../../../components/common/Section';
import { ErrorState, ListSkeleton } from '../../../../components/common/states';
import { MINTER_GROUP_ID } from '../../../../data/constants';
import { getGroupsOf, type GroupOf } from '../../../../data/explorer/account';
import { useQuery } from '../../../../hooks/useQuery';
import {
  GROUP_SORTS,
  isGroupSort,
  sortGroups,
  type GroupSort,
} from '../../../../rules/explorer/sortGroups';
import { formatCount } from '../../../../utils/format';
import { useListView, type ListView } from '../useListView';
import { ViewToggle } from '../ViewToggle';
import { membersWords } from './overviewWords';
import { StatusChip } from '../../../../components/explorer/StatusChip';

/** Groups shown before "Show all". */
export const GROUPS_SHOWN = 9;

function Roles({ group, address }: { group: GroupOf; address: string }) {
  return (
    <>
      {group.owner === address ? <StatusChip label="Owner" kind="owner" /> : null}
      {group.isAdmin ? <StatusChip label="Admin" kind="groupAdmin" /> : null}
    </>
  );
}

function GroupName({ group }: { group: GroupOf }) {
  return (
    <Typography component="span" sx={{ fontWeight: 600, overflowWrap: 'anywhere', minWidth: 0 }}>
      <bdi dir="auto">{group.groupName || `Group #${group.groupId}`}</bdi>
    </Typography>
  );
}

function Members({ group }: { group: GroupOf }) {
  return typeof group.memberCount === 'number' ? (
    <Typography component="span" variant="body2" color="text.secondary">
      {membersWords(group.memberCount)}
    </Typography>
  ) : null;
}

/** A card in the grid: avatar and name, members and its part, then the description. */
function GroupCard({ group, address }: { group: GroupOf; address: string }) {
  return (
    <Box
      component="li"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        p: 2,
        minWidth: 0,
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
        <GroupAvatar
          groupId={group.groupId}
          groupName={group.groupName}
          ownerName={group.ownerPrimaryName}
          size={40}
        />
        <GroupName group={group} />
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        <Members group={group} />
        <Roles group={group} address={address} />
      </Box>
      {group.description ? (
        <Typography
          variant="body2"
          color="text.secondary"
          title={group.description}
          sx={{
            overflowWrap: 'anywhere',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          <bdi dir="auto">{group.description}</bdi>
        </Typography>
      ) : null}
    </Box>
  );
}

/** A row in the list: avatar, name, members and its part on one line. */
function GroupRow({ group, address }: { group: GroupOf; address: string }) {
  return (
    <Box
      component="li"
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        columnGap: 1,
        rowGap: 0.5,
        py: 1,
        borderTop: 1,
        borderColor: 'divider',
        '&:first-of-type': { borderTop: 0, pt: 0 },
        minWidth: 0,
      }}
    >
      <GroupAvatar
        groupId={group.groupId}
        groupName={group.groupName}
        ownerName={group.ownerPrimaryName}
        size={32}
      />
      <GroupName group={group} />
      <Members group={group} />
      <Roles group={group} address={address} />
    </Box>
  );
}

function listSx(view: ListView) {
  return view === 'grid'
    ? {
        listStyle: 'none',
        m: 0,
        p: 0,
        display: 'grid',
        gap: 1.5,
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))',
      }
    : { listStyle: 'none', m: 0, p: 0 };
}

export function GroupsSection({ address }: { address: string }) {
  const groups = useQuery(`xgroups:${address}`, (force) => getGroupsOf(address, { force }));
  const [sort, setSort] = useState<GroupSort>('minter');
  const [view, setView] = useListView('groups');
  const [all, setAll] = useState(false);
  const listId = useId();

  let body: React.ReactNode;
  if (groups.isError && !groups.data)
    body = (
      <ErrorState
        title="Couldn't load its groups."
        error={groups.error}
        onRetry={() => void groups.refetch()}
      />
    );
  else if (!groups.data) body = <ListSkeleton count={2} label="Loading its groups" />;
  else if (!groups.data.length) return null;
  else {
    const ordered = sortGroups(groups.data, sort, address, MINTER_GROUP_ID);
    const shown = all ? ordered : ordered.slice(0, GROUPS_SHOWN);
    const Item = view === 'grid' ? GroupCard : GroupRow;
    const list = (
      <Box component="ul" id={listId} aria-label="Its groups" sx={listSx(view)}>
        {shown.map((group) => (
          <Item key={group.groupId} group={group} address={address} />
        ))}
      </Box>
    );
    body = (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
        {ordered.length > 1 ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
            <TextField
              select
              label="Sort"
              size="small"
              value={sort}
              onChange={(e) => {
                if (isGroupSort(e.target.value)) setSort(e.target.value);
              }}
              slotProps={{ select: { native: true } }}
              sx={{
                flex: '1 1 200px',
                maxWidth: { sm: 260 },
                '& .MuiInputBase-root': { minHeight: 44 },
              }}
            >
              {GROUP_SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </TextField>
            <ViewToggle view={view} onView={setView} label="Show the groups as" />
          </Box>
        ) : null}
        {view === 'list' ? <Card>{list}</Card> : list}
        {ordered.length > GROUPS_SHOWN ? (
          <Button
            onClick={() => setAll((open) => !open)}
            aria-expanded={all}
            aria-controls={listId}
            sx={{ alignSelf: 'flex-start', minHeight: 44 }}
          >
            {all ? 'Show fewer' : `Show all ${formatCount(ordered.length)}`}
          </Button>
        ) : null}
      </Box>
    );
  }
  const count = groups.data?.length;
  return (
    <Section title={count ? `Groups (${formatCount(count)})` : 'Groups'} id="overview-groups">
      {body}
    </Section>
  );
}
