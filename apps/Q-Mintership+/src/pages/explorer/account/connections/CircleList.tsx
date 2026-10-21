/**
 * The circle's accounts as a list, under it (Simon, 2026-10-19: "I actually
 * want that list to display under that view, with clear line between the
 * list of the most prominent that are on the circular view, and the ones
 * that are not displayed there"). Each side its own list, in the circle's
 * order, Received from beside Sent to on wider screens as in the circle,
 * then Sent and received: first the accounts the circle draws, then a line
 * and "Not in the circle", and the rest, 20 at a time (each row looks up
 * a name). A row opens the same transactions as its avatar.
 */
import { Box, Button, ButtonBase, Typography } from '@mui/material';
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import { visuallyHidden } from '@mui/utils';
import { MarkedName } from '../../../../components/common/MarkedName';
import { NameAvatar } from '../../../../components/common/NameAvatar';
import { useDisplayName } from '../../../../hooks/useDisplayName';
import type { CircleGroups, CircleNode, CircleOrder } from '../../../../rules/explorer/circle';
import { formatCount, plural } from '../../../../utils/format';
import { FOCUSABLE_ROW_SX, useShowMore } from '../names/useShowMore';
import { countWords, ringBackground, useSideColours } from './circleParts';
import { ROW_LIST_SX } from './ConnectionRow';
import { sideWords } from './words';

/** Rows not in the circle shown before "Show more". */
const PAGE_ROWS = 20;

type Side = 'in' | 'out' | 'both';

function ListRow({
  node,
  rank,
  onPick,
}: {
  node: CircleNode;
  /** Its place in the side's order, from 1. */
  rank: number;
  onPick: (node: CircleNode) => void;
}) {
  const shown = useDisplayName(node.address, node.address.startsWith('A') ? null : undefined);
  const colours = useSideColours();
  const words = countWords(node);
  return (
    <Box
      component="li"
      tabIndex={-1}
      sx={{
        listStyle: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        borderRadius: 2,
        ...FOCUSABLE_ROW_SX,
      }}
    >
      {/* Its place in the side's order, beside the button so the button's name is what it shows. */}
      <Typography
        aria-hidden
        component="span"
        sx={{
          minWidth: 24,
          textAlign: 'right',
          fontSize: 13,
          color: 'text.secondary',
          fontVariantNumeric: 'tabular-nums',
          flexShrink: 0,
        }}
      >
        {formatCount(rank)}
      </Typography>
      {/* Named by what it shows, then what it does: "Kit Kicked, 6 transactions: …: show them". */}
      <ButtonBase
        onClick={() => onPick(node)}
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 52,
          display: 'flex',
          justifyContent: 'flex-start',
          alignItems: 'center',
          gap: 1.25,
          px: 1,
          py: 0.75,
          borderRadius: 2,
          textAlign: 'left',
          '&:hover': { bgcolor: 'action.hover' },
          '&.Mui-focusVisible': { outline: 2, outlineColor: 'primary.main', outlineOffset: 2 },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            borderRadius: '50%',
            p: '2px',
            background: ringBackground(node, colours),
            flexShrink: 0,
          }}
        >
          <Box sx={{ display: 'flex', borderRadius: '50%', bgcolor: 'background.paper', p: '2px' }}>
            <NameAvatar name={shown.name} size={32} />
          </Box>
        </Box>
        <Box component="span" sx={{ display: 'block', minWidth: 0, flex: 1 }}>
          <Box
            component="span"
            sx={{
              display: 'block',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            <MarkedName name={shown.name}>{shown.label}</MarkedName>
            <Box component="span" sx={visuallyHidden}>
              ,{' '}
            </Box>
          </Box>
          <Box
            component="span"
            sx={{
              display: 'block',
              typography: 'body2',
              color: 'text.secondary',
              overflowWrap: 'anywhere',
            }}
          >
            {words}
            <Box component="span" sx={visuallyHidden}>
              : show them
            </Box>
          </Box>
        </Box>
        <ChevronRightOutlinedIcon
          aria-hidden
          fontSize="small"
          sx={{ color: 'text.secondary', flexShrink: 0 }}
        />
      </ButtonBase>
    </Box>
  );
}

function SideList({
  side,
  nodes,
  inCircle,
  order,
  onPick,
}: {
  side: Side;
  /** The side's accounts, in the circle's order. */
  nodes: readonly CircleNode[];
  /** How many of them the circle draws. */
  inCircle: number;
  order: CircleOrder;
  onPick: (node: CircleNode) => void;
}) {
  const colours = useSideColours();
  const circled = nodes.slice(0, inCircle);
  const rest = nodes.slice(inCircle);
  const { shown, showMore, listRef } = useShowMore(PAGE_ROWS, `circle-list:${side}`);
  const visible = rest.slice(0, shown);
  const headingId = `circle-list-${side}`;
  return (
    <Box
      component="section"
      aria-labelledby={headingId}
      sx={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}
    >
      <Typography
        component="h4"
        id={headingId}
        sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontWeight: 700, fontSize: 15 }}
      >
        <Box
          aria-hidden
          component="span"
          sx={{
            width: 18,
            height: 4,
            borderRadius: 2,
            flexShrink: 0,
            background:
              side === 'both'
                ? `linear-gradient(90deg, ${colours.in} 50%, ${colours.out} 50%)`
                : colours[side],
          }}
        />
        {sideWords(side)}
        <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary', fontSize: 14 }}>
          ({formatCount(nodes.length)})
        </Box>
      </Typography>
      <Typography variant="body2" color="text.secondary">
        In the circle
      </Typography>
      <Box component="ul" aria-label={`${sideWords(side)}: in the circle`} sx={ROW_LIST_SX}>
        {circled.map((node, i) => (
          <ListRow key={node.key} node={node} rank={i + 1} onPick={onPick} />
        ))}
      </Box>
      {rest.length ? (
        <>
          {/* The clear line between what the circle draws and what it leaves out. */}
          <Box
            sx={{
              mt: 1.5,
              pt: 1,
              borderTop: 2,
              borderColor: 'text.disabled',
            }}
          >
            <Typography
              component="h5"
              variant="body2"
              sx={{ fontWeight: 700, color: 'text.secondary' }}
            >
              {`Not in the circle: ${plural(rest.length, 'account')} with ${
                order === 'qort' ? 'less QORT' : 'fewer transactions'
              }`}
            </Typography>
          </Box>
          <Box
            component="ul"
            ref={listRef}
            aria-label={`${sideWords(side)}: not in the circle`}
            sx={ROW_LIST_SX}
          >
            {visible.map((node, i) => (
              <ListRow key={node.key} node={node} rank={inCircle + i + 1} onPick={onPick} />
            ))}
          </Box>
          {rest.length > visible.length ? (
            <Button onClick={showMore} sx={{ alignSelf: 'flex-start', minHeight: 44 }}>
              Show more ({formatCount(rest.length - visible.length)} more)
            </Button>
          ) : null}
        </>
      ) : null}
    </Box>
  );
}

export function CircleList({
  groups,
  inCircle,
  order,
  onPick,
}: {
  groups: CircleGroups;
  /** How many of each side the circle draws (circleLayout). */
  inCircle: Record<Side, number>;
  order: CircleOrder;
  onPick: (node: CircleNode) => void;
}) {
  const sides = (['in', 'out', 'both'] as const).filter((side) => groups[side].length > 0);
  // Received from beside Sent to, as in the circle, when there are both.
  const paired = groups.in.length > 0 && groups.out.length > 0;
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        pt: 1,
        // As wide as the circle above it.
        width: '100%',
        maxWidth: 880,
        mx: 'auto',
      }}
    >
      <Typography component="h3" sx={{ fontWeight: 700, fontSize: 16 }}>
        {`The list, the most ${order === 'qort' ? 'QORT' : 'transactions'} first`}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            md: paired ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)',
          },
          columnGap: 3,
          rowGap: 3,
          alignItems: 'start',
        }}
      >
        {sides.map((side) => (
          <Box key={side} sx={side === 'both' ? { gridColumn: '1 / -1' } : undefined}>
            <SideList
              side={side}
              nodes={groups[side]}
              inCircle={inCircle[side]}
              order={order}
              onPick={onPick}
            />
          </Box>
        ))}
      </Box>
    </Box>
  );
}
