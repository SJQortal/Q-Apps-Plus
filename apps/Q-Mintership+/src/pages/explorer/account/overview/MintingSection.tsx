/**
 * The Overview's Minting section: whether the account is minting now (from
 * the node's list of online reward shares, read once and kept 5 minutes),
 * on its own or with another account through a reward share; and the last
 * block its keys signed, read once the section nears the screen and only
 * when the account has a public key (Core needs one to answer).
 */
import { Fragment, useState } from 'react';
import { Box, Button, Skeleton, Typography } from '@mui/material';
import { visuallyHidden } from '@mui/utils';
import { PersonInline } from '../../../../components/common/Person';
import { Card, Section } from '../../../../components/common/Section';
import { ErrorState, ListSkeleton } from '../../../../components/common/states';
import { getBlock } from '../../../../data/chain';
import { getLastSigned, getOnline } from '../../../../data/explorer/account';
import { useInView } from '../../../../hooks/useInView';
import { useQuery } from '../../../../hooks/useQuery';
import { formatBlock, formatCount, formatDate } from '../../../../utils/format';
import { mintingNowOf, NOT_MINTING, type MintingNow } from './overviewWords';
import { useViewState } from '../../../../hooks/useViewState';

/** Accounts named in the minting line before "Show all". */
const OTHERS_SHOWN = 5;

function MintingLine({ minting }: { minting: MintingNow | null }) {
  const [all, setAll] = useViewState('minting:all', false);
  if (!minting) return <Typography>{NOT_MINTING}</Typography>;
  const { self, others } = minting;
  if (!others.length) return <Typography>Minting now.</Typography>;
  const shown = all ? others : others.slice(0, OTHERS_SHOWN);
  const hidden = others.length - shown.length;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5 }}>
      <Typography sx={{ overflowWrap: 'anywhere' }}>
        {self ? 'Minting now, on its own and with ' : 'Minting now with '}
        {shown.map((address, i) => (
          <Fragment key={address}>
            {i === 0 ? null : i === shown.length - 1 && !hidden ? ' and ' : ', '}
            <PersonInline address={address} />
          </Fragment>
        ))}
        {hidden ? ` and ${formatCount(hidden)} more` : null}{' '}
        {others.length === 1 ? '(a reward share).' : '(reward shares).'}
      </Typography>
      {others.length > OTHERS_SHOWN ? (
        <Button onClick={() => setAll((open) => !open)} sx={{ minHeight: 44 }}>
          {all ? 'Show fewer' : `Show all ${formatCount(others.length)}`}
        </Button>
      ) : null}
    </Box>
  );
}

function LastSigned({ address, near }: { address: string; near: boolean }) {
  const signed = useQuery(near ? `xsigned:${address}` : null, () => getLastSigned(address));
  // Core's `/blocks/signer` rows carry no time (6.1.9): the block's own record has it (kept for the session).
  const height = signed.data && !signed.data.timestamp ? signed.data.height : null;
  const block = useQuery(height !== null ? `chain:block:${height}` : null, () =>
    getBlock(height as number)
  );
  if (signed.isError && signed.data === undefined)
    return (
      <ErrorState
        compact
        title="Couldn't load the last block it signed."
        error={signed.error}
        onRetry={() => void signed.refetch()}
      />
    );
  if (signed.data === undefined)
    return (
      <Typography>
        <Skeleton variant="text" width="70%" aria-hidden />
        <Box component="span" sx={visuallyHidden}>
          Loading the last block it signed
        </Box>
      </Typography>
    );
  if (!signed.data) return <Typography>Last signed a block: none found.</Typography>;
  const at = signed.data.timestamp || block.data?.timestamp;
  return (
    <Typography>
      Last signed a block:{' '}
      {at
        ? `${formatDate(at)} (${formatBlock(signed.data.height)}).`
        : `${formatBlock(signed.data.height)}.`}
    </Typography>
  );
}

export function MintingSection({
  address,
  hasPublicKey,
}: {
  address: string;
  hasPublicKey: boolean;
}) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const near = useInView(node);
  const online = useQuery('xonline', () => getOnline());
  return (
    <Section title="Minting" id="overview-minting">
      <Card ref={setNode} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {online.isError && !online.data ? (
          <ErrorState
            compact
            title="Couldn't load who is minting now."
            error={online.error}
            onRetry={() => void online.refetch()}
          />
        ) : !online.data ? (
          <ListSkeleton count={1} label="Loading who is minting now" />
        ) : (
          <MintingLine minting={mintingNowOf(online.data, address)} />
        )}
        {hasPublicKey ? <LastSigned address={address} near={near} /> : null}
      </Card>
    </Section>
  );
}
