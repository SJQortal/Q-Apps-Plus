/**
 * Compare's accounts: one compact card each, lettered A–D in its colour
 * (the letter and the name always show, so colour is never the only mark):
 * its avatar and name (to its account in the Explorer), short address with
 * copy, level, where it stands in MINTER (the app's own status words),
 * "Minting now", "Minting penalty", and Remove. An address Core doesn't
 * know says so on its card, and so does a status it couldn't read (a chip
 * left out is never a silent "no"). Under the cards, "Add an account" (the
 * Explorer's search field), up to 4.
 */
import { Box, IconButton, Skeleton, Tooltip, Typography } from '@mui/material';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import { AddressText, PersonChip } from '../../../components/common/Person';
import { LevelBadge, ToneChip } from '../../../components/common/Section';
import { ErrorState } from '../../../components/common/states';
import { ExplorerSearch } from '../../../components/explorer/ExplorerSearch';
import { isInvalidAddressError } from '../../../data/explorer/account';
import { useDisplayName } from '../../../hooks/useDisplayName';
import { COMPARE_LIMIT, letterOf } from '../../../rules/explorer/compare';
import { COMPARE_FULL } from '../../../state/explorer';
import { minterStatusWord } from '../account/accountWords';
import { INVALID_ADDRESS, UNUSED_ADDRESS } from '../explorerWords';
import { LetterBadge } from './letters';
import type { CompareData } from './useCompareData';

const CHIP_LIST_SX = {
  listStyle: 'none',
  m: 0,
  p: 0,
  display: 'flex',
  flexWrap: 'wrap',
  gap: 0.75,
  alignItems: 'center',
} as const;

function AccountCard({
  data,
  index,
  accent,
  onRemove,
}: {
  data: CompareData;
  index: number;
  accent: string;
  onRemove: (address: string) => void;
}) {
  const address = data.addresses[index];
  const letter = letterOf(index);
  const explored = data.explored[index];
  const account = data.accounts[index];
  const { label } = useDisplayName(address, account ? undefined : null);
  const status = data.status[index].data;
  const minting = data.mintingNow[index];
  const chips = account
    ? [
        status ? minterStatusWord(status) : null,
        minting ? 'Minting now' : null,
        account.blocksMintedPenalty !== 0 ? 'Minting penalty' : null,
      ].filter((chip): chip is string => chip !== null)
    : [];
  // A chip left out because its read failed is said, not taken for "no".
  const unread = account
    ? [
        data.status[index].isError ? 'its MINTER status' : null,
        data.online.isError ? 'whether it is minting now' : null,
      ].filter((what): what is string => what !== null)
    : [];

  let body: React.ReactNode;
  if (account) {
    body = (
      <Box component="ul" aria-label={`About ${label}`} sx={CHIP_LIST_SX}>
        <li>
          <LevelBadge level={account.level} />
        </li>
        {chips.map((chip) => (
          <li key={chip}>
            <ToneChip size="small" variant="outlined" label={chip} sx={{ fontSize: 14 }} />
          </li>
        ))}
        {unread.length ? (
          <Typography component="li" variant="body2" color="text.secondary">
            Couldn’t read {unread.join(' or ')}
          </Typography>
        ) : null}
      </Box>
    );
  } else if (explored.data?.kind === 'unused') {
    body = <Typography color="text.secondary">{UNUSED_ADDRESS}</Typography>;
  } else if (explored.isError && isInvalidAddressError(explored.error)) {
    body = <Typography color="text.secondary">{INVALID_ADDRESS}</Typography>;
  } else if (explored.isError) {
    body = (
      <ErrorState
        compact
        title="Couldn’t load this account."
        error={explored.error}
        onRetry={() => void explored.refetch()}
      />
    );
  } else {
    body = (
      // Words a screen reader can find (a skeleton alone says nothing), not a live region.
      <Box>
        <Skeleton variant="text" width="60%" aria-hidden />
        <span className="qmp-visually-hidden">Loading account {letter}…</span>
      </Box>
    );
  }

  return (
    <Box
      component="li"
      sx={{
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
        p: { xs: 1.5, sm: 2 },
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderLeft: `4px solid ${accent}`,
        borderRadius: 1,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        <LetterBadge letter={letter} accent={accent} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {account ? <PersonChip address={address} size={40} /> : <AddressText address={address} />}
        </Box>
        <Tooltip title="Remove from this comparison">
          <IconButton
            aria-label={`Remove ${label} (${letter}) from this comparison`}
            onClick={() => onRemove(address)}
            sx={{ width: 44, height: 44, flexShrink: 0 }}
          >
            <CloseOutlinedIcon />
          </IconButton>
        </Tooltip>
      </Box>
      {account ? <AddressText address={address} /> : null}
      {body}
    </Box>
  );
}

export function AccountCards({
  data,
  accents,
  onRemove,
  onAdd,
  message,
}: {
  data: CompareData;
  accents: readonly string[];
  onRemove: (address: string) => void;
  onAdd: (address: string) => void;
  /** What the last Add did, when it did nothing ("Already in…", "Compare holds 4…"). */
  message: string | null;
}) {
  const count = data.addresses.length;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
      {count ? (
        <Box
          component="ul"
          aria-label="Accounts compared"
          sx={{
            listStyle: 'none',
            m: 0,
            p: 0,
            display: 'grid',
            gap: 1.5,
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              sm: 'repeat(2, minmax(0, 1fr))',
              md: count === 3 ? 'repeat(3, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))',
            },
          }}
        >
          {data.addresses.map((address, i) => (
            <AccountCard
              key={address}
              data={data}
              index={i}
              accent={accents[i]}
              onRemove={onRemove}
            />
          ))}
        </Box>
      ) : null}
      {count < COMPARE_LIMIT ? (
        <ExplorerSearch
          label={count ? 'Add an account' : 'Find an account to compare'}
          onAccount={(address) => onAdd(address)}
        />
      ) : (
        <Typography color="text.secondary">{COMPARE_FULL}</Typography>
      )}
      <Typography role="status" color="text.secondary" sx={{ minHeight: message ? undefined : 0 }}>
        {message ?? ''}
      </Typography>
    </Box>
  );
}
