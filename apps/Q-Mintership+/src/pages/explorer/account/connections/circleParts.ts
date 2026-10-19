/**
 * What the Connections circle and the list under it share: the side
 * colours, an avatar's ring, and the words for what an account stands for.
 */
import { useTheme } from '@mui/material/styles';
import {
  circleQort,
  receivedShare,
  type CircleNode,
  type WayPart,
} from '../../../../rules/explorer/circle';
import type { AssetSum } from '../../../../rules/explorer/money';
import { formatCount, plural } from '../../../../utils/format';

/** The line and ring colours: received, sent, and every other link. */
export function useSideColours() {
  const theme = useTheme();
  return {
    in: theme.palette.success.main,
    out: theme.palette.error.main,
    other: theme.palette.primary.main,
  };
}

export type SideColours = ReturnType<typeof useSideColours>;

/**
 * An avatar's ring: green for what came in, red for what went out, in
 * proportion for an account paid both ways (from the top, clockwise).
 */
export function ringBackground(
  node: Pick<CircleNode, 'side' | 'split'>,
  colours: SideColours
): string {
  const share = receivedShare(node);
  return share >= 1
    ? colours.in
    : share <= 0
      ? colours.out
      : `conic-gradient(${colours.in} 0 ${share * 360}deg, ${colours.out} ${share * 360}deg 360deg)`;
}

/** QORT and each Q-Asset that moved, short: ["500 QORT", "1 10Coin"]. */
export function amountList(qort: bigint, assets: readonly AssetSum[]): string[] {
  const out: string[] = [];
  const q = circleQort(qort);
  if (q) out.push(`${q} QORT`);
  for (const sum of assets) {
    const amount = circleQort(sum.atomic);
    if (amount) out.push(`${amount} ${sum.asset}`);
  }
  return out;
}

/**
 * "4 transactions received, 500 QORT", "2 transactions sent, 1 10Coin",
 * "3 transactions"; both ways, "5 transactions: 3 received, 500 QORT; 2
 * sent, 20 QORT".
 */
export function countWords(node: CircleNode): string {
  const list = amountList(node.qort, node.assets);
  const amount = list.length ? `, ${list.join(', ')}` : '';
  if (node.side === 'both' && node.split) {
    const part = (way: WayPart) => {
      const moved = amountList(way.qort, way.assets);
      return moved.length ? `, ${moved.join(', ')}` : '';
    };
    // The total first: it is the number on the avatar.
    return `${plural(node.count, 'transaction')}: ${formatCount(node.split.in.count)} received${part(
      node.split.in
    )}; ${formatCount(node.split.out.count)} sent${part(node.split.out)}`;
  }
  return node.side === 'in'
    ? `${plural(node.count, 'transaction')} received${amount}`
    : node.side === 'out'
      ? `${plural(node.count, 'transaction')} sent${amount}`
      : plural(node.count, 'transaction');
}
