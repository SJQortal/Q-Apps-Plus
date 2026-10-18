/**
 * Connections as a circle (Simon, 2026-10-16; split by direction on
 * 2026-10-17): the account in the middle, the accounts it received
 * payments and transfers from on the left, those it sent them to on the
 * right (rules/explorer/circle.ts), each avatar sized by how many
 * transactions went that way and marked with their number, the most first;
 * or, with the toggle between the two headings, by the QORT that moved
 * (Simon, 2026-10-18: "a little toggle at the top in between Received from -
 * Sent to", kept on this device: useCircleOrder). An account paid
 * both ways is one avatar at the bottom, between the sides (Simon,
 * 2026-10-17: "fill the empty middle bottom part"); its ring and its line are
 * green and red in proportion to what came in and went out ("make the green
 * and red circle around the avatar represent the proportion"), by QORT, or
 * by transactions when no QORT moved.
 *
 * Easy to read: the avatars evenly spaced on one ring, the two sides
 * mirrored (Simon, 2026-10-17: "make the circles around nicely
 * symetrical"); one straight line from the middle to each, every avatar at
 * its own angle, so no line crosses another or runs under an
 * avatar; green on the left, red on the right, lighter until one is
 * pointed at or focused. On wider screens each name sits on the outer side
 * of its avatar, away from the lines, and under it at the bottom. The links that aren't transfers
 * (reward shares, minting level, names) are a row under the circle.
 *
 * Pressing an avatar lists the transactions behind it, in a dialog
 * (CircleNodeDialog), which also opens that account in the Explorer. The
 * avatars are lists of buttons, each side its own, the most transactions
 * (or QORT) first, each named with what it opens; the lines are decoration.
 */
import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  ButtonBase,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { visuallyHidden } from '@mui/utils';
import { NameAvatar } from '../../../../components/common/NameAvatar';
import { MarkedName } from '../../../../components/common/MarkedName';
import { useDisplayName } from '../../../../hooks/useDisplayName';
import { usePhoneLayout } from '../../../../hooks/usePhoneLayout';
import {
  circleLayout,
  addAssets,
  badgeText,
  circleQort,
  circleNodes,
  nodeWeight,
  PHONE_LAYOUT,
  receivedShare,
  WIDE_LAYOUT,
  type CircleNode,
  type CircleOrder,
  type PlacedNode,
  type WayPart,
} from '../../../../rules/explorer/circle';
import type { AssetSum } from '../../../../rules/explorer/money';
import type { Finding } from '../../../../rules/explorer/findings';
import { formatCount, plural } from '../../../../utils/format';
import { CircleNodeDialog } from './CircleNodeDialog';
import { sideWords } from './words';
import { useViewState } from '../../../../hooks/useViewState';

/** The line and ring colours: received, sent, and every other link. */
function useSideColours() {
  const theme = useTheme();
  return {
    in: theme.palette.success.main,
    out: theme.palette.error.main,
    other: theme.palette.primary.main,
  };
}

function Lines({
  placed,
  order,
  maxWeight,
  active,
}: {
  placed: PlacedNode[];
  order: CircleOrder;
  /** The most transactions (or QORT) drawn. */
  maxWeight: number;
  active: string | null;
}) {
  const colours = useSideColours();
  return (
    <Box
      component="svg"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
      className="qmp-fade"
      sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
    >
      {placed.map((node) => {
        const style = {
          opacity: active === null ? 0.45 : active === node.key ? 1 : 0.12,
          transition: 'opacity 150ms ease',
        };
        const common = {
          strokeWidth: 1 + 2.5 * Math.sqrt(maxWeight > 0 ? nodeWeight(node, order) / maxWeight : 0),
          strokeLinecap: 'butt' as const,
          vectorEffect: 'non-scaling-stroke' as const,
        };
        // Paid both ways: green from the middle for the share received, red for the rest.
        const share = receivedShare(node);
        const mx = 50 + (node.x - 50) * share;
        const my = 50 + (node.y - 50) * share;
        return (
          <g key={node.key} style={style}>
            {share > 0 ? (
              <line x1={50} y1={50} x2={mx} y2={my} stroke={colours.in} {...common} />
            ) : null}
            {share < 1 ? (
              <line x1={mx} y1={my} x2={node.x} y2={node.y} stroke={colours.out} {...common} />
            ) : null}
          </g>
        );
      })}
    </Box>
  );
}

/** QORT and each Q-Asset that moved, short: ["500 QORT", "1 10Coin"]. */
function amountList(qort: bigint, assets: readonly AssetSum[]): string[] {
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
function countWords(node: CircleNode): string {
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

/** The least room between the centres of two avatars of a side: wide, phone (px). */
const SIDE_GAP = [38, 34] as const;

/** The widest a name under a bottom avatar is. */
const BOTTOM_NAME_MAX = 124;

/** How tall the name under a bottom avatar is, with a line for each asset that moved (px). */
function bottomNameHeight(node: CircleNode): number {
  return 20 + 15 * Math.max(1, bothLines(node).length);
}

/**
 * How wide the name under a bottom avatar may be, in pixels, in a drawing
 * `width` by `height`: clear of every neighbour's avatar and name at the
 * height of this name (names hang down, so one higher up is clear of it);
 * the widest when nothing is in the way.
 */
function bottomNameRoom(
  node: PlacedNode,
  bottom: readonly PlacedNode[],
  width: number,
  height: number
): number {
  const px = (p: PlacedNode) => ({ x: (p.x / 100) * width, y: (p.y / 100) * height });
  const me = px(node);
  const top = me.y + Math.max(22, node.size / 2 + 5);
  const band = [top, top + bottomNameHeight(node)];
  let room = BOTTOM_NAME_MAX;
  for (const other of bottom) {
    if (other === node) continue;
    const at = px(other);
    const reach = Math.max(22, other.size / 2 + 5);
    const dx = Math.abs(at.x - me.x);
    const meets = (y0: number, y1: number) => y0 < band[1] && y1 > band[0];
    // Its name beside this one: they share the gap.
    if (meets(at.y + reach, at.y + reach + bottomNameHeight(other))) room = Math.min(room, dx - 6);
    // Its avatar: this name reaches up to its edge.
    if (meets(at.y - reach, at.y + reach)) room = Math.min(room, 2 * (dx - reach) - 6);
  }
  return Math.max(48, room);
}

/**
 * Under an avatar paid both ways, a line for QORT and for each Q-Asset that
 * moved: "457 QORT in, 9.5 out", "983 BHC Coin in, 10,000 out", "1 10Coin out".
 */
function bothLines(node: CircleNode): string[] {
  if (!node.split) return [];
  const { in: received, out: sent } = node.split;
  const names = ['QORT', ...addAssets(received.assets, sent.assets).map((sum) => sum.asset)];
  const atomic = (way: WayPart, name: string) =>
    name === 'QORT' ? way.qort : (way.assets.find((sum) => sum.asset === name)?.atomic ?? 0n);
  return names.flatMap((name) => {
    const r = circleQort(atomic(received, name));
    const s = circleQort(atomic(sent, name));
    if (r && s) return [`${r} ${name} in, ${s} out`];
    if (r) return [`${r} ${name} in`];
    if (s) return [`${s} ${name} out`];
    return [];
  });
}

/** Beside a side's avatar: "(500 QORT)", "(1 10Coin)", "(500 QORT, 1 10Coin)"; null when nothing moved. */
function qortWords(node: CircleNode): string | null {
  const list = amountList(node.qort, node.assets);
  return list.length ? `(${list.join(', ')})` : null;
}

/**
 * How many transactions an avatar stands for, or the QORT that moved, on its
 * corner (badgeText). Drawn by CSS: the button's name already says it, and as
 * text it would run into the avatar's letter ("K6") for checks that read the
 * button's visible words.
 */
function CountBadge({ text, side }: { text: string; side: CircleNode['side'] }) {
  return (
    <Box
      aria-hidden
      data-count={text}
      sx={(theme) => ({
        position: 'absolute',
        right: -4,
        bottom: -4,
        minWidth: 20,
        height: 20,
        px: 0.5,
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 700,
        lineHeight: 1,
        color: theme.palette.text.primary,
        bgcolor: theme.palette.background.paper,
        border: `1.5px solid ${
          side === 'in'
            ? theme.palette.success.main
            : side === 'out'
              ? theme.palette.error.main
              : side === 'both'
                ? theme.palette.text.secondary
                : theme.palette.primary.main
        }`,
        '&::after': { content: 'attr(data-count)' },
      })}
    />
  );
}

function Node({
  node,
  order,
  index,
  named,
  room = BOTTOM_NAME_MAX,
  onActive,
  onPick,
}: {
  node: PlacedNode;
  /** What its number says. */
  order: CircleOrder;
  index: number;
  /** Its name beside it, on the outer side (wider screens). */
  named: boolean;
  /** At the bottom: how wide its name may be, in pixels. */
  room?: number;
  onActive: (key: string | null) => void;
  onPick: (node: CircleNode) => void;
}) {
  const shown = useDisplayName(node.address, node.address.startsWith('A') ? null : undefined);
  const colours = useSideColours();
  const words = countWords(node);
  const below = node.side === 'both';
  const qort = below ? null : qortWords(node);
  const lines = below ? bothLines(node) : [];
  const badge = badgeText(node, order);
  // The name on the outer side of its avatar; under it at the bottom.
  const outer = below
    ? { top: '100%', left: '50%', translate: '-50% 0', mt: 0.5 }
    : {
        top: '50%',
        translate: '0 -50%',
        ...(node.side === 'in' ? { right: '100%', mr: 1 } : { left: '100%', ml: 1 }),
      };
  // The ring's green share, from the top clockwise: what came in.
  const share = receivedShare(node);
  const ring =
    share >= 1
      ? colours.in
      : share <= 0
        ? colours.out
        : `conic-gradient(${colours.in} 0 ${share * 360}deg, ${colours.out} ${share * 360}deg 360deg)`;
  return (
    <Box
      component="li"
      sx={{
        position: 'absolute',
        left: `${node.x}%`,
        top: `${node.y}%`,
        translate: '-50% -50%',
        listStyle: 'none',
        zIndex: 1,
      }}
    >
      {/* Pops in, one after another. */}
      <Box
        className="qmp-pop"
        sx={{ position: 'relative' }}
        style={{ animationDelay: `${Math.min(index, 24) * 30}ms` }}
      >
        <Tooltip
          title={
            <>
              <MarkedName name={shown.name}>{shown.label}</MarkedName>
              <br />
              {words}
            </>
          }
        >
          <ButtonBase
            onClick={() => onPick(node)}
            aria-label={`${shown.label}, ${words}: show them`}
            onMouseEnter={() => onActive(node.key)}
            onMouseLeave={() => onActive(null)}
            onFocus={() => onActive(node.key)}
            onBlur={() => onActive(null)}
            sx={{
              // A 44 px target whatever the avatar's size, the ring drawn inside it.
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 44,
              minHeight: 44,
              borderRadius: '50%',
              '& [data-ring]': { transition: 'scale 150ms ease' },
              '&:hover [data-ring], &.Mui-focusVisible [data-ring]': { scale: '1.12' },
              '&.Mui-focusVisible': { outline: 2, outlineColor: 'primary.main', outlineOffset: 2 },
            }}
          >
            <Box
              data-ring=""
              data-received={share.toFixed(2)}
              sx={{
                position: 'relative',
                display: 'flex',
                borderRadius: '50%',
                p: '3px',
                background: ring,
              }}
            >
              <Box
                sx={{ display: 'flex', borderRadius: '50%', bgcolor: 'background.paper', p: '2px' }}
              >
                <NameAvatar name={shown.name} size={node.size} />
              </Box>
              {badge ? <CountBadge text={badge} side={node.side} /> : null}
            </Box>
          </ButtonBase>
        </Tooltip>
        {named ? (
          <Typography
            aria-hidden
            sx={{
              position: 'absolute',
              ...outer,
              display: 'flex',
              alignItems: below ? 'center' : 'baseline',
              gap: below ? 0 : 0.5,
              flexDirection: below ? 'column' : node.side === 'in' ? 'row-reverse' : 'row',
              fontSize: 14,
              fontWeight: 600,
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              // No wider than its room: at the bottom, what its neighbours leave
              // (bottomNameRoom); on a side, to the edge of the figure (cqw: the
              // circle's width; its padding and a little past it, less the margin).
              width: 'max-content',
              maxWidth: below
                ? `${Math.round(room)}px`
                : `calc(${node.side === 'in' ? node.x : 100 - node.x}cqw + 32px - ${Math.max(22, node.size / 2 + 5)}px)`,
            }}
          >
            {/* The amount after the name, always whole; the name cut short when long. */}
            {lines.length ? (
              <Box
                component="span"
                sx={{
                  order: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  fontWeight: 500,
                  fontSize: 12,
                  lineHeight: 1.25,
                  color: 'text.secondary',
                  textAlign: 'center',
                  whiteSpace: 'normal',
                }}
              >
                {lines.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </Box>
            ) : null}
            {qort ? (
              <Box
                component="span"
                sx={{
                  order: node.side === 'in' ? 0 : 1,
                  flexShrink: 0,
                  fontWeight: 500,
                  color: 'text.secondary',
                }}
              >
                {qort}
              </Box>
            ) : null}
            <Box
              component="span"
              sx={{
                maxWidth: below ? '100%' : 112,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minWidth: 0,
                bgcolor: below ? 'background.paper' : undefined,
                px: below ? 0.5 : undefined,
                borderRadius: below ? 1 : undefined,
              }}
            >
              <MarkedName name={shown.name}>{shown.label}</MarkedName>
            </Box>
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}

/** A link that isn't a transfer, in the row under the circle. */
function OtherChip({ node, onPick }: { node: CircleNode; onPick: (node: CircleNode) => void }) {
  const shown = useDisplayName(node.address, node.address.startsWith('A') ? null : undefined);
  return (
    <Box component="li" sx={{ listStyle: 'none' }}>
      {/* Named by what it shows, then the rest for screen readers: "Sid Sponsor 2 transactions: show them". */}
      <ButtonBase
        onClick={() => onPick(node)}
        sx={(theme) => ({
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1,
          minHeight: 44,
          pl: 0.5,
          pr: 1.5,
          borderRadius: 22,
          border: `1.5px solid ${alpha(theme.palette.primary.main, 0.6)}`,
          '&:hover': { bgcolor: 'action.hover' },
          '&.Mui-focusVisible': { outline: 2, outlineColor: 'primary.main', outlineOffset: 2 },
        })}
      >
        <NameAvatar name={shown.name} size={32} />
        <Box
          component="span"
          sx={{
            fontWeight: 600,
            maxWidth: 160,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          <MarkedName name={shown.name}>{shown.label}</MarkedName>
        </Box>{' '}
        <Box component="span" sx={{ color: 'text.secondary', fontSize: 14 }}>
          {formatCount(node.count)}{' '}
          <Box component="span" sx={visuallyHidden}>
            {`${node.count === 1 ? 'transaction' : 'transactions'}: show them`}
          </Box>
        </Box>
      </ButtonBase>
    </Box>
  );
}

const ORDER_BUTTON = {
  minHeight: 44,
  px: 1.25,
  textTransform: 'none',
  fontSize: 14,
  whiteSpace: 'nowrap',
} as const;

/** The most transactions first, or the most QORT (Simon, 2026-10-18). */
function OrderToggle({
  order,
  onOrder,
}: {
  order: CircleOrder;
  onOrder: (order: CircleOrder) => void;
}) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={order}
      onChange={(_, value: CircleOrder | null) => {
        if (value) onOrder(value);
      }}
      aria-label="Order the accounts by"
    >
      <ToggleButton value="count" sx={ORDER_BUTTON}>
        Most transactions
      </ToggleButton>
      <ToggleButton value="qort" sx={ORDER_BUTTON}>
        Most QORT
      </ToggleButton>
    </ToggleButtonGroup>
  );
}

function SideHeading({
  side,
  accounts,
  more,
}: {
  side: 'in' | 'out' | 'both';
  accounts: number;
  more: number;
}) {
  const colours = useSideColours();
  const align = side === 'in' ? 'left' : side === 'out' ? 'right' : 'center';
  return (
    <Box sx={{ textAlign: align, minWidth: 0 }}>
      <Typography
        component="h3"
        sx={{
          fontWeight: 700,
          fontSize: 15,
          display: 'flex',
          gap: 0.75,
          alignItems: 'center',
          justifyContent: side === 'in' ? 'flex-start' : side === 'out' ? 'flex-end' : 'center',
        }}
      >
        <Box
          aria-hidden
          component="span"
          sx={{
            width: 18,
            height: 4,
            borderRadius: 2,
            background:
              side === 'both'
                ? `linear-gradient(90deg, ${colours.in} 50%, ${colours.out} 50%)`
                : colours[side],
            flexShrink: 0,
          }}
        />
        {sideWords(side)}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {accounts ? plural(accounts, 'account') : 'None'}
        {more ? `, ${formatCount(more)} more in the list` : ''}
      </Typography>
    </Box>
  );
}

export function ConnectionsCircle({
  address,
  recorded,
  order,
  onOrder,
  onShowList,
}: {
  address: string;
  /** What was recorded between them (useRecorded). */
  recorded: readonly Finding[];
  /** The most transactions first, or the most QORT (useCircleOrder). */
  order: CircleOrder;
  onOrder: (order: CircleOrder) => void;
  /** Back to the list, where every link is. */
  onShowList: () => void;
}) {
  const me = useDisplayName(address);
  const phone = usePhoneLayout();
  const options = phone ? PHONE_LAYOUT : WIDE_LAYOUT;
  const [active, setActive] = useState<string | null>(null);
  // The avatar whose transactions are open: kept for Back (useViewState), by its key.
  const [pickedKey, setPickedKey] = useViewState<string | null>('circle:picked', null);
  const groups = circleNodes(recorded, order);
  const picked = pickedKey
    ? ([...groups.in, ...groups.out, ...groups.both, ...groups.other].find(
        (node) => node.key === pickedKey
      ) ?? null)
    : null;
  const setPicked = (node: CircleNode | null) => setPickedKey(node ? node.key : null);
  const { placed, rest } = circleLayout(groups, options, order);
  const maxWeight = Math.max(
    order === 'qort' ? 0 : 1,
    ...placed.map((node) => nodeWeight(node, order))
  );
  const most = order === 'qort' ? 'QORT' : 'transactions';
  const left = placed.filter((node) => node.side === 'in');
  const right = placed.filter((node) => node.side === 'out');
  const bottom = placed.filter((node) => node.side === 'both');
  // The drawing's size, measured, for the room under the bottom avatars.
  const [box, setBox] = useState<HTMLElement | null>(null);
  const [boxSize, setBoxSize] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    if (!box) return;
    const update = () =>
      setBoxSize(box.clientWidth ? { width: box.clientWidth, height: box.clientHeight } : null);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(box);
    return () => observer.disconnect();
  }, [box]);
  const bottomRoom = (node: PlacedNode) =>
    boxSize ? bottomNameRoom(node, bottom, boxSize.width, boxSize.height) : BOTTOM_NAME_MAX;
  // Tall enough that the avatars of a side keep apart and a name never runs
  // under the next (Simon, 2026-10-17: "make sure the names and QORT
  // amounts are not covered"): the closest two of a side, in % of the
  // drawing's height, need SIDE_GAP px between their centres.
  const sideGap = Math.min(
    ...[left, right].flatMap((list) => list.slice(1).map((node, i) => node.y - list[i].y))
  );
  const minInner =
    Number.isFinite(sideGap) && sideGap > 0 ? (SIDE_GAP[phone ? 1 : 0] * 100) / sideGap : 0;
  // Under the bottom avatars, room for their names and a line for each asset.
  const bottomPad = 16 + Math.max(36, ...bottom.map(bottomNameHeight));
  // As tall as the fuller half of the ring needs: a few accounts leave no empty space.
  const fullest =
    Math.max(left.length, right.length) + Math.ceil((options.bothSpacing * bottom.length) / 2);
  const aspect = phone
    ? fullest <= 3
      ? '1 / 1'
      : fullest <= 5
        ? '5 / 6'
        : '3 / 4'
    : fullest <= 3
      ? '2 / 1'
      : fullest <= 6
        ? '16 / 10'
        : '4 / 3';
  const accounts = new Set(
    [...groups.in, ...groups.out, ...groups.both, ...groups.other].map((node) => node.address)
  ).size;
  if (!placed.length && !groups.other.length)
    return (
      <Typography color="text.secondary">
        No accounts linked to it in what was checked, so there is nothing to draw.
      </Typography>
    );
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      {placed.length ? (
        <Box sx={{ width: '100%', maxWidth: 880, mx: 'auto' }}>
          <Box
            sx={{
              display: 'grid',
              // The order between the two headings; on a phone, under them.
              gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr auto 1fr' },
              gridTemplateAreas: { xs: '"in out" "order order"', sm: '"in order out"' },
              alignItems: 'center',
              columnGap: 2,
              rowGap: 1.5,
              px: { xs: 0.5, sm: 2 },
            }}
          >
            <Box sx={{ gridArea: 'order', justifySelf: 'center' }}>
              <OrderToggle order={order} onOrder={onOrder} />
            </Box>
            <Box sx={{ gridArea: 'in', minWidth: 0 }}>
              <SideHeading side="in" accounts={groups.in.length} more={rest.in} />
            </Box>
            <Box sx={{ gridArea: 'out', minWidth: 0 }}>
              <SideHeading side="out" accounts={groups.out.length} more={rest.out} />
            </Box>
          </Box>
          <Box
            component="figure"
            aria-label={`${me.label} and ${plural(accounts, 'linked account')}`}
            sx={{
              position: 'relative',
              m: 0,
              width: '100%',
              aspectRatio: aspect,
              // Room for the avatars at the edges, and the names under the bottom ones.
              p: { xs: 2.5, sm: 3 },
              pb: bottom.length ? { xs: '28px', sm: `${bottomPad}px` } : undefined,
              minHeight: minInner
                ? {
                    xs: `${Math.ceil(minInner) + 20 + (bottom.length ? 28 : 20)}px`,
                    sm: `${Math.ceil(minInner) + 24 + (bottom.length ? bottomPad : 24)}px`,
                  }
                : undefined,
              boxSizing: 'border-box',
            }}
          >
            <Box
              ref={setBox}
              sx={{
                position: 'relative',
                width: '100%',
                height: '100%',
                containerType: 'inline-size',
              }}
            >
              <Lines placed={placed} order={order} maxWeight={maxWeight} active={active} />
              {/* The account itself, in the middle. */}
              <Box
                sx={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  translate: '-50% -50%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.5,
                  zIndex: 2,
                }}
              >
                <Box
                  sx={(theme) => ({
                    display: 'flex',
                    borderRadius: '50%',
                    p: '4px',
                    bgcolor: 'background.paper',
                    boxShadow: `0 0 0 3px ${theme.palette.primary.main}, 0 6px 24px ${theme.palette.action.hover}`,
                  })}
                >
                  <NameAvatar name={me.name} size={phone ? 52 : 68} />
                </Box>
                <Typography
                  sx={{
                    fontWeight: 700,
                    maxWidth: { xs: 110, sm: 150 },
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    bgcolor: 'background.paper',
                    px: 0.75,
                    borderRadius: 1,
                  }}
                >
                  <MarkedName name={me.name}>{me.label}</MarkedName>
                </Typography>
              </Box>
              {[
                { side: 'in' as const, list: left },
                { side: 'out' as const, list: right },
                { side: 'both' as const, list: bottom },
              ].map(({ side, list }) =>
                list.length ? (
                  <Box
                    key={side}
                    component="ul"
                    aria-label={`${sideWords(side)}, the most ${most} first`}
                    sx={{ m: 0, p: 0 }}
                  >
                    {list.map((node, i) => (
                      <Node
                        key={node.key}
                        node={node}
                        order={order}
                        index={i}
                        named={!phone}
                        room={bottomRoom(node)}
                        onActive={setActive}
                        onPick={setPicked}
                      />
                    ))}
                  </Box>
                ) : null
              )}
            </Box>
          </Box>
        </Box>
      ) : null}
      {groups.both.length ? (
        <SideHeading side="both" accounts={groups.both.length} more={rest.both} />
      ) : null}
      {groups.other.length ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography component="h3" sx={{ fontWeight: 700, fontSize: 15 }}>
            Other links: reward shares, minting level, names
          </Typography>
          <Box
            component="ul"
            aria-label="Other links"
            sx={{ m: 0, p: 0, display: 'flex', flexWrap: 'wrap', gap: 1 }}
          >
            {groups.other.map((node) => (
              <OtherChip key={node.key} node={node} onPick={setPicked} />
            ))}
          </Box>
        </Box>
      ) : null}
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
        {order === 'qort'
          ? 'The bigger the avatar and its line, the more QORT went that way; the number on it is that QORT.'
          : 'The bigger the avatar and its line, the more transactions went that way.'}
        {groups.both.length
          ? ' At the bottom, accounts paid both ways: green for what came in, red for what went out.'
          : ''}{' '}
        Press one for its transactions.
      </Typography>
      {rest.in || rest.out || rest.both ? (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Button onClick={onShowList} sx={{ minHeight: 44 }}>
            {`${plural(rest.in + rest.out + rest.both, 'more account')} with ${
              order === 'qort' ? 'less QORT' : 'fewer transactions'
            }: see the list`}
          </Button>
        </Box>
      ) : null}
      <CircleNodeDialog node={picked} address={address} onClose={() => setPicked(null)} />
    </Box>
  );
}
