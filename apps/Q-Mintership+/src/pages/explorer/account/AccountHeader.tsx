/**
 * The top of an account page, on every tab (its name is the page title):
 * the avatar, its level, the short address with copy, at most three chips
 * (where it stands in MINTER, minting now, a minting penalty), and a note
 * when it was opened by a name that isn't its primary one. On phones the
 * title is cut short beside the header's buttons, so the whole name is
 * under the avatar too, wrapping. Plain facts in neutral chips: no colour
 * says good or bad.
 */
import { Box, Typography } from '@mui/material';
import { AddressText } from '../../../components/common/Person';
import { NameAvatar } from '../../../components/common/NameAvatar';
import { LevelBadge, ToneChip } from '../../../components/common/Section';
import type { NamesOf } from '../../../data/explorer/account';
import type { AccountInfo } from '../../../data/types';
import { visibleName } from '../../../rules/explorer/nameNotes';
import type { MyStatus } from '../../../rules/status';
import type { NameMatch } from '../../../state/explorer';
import { minterStatusWord, openedFrom } from './accountWords';

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

function Name({ name }: { name: string }) {
  return (
    <>
      “<bdi dir="auto">{visibleName(name)}</bdi>”
    </>
  );
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
  const chips = [
    status ? minterStatusWord(status) : null,
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
              <LevelBadge level={account.level} />
            </li>
            {chips.map((chip) => (
              <li key={chip}>
                <ToneChip size="small" variant="outlined" label={chip} sx={{ fontSize: 14 }} />
              </li>
            ))}
          </Box>
          <AddressText address={address} />
        </Box>
      </Box>
      {primary ? (
        <Typography
          sx={{ display: { xs: 'block', sm: 'none' }, fontWeight: 700, overflowWrap: 'anywhere' }}
        >
          <bdi dir="auto">{visibleName(primary)}</bdi>
        </Typography>
      ) : null}
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
