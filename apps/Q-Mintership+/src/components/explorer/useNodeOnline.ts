/**
 * How much of the time an account's node was online for minting: the value
 * and what its ⓘ says (NodeOnline.tsx; the Minter Profile's Node online fact).
 */
import { getTip } from '../../data/chain';
import { getLevelLineage, getMintingStart } from '../../data/explorer/account';
import { useQuery } from '../../hooks/useQuery';
import {
  MEMBERS_ONLY_FROM,
  REWARD_ROUND,
  REWARD_ROUNDS_FROM,
  onlineShare,
  percentWords,
  type LevelLineage,
} from '../../rules/explorer/onlineShare';
import { displayName, formatCount } from '../../utils/format';

const HOW = `Qortal counts an account online at each reward: every block until block ${formatCount(
  REWARD_ROUNDS_FROM
)}, then every ${formatCount(REWARD_ROUND)} blocks. Since block ${formatCount(
  MEMBERS_ONLY_FROM
)}, only minting under a MINTER member’s reward share counts.`;

/**
 * Where its level was minted, in words: "crowetic-old from block 2 to block
 * 1,095,014, then this account since block 1,095,373".
 */
function lineageWords(lineage: LevelLineage, address: string): string {
  const nameOf = (who: string) =>
    who === address
      ? 'this account'
      : displayName(lineage.sources.find((s) => s.address === who)?.name, who);
  const spans = [...lineage.periods]
    .sort((a, b) => a.from - b.from)
    .map((p) =>
      p.to === null
        ? `${nameOf(p.address)} since block ${formatCount(p.from)}`
        : `${nameOf(p.address)} from block ${formatCount(p.from)} to block ${formatCount(p.to)}`
    );
  return spans.length > 1
    ? `${spans.slice(0, -1).join(', ')}, then ${spans[spans.length - 1]}`
    : (spans[0] ?? '');
}

/** The value and what it means, or null while it loads. */
export function useNodeOnline(address: string, blocksMinted: number) {
  const start = useQuery(`xmintstart:${address}`, () => getMintingStart(address));
  const tip = useQuery('chain:tip', (force) => getTip({ force }));
  // Its level moved here: where else it was minted (Simon, 2026-10-20).
  const movedHere = Boolean(start.data?.moved && !start.data.moved.away);
  const lineage = useQuery(movedHere ? `xlineage:${address}` : null, () =>
    getLevelLineage(address)
  );
  const failed =
    (start.isError && !start.data) ||
    (tip.isError && !tip.data) ||
    (movedHere && lineage.isError && !lineage.data);
  const retry = () => {
    if (start.isError) void start.refetch();
    if (tip.isError) void tip.refetch();
    if (lineage.isError) void lineage.refetch();
  };
  if (failed) return { failed: true as const, retry };
  if (!start.data || !tip.data || (movedHere && !lineage.data)) return null;
  const share = onlineShare(blocksMinted, start.data, tip.data.height, lineage.data);
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
    case 'lineage':
      return {
        value: percentWords(share.percent),
        info: `Online for ${share.percent.toFixed(1)}% of the rewards its minting level could have had: ${lineageWords(
          share.lineage,
          address
        )}. Its minting level moved here with its blocks minted, so they count together.${
          share.lineage.truncated ? ' (Its earliest moves weren’t followed.)' : ''
        } ${HOW}`,
      };
  }
}
