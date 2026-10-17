/**
 * How much of the time an account's node was online for minting (Simon,
 * 2026-10-17), as a value with an ⓘ that explains it: on the Overview under
 * Blocks minted, and among the Minter Profile's facts. From its blocks
 * minted and two one-row searches (`xmintstart:<a>`), and the chain's tip
 * (rules/explorer/onlineShare.ts).
 */
import { Box, Link } from '@mui/material';
import { getTip } from '../../data/chain';
import { getMintingStart } from '../../data/explorer/account';
import { useQuery } from '../../hooks/useQuery';
import {
  MEMBERS_ONLY_FROM,
  REWARD_ROUND,
  REWARD_ROUNDS_FROM,
  onlineShare,
  percentWords,
} from '../../rules/explorer/onlineShare';
import { formatCount } from '../../utils/format';
import { InfoTip } from '../common/InfoTip';

const HOW = `Qortal counts an account online at each reward: every block until block ${formatCount(
  REWARD_ROUNDS_FROM
)}, then every ${formatCount(REWARD_ROUND)} blocks. Since block ${formatCount(
  MEMBERS_ONLY_FROM
)}, only minting under a MINTER member’s reward share counts.`;

/** The value and what it means, or null while it loads. */
function useNodeOnline(address: string, blocksMinted: number) {
  const start = useQuery(`xmintstart:${address}`, () => getMintingStart(address));
  const tip = useQuery('chain:tip', (force) => getTip({ force }));
  const failed = (start.isError && !start.data) || (tip.isError && !tip.data);
  const retry = () => {
    if (start.isError) void start.refetch();
    if (tip.isError) void tip.refetch();
  };
  if (failed) return { failed: true as const, retry };
  if (!start.data || !tip.data) return null;
  const share = onlineShare(blocksMinted, start.data, tip.data.height);
  switch (share.kind) {
    case 'never':
      return { value: 'Not minting', info: 'It has no reward share yet.' };
    case 'soon':
      return {
        value: 'Not yet',
        info: `Its first reward share is in block ${formatCount(share.first)}; its first reward round is block ${formatCount(share.round)}.`,
      };
    case 'moved':
      return {
        value: 'Can’t tell',
        info: `Its minting level moved ${share.to ? 'to' : 'from'} another account in block ${formatCount(share.height)}, and its blocks minted with it.`,
      };
    case 'share':
      return {
        value: percentWords(share.percent),
        info: `Online for ${share.percent.toFixed(1)}% of the rewards since its first reward share, in block ${formatCount(share.first)}. ${HOW}`,
      };
  }
}

/** "95% ⓘ", "Not minting ⓘ", or a Retry when it can't be read. */
export function NodeOnlineValue({
  address,
  blocksMinted,
  loading,
}: {
  address: string;
  blocksMinted: number;
  /** What shows while it loads. */
  loading: React.ReactNode;
}) {
  const online = useNodeOnline(address, blocksMinted);
  if (!online) return <>{loading}</>;
  if ('failed' in online)
    return (
      <Box component="span" sx={{ fontWeight: 400, fontSize: 14 }}>
        Couldn&rsquo;t read its reward shares.{' '}
        <Link component="button" type="button" onClick={online.retry} sx={{ fontSize: 14 }}>
          Retry
        </Link>
      </Box>
    );
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
      {online.value}
      <InfoTip label={`About node online: ${online.info}`}>{online.info}</InfoTip>
    </Box>
  );
}
