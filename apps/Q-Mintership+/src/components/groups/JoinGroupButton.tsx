/**
 * Join a group from its card in the Explorer (Simon, 2026-10-17: "on the
 * groups windows I would like a small icon and once clicked it joins that
 * group or sends invite to join it if it is private"): a small icon on each
 * group the signed-in account isn't in. An open group is joined at once; a
 * closed one gets a join request its admins decide on: the same JOIN_GROUP,
 * explained before Hub opens (HubStepDialog), checked against the chain
 * first (writes/guards.ts → guardJoinGroup). MINTER is joined by
 * nomination, so it has none.
 *
 * It lives outside the Explorer's folders: the Explorer's own files stay
 * read-only (eslint.config.js).
 *
 * Reads: the signed-in account's own groups (`xgroups:<address>`, the
 * Explorer's read), once, to know which groups it is in.
 */
import { useState } from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { visuallyHidden } from '@mui/utils';
import GroupAddOutlinedIcon from '@mui/icons-material/GroupAddOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import { MINTER_GROUP_ID } from '../../data/constants';
import { getGroupsOf, type GroupOf } from '../../data/explorer/account';
import { useQuery } from '../../hooks/useQuery';
import { useSession } from '../../state/session';
import { readable } from '../../utils/readable';
import { joinGroup } from '../../writes/flows';
import { usePendingWrite, writeKeys } from '../../writes/optimistic';
import { HubStepDialog } from '../common/HubStepDialog';

export function JoinGroupButton({ group }: { group: GroupOf }) {
  const session = useSession();
  const signer =
    session.status === 'ready' ? { address: session.address, publicKey: session.publicKey } : null;
  const mine = useQuery(signer ? `xgroups:${signer.address}` : null, (force) =>
    getGroupsOf(signer?.address ?? '', { force })
  );
  const pending = usePendingWrite(
    signer ? writeKeys.joinGroup(signer.address, group.groupId) : null
  );
  const [open, setOpen] = useState(false);
  if (!signer || group.groupId === MINTER_GROUP_ID) return null;
  // Its groups couldn't be read: no Join while that isn't known, and a Retry (Hub's Explorer
  // port, 2026-11-22: Join was simply missing).
  if (!open && !mine.data && mine.isError) {
    const words = 'Couldn’t check which groups you’re in: try again';
    return (
      <Tooltip title={words}>
        <IconButton
          aria-label={words}
          onClick={() => void mine.refetch()}
          sx={{ width: 44, height: 44, flexShrink: 0 }}
        >
          <RefreshOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    );
  }
  // The dialog stays while open, whatever the write and the reads after it change.
  const inGroup = Boolean(mine.data?.some((g) => g.groupId === group.groupId));
  if (!open && (!mine.data || inGroup)) return null;

  const name = group.groupName || `Group #${group.groupId}`;
  // Core's own flag: an open group takes anyone at once; a closed one, by its admins.
  const closed = group.isOpen === false;
  const label = closed ? `Ask to join ${name}` : `Join ${name}`;

  // One button for Join and, once sent, sent: the same element, so focus comes back to it as
  // the dialog closes (Hub's Explorer port, 2026-11-22: a status box in its place left the
  // focus nowhere).
  const sending = Boolean(pending && pending.status !== 'failed');
  const sentWords = !pending
    ? ''
    : pending.status === 'sending'
      ? 'Sending…'
      : `${closed ? 'Join request sent' : 'Joined'} ✓ (confirming…): ${name}`;
  const icon =
    sending || !inGroup ? (
      <>
        <Tooltip title={sending ? sentWords : label}>
          <IconButton
            aria-label={sending ? sentWords : label}
            aria-haspopup={sending ? undefined : 'dialog'}
            aria-disabled={sending || undefined}
            onClick={sending ? () => undefined : () => setOpen(true)}
            sx={{
              width: 44,
              height: 44,
              flexShrink: 0,
              ...(sending ? { color: readable('success') } : {}),
            }}
          >
            {sending ? (
              <CheckCircleOutlineOutlinedIcon fontSize="small" />
            ) : (
              <GroupAddOutlinedIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
        {/* Read out as it changes: sending, then sent. */}
        <Box component="span" role="status" sx={visuallyHidden}>
          {sending ? sentWords : ''}
        </Box>
      </>
    ) : null;

  return (
    <>
      {icon}
      {open ? (
        <HubStepDialog
          open
          onClose={() => setOpen(false)}
          title={label}
          intro={
            <Typography>
              {closed ? (
                <>
                  {name} is a closed group: this sends your join request, and its admins decide. You
                  become a member once they approve it. A request can&rsquo;t be withdrawn.
                </>
              ) : group.isOpen ? (
                <>{name} is an open group: you become a member as soon as this is in a block.</>
              ) : (
                <>
                  If {name} is open you become a member as soon as this is in a block; if it is
                  closed, this sends your join request and its admins decide.
                </>
              )}
            </Typography>
          }
          steps={[
            {
              action: 'JOIN_ANY_GROUP',
              title: closed ? 'Send your join request' : 'Join the group',
              check: [`The group is ${name}.`, 'The fee.'],
              feeTxType: 'JOIN_GROUP',
            },
          ]}
          run={async (report) => ({
            outcome: await joinGroup(signer, group, (stage) => report(0, stage)),
          })}
          successTitle={closed ? 'Join request sent' : 'Joined'}
          successText={
            closed
              ? `Your request to join ${name} is on its way into a block. Its admins decide.`
              : `You join ${name} once this is in a block.`
          }
        />
      ) : null}
    </>
  );
}
