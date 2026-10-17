/**
 * The top of an account page, on every tab (its name is the page title):
 * the avatar, its level, the whole address with copy, at most three chips
 * (where it stands in MINTER, minting now, a minting penalty), and a note
 * when it was opened by a name that isn't its primary one. On phones the
 * title is cut short beside the header's buttons, so the whole name is
 * under the avatar too, wrapping. The chips are in colour (StatusChip): the
 * colour says what kind of fact it is, never good or bad.
 */
import { Box, Typography } from '@mui/material';
import { AddressText } from '../../../components/common/Person';
import { NameAvatar } from '../../../components/common/NameAvatar';
import type { NamesOf } from '../../../data/explorer/account';
import type { AccountInfo } from '../../../data/types';
import { visibleName } from '../../../rules/explorer/nameNotes';
import type { MyStatus } from '../../../rules/status';
import type { NameMatch } from '../../../state/explorer';
import { minterStatusWord, openedFrom } from './accountWords';
import { MarkedName } from '../../../components/common/MarkedName';
import { StatusChip } from '../../../components/explorer/StatusChip';
import { DEV_ADMIN, useDevAdmins } from '../../../components/explorer/useDevAdmins';
import { NameLink } from '../../../components/explorer/TxSentence';

export interface AccountHeaderProps {
  address: string;
  account: AccountInfo;
  /** Its primary name: undefined while loading, null for none. */
  primary: string | null | undefined;
  names: NamesOf | undefined;
  /** Its MINTER status (the person page's read), once loaded. */
  status: MyStatus | undefined;
  /** In a reward share that is online now (undefined while loading). */
  mintingNow: boolean | undefined;
  /** The name the page was opened by, from the link's state. */
  openedBy: NameMatch | null;
}

/** A name in the note, with its own avatar, opening the name. */
function Name({ name }: { name: string }) {
  return <NameLink name={name} strong={false} />;
}

export function AccountHeader({
  address,
  account,
  primary,
  names,
  status,
  mintingNow,
  openedBy,
}: AccountHeaderProps) {
  const devAdmins = useDevAdmins();
  const chips = [
    status ? minterStatusWord(status) : null,
    devAdmins?.has(address) ? DEV_ADMIN : null,
    mintingNow ? 'Minting now' : null,
    account.blocksMintedPenalty !== 0 ? 'Minting penalty' : null,
  ].filter((chip): chip is string => chip !== null);
  const note = openedFrom(openedBy, primary, names);
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
        <NameAvatar name={primary ?? null} size={48} />
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 0 }}>
          <Box
            component="ul"
            aria-label="About this account"
            sx={{
              listStyle: 'none',
              m: 0,
              p: 0,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 0.75,
              alignItems: 'center',
            }}
          >
            <li>
              <StatusChip label={`Level ${account.level}`} />
            </li>
            {chips.map((chip) => (
              <li key={chip}>
                <StatusChip label={chip} />
              </li>
            ))}
          </Box>
        </Box>
      </Box>
      {primary ? (
        <Typography
          sx={{ display: { xs: 'block', sm: 'none' }, fontWeight: 700, overflowWrap: 'anywhere' }}
        >
          <bdi dir="auto">
            <MarkedName name={primary}>{visibleName(primary)}</MarkedName>
          </bdi>
        </Typography>
      ) : null}
      {/* The whole address on a line of its own, so a phone has room for it. */}
      <AddressText address={address} full />
      {note ? (
        <Typography
          variant="body2"
          color="text.secondary"
          role="note"
          sx={{ overflowWrap: 'anywhere' }}
        >
          Opened from the name <Name name={note.viaName} />
          {note.among}
          {note.matched ? (
            <>
              {' '}
              Core matched <Name name={note.matched} /> (same letters, ignoring case and
              look-alikes).
            </>
          ) : null}
        </Typography>
      ) : null}
    </Box>
  );
}
