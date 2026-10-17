/**
 * Connections as a circle (Simon, 2026-10-16; split by direction on
 * 2026-10-17): the account in the middle, the accounts it received
 * payments and transfers from on the left, those it sent them to on the
 * right (rules/explorer/circle.ts), each avatar sized by how many
 * transactions went that way and marked with their number. An account paid
 * both ways is on both sides.
 *
 * Easy to read: one straight line from the middle to each avatar, every
 * avatar at its own angle, so no line crosses another or runs under an
 * avatar; green on the left, red on the right, lighter until one is
 * pointed at or focused. On wider screens each name sits on the outer side
 * of its avatar, away from the lines. The links that aren't transfers
 * (reward shares, minting level, names) are a row under the circle.
 *
 * Pressing an avatar lists the transactions behind it, in a dialog
 * (CircleNodeDialog), which also opens that account in the Explorer. The
 * avatars are lists of buttons, each side its own, the most transactions
 * first, each named with what it opens; the lines are decoration.
 */
import { useState } from 'react';
import { Box, Button, ButtonBase, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { visuallyHidden } from '@mui/utils';
import { NameAvatar } from '../../../../components/common/NameAvatar';
import { MarkedName } from '../../../../components/common/MarkedName';
import { useDisplayName } from '../../../../hooks/useDisplayName';
import { usePhoneLayout } from '../../../../hooks/usePhoneLayout';
import {
  circleLayout,
  circleNodes,
  PHONE_LAYOUT,
  WIDE_LAYOUT,
  type CircleNode,
  type PlacedNode,
} from '../../../../rules/explorer/circle';
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
  maxCount,
  active,
}: {
  placed: PlacedNode[];
  maxCount: number;
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
      {placed.map((node) => (
        <line
          key={node.key}
          x1={50}
          y1={50}
          x2={node.x}
          y2={node.y}
          stroke={node.side === 'in' ? colours.in : colours.out}
          strokeWidth={1 + 2.5 * Math.sqrt(node.count / maxCount)}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          style={{
            opacity: active === null ? 0.45 : active === node.key ? 1 : 0.12,
            transition: 'opacity 150ms ease',
          }}
        />
      ))}
    </Box>
  );
}

/** "4 received", "2 sent", "3 other links". */
function countWords(node: CircleNode): string {
  return node.side === 'in'
    ? `${plural(node.count, 'transaction')} received`
    : node.side === 'out'
      ? `${plural(node.count, 'transaction')} sent`
      : plural(node.count, 'transaction');
}

/** How many transactions an avatar stands for, on its corner. */
function CountBadge({ count, side }: { count: number; side: CircleNode['side'] }) {
  return (
    <Box
      aria-hidden
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
              : theme.palette.primary.main
        }`,
      })}
    >
      {count > 999 ? '999+' : count}
    </Box>
  );
}

function Node({
  node,
  index,
  named,
  onActive,
  onPick,
}: {
  node: PlacedNode;
  index: number;
  /** Its name beside it, on the outer side (wider screens). */
  named: boolean;
  onActive: (key: string | null) => void;
  onPick: (node: CircleNode) => void;
}) {
  const shown = useDisplayName(node.address, node.address.startsWith('A') ? null : undefined);
  const colours = useSideColours();
  const words = countWords(node);
  const outer = node.side === 'in' ? { right: '100%', mr: 1 } : { left: '100%', ml: 1 };
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
              sx={{
                position: 'relative',
                display: 'flex',
                borderRadius: '50%',
                p: '3px',
                bgcolor: node.side === 'in' ? colours.in : colours.out,
              }}
            >
              <Box
                sx={{ display: 'flex', borderRadius: '50%', bgcolor: 'background.paper', p: '2px' }}
              >
                <NameAvatar name={shown.name} size={node.size} />
              </Box>
              {node.count > 1 ? <CountBadge count={node.count} side={node.side} /> : null}
            </Box>
          </ButtonBase>
        </Tooltip>
        {named ? (
          <Typography
            aria-hidden
            sx={{
              position: 'absolute',
              top: '50%',
              translate: '0 -50%',
              ...outer,
              maxWidth: 112,
              fontSize: 14,
              fontWeight: 600,
              lineHeight: 1.2,
              textAlign: node.side === 'in' ? 'right' : 'left',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              pointerEvents: 'none',
            }}
          >
            <MarkedName name={shown.name}>{shown.label}</MarkedName>
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

function SideHeading({
  side,
  accounts,
  more,
}: {
  side: 'in' | 'out';
  accounts: number;
  more: number;
}) {
  const colours = useSideColours();
  return (
    <Box sx={{ textAlign: side === 'in' ? 'left' : 'right', minWidth: 0 }}>
      <Typography
        component="h3"
        sx={{
          fontWeight: 700,
          fontSize: 15,
          display: 'flex',
          gap: 0.75,
          alignItems: 'center',
          justifyContent: side === 'in' ? 'flex-start' : 'flex-end',
        }}
      >
        <Box
          aria-hidden
          component="span"
          sx={{ width: 18, height: 4, borderRadius: 2, bgcolor: colours[side], flexShrink: 0 }}
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
  onShowList,
}: {
  address: string;
  /** What was recorded between them (useRecorded). */
  recorded: readonly Finding[];
  /** Back to the list, where every link is. */
  onShowList: () => void;
}) {
  const me = useDisplayName(address);
  const phone = usePhoneLayout();
  const options = phone ? PHONE_LAYOUT : WIDE_LAYOUT;
  const [active, setActive] = useState<string | null>(null);
  // The avatar whose transactions are open: kept for Back (useViewState), by its key.
  const [pickedKey, setPickedKey] = useViewState<string | null>('circle:picked', null);
  const groups = circleNodes(recorded);
  const picked = pickedKey
    ? ([...groups.in, ...groups.out, ...groups.other].find((node) => node.key === pickedKey) ??
      null)
    : null;
  const setPicked = (node: CircleNode | null) => setPickedKey(node ? node.key : null);
  const { placed, rest } = circleLayout(groups, options);
  const maxCount = Math.max(1, ...placed.map((node) => node.count));
  const left = placed.filter((node) => node.side === 'in');
  const right = placed.filter((node) => node.side === 'out');
  // As tall as the fuller side needs: a few accounts leave no empty space.
  const fullest = Math.max(left.length, right.length);
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
    [...groups.in, ...groups.out, ...groups.other].map((node) => node.address)
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
              gridTemplateColumns: '1fr 1fr',
              gap: 2,
              px: { xs: 0.5, sm: 2 },
            }}
          >
            <SideHeading side="in" accounts={groups.in.length} more={rest.in} />
            <SideHeading side="out" accounts={groups.out.length} more={rest.out} />
          </Box>
          <Box
            component="figure"
            aria-label={`${me.label} and ${plural(accounts, 'linked account')}`}
            sx={{
              position: 'relative',
              m: 0,
              width: '100%',
              aspectRatio: aspect,
              // Room for the avatars at the edges.
              p: { xs: 2.5, sm: 3 },
              boxSizing: 'border-box',
            }}
          >
            <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
              <Lines placed={placed} maxCount={maxCount} active={active} />
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
              ].map(({ side, list }) =>
                list.length ? (
                  <Box
                    key={side}
                    component="ul"
                    aria-label={`${sideWords(side)}, the most transactions first`}
                    sx={{ m: 0, p: 0 }}
                  >
                    {list.map((node, i) => (
                      <Node
                        key={node.key}
                        node={node}
                        index={i}
                        named={!phone}
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
        The bigger the avatar and its line, the more transactions went that way. Press one for its
        transactions.
      </Typography>
      {rest.in || rest.out ? (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Button onClick={onShowList} sx={{ minHeight: 44 }}>
            {`${plural(rest.in + rest.out, 'more account')} with fewer transactions: see the list`}
          </Button>
        </Box>
      ) : null}
      <CircleNodeDialog node={picked} address={address} onClose={() => setPicked(null)} />
    </Box>
  );
}
