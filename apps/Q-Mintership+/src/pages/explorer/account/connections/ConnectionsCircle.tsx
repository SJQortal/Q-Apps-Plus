/**
 * Connections as a circle (Simon, 2026-10-16): the account in the middle,
 * the accounts linked to it around it on one or two rings
 * (rules/explorer/circle.ts), each avatar sized by how many transactions
 * link them. A line to each: green for payments it received from them,
 * red for payments it sent to them, both side by side when it went each
 * way, the theme's blue for its other links (reward shares, minting level,
 * names). Each avatar opens that account (in the Explorer, the trail
 * growing); pointing at one, or tabbing to it, brings its line forward.
 *
 * Read the same way as the list: the avatars are a list of links in order
 * (the most linked first), each named with its counts; the lines are
 * decoration. The avatars pop in one after another (still with reduced
 * motion).
 */
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, ButtonBase, Tooltip, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { NameAvatar } from '../../../../components/common/NameAvatar';
import { usePersonLinks } from '../../../../components/common/personLinks';
import { MarkedName } from '../../../../components/common/MarkedName';
import { useDisplayName } from '../../../../hooks/useDisplayName';
import { circleLayout, circleNodes, type PlacedNode } from '../../../../rules/explorer/circle';
import type { Finding } from '../../../../rules/explorer/findings';
import { formatCount, plural } from '../../../../utils/format';

/** The line colours: payments each way, and every other link. */
function useLineColours() {
  const theme = useTheme();
  return {
    in: theme.palette.success.main,
    out: theme.palette.error.main,
    other: theme.palette.primary.main,
  };
}

/** "12 transactions: 5 received, 7 sent". */
function nodeWords(node: PlacedNode): string {
  const parts = [
    node.in ? `${formatCount(node.in)} received` : null,
    node.out ? `${formatCount(node.out)} sent` : null,
    node.other ? `${formatCount(node.other)} other` : null,
  ].filter(Boolean);
  return `${plural(node.count, 'transaction')}: ${parts.join(', ')}`;
}

/** The ring around an avatar: its line's colour, or green and red when both ways. */
function ringOf(node: PlacedNode, colours: ReturnType<typeof useLineColours>): string {
  if (node.in && node.out) return `linear-gradient(135deg, ${colours.in} 50%, ${colours.out} 50%)`;
  if (node.in) return colours.in;
  if (node.out) return colours.out;
  return colours.other;
}

function Lines({
  placed,
  maxCount,
  active,
}: {
  placed: PlacedNode[];
  maxCount: number;
  active: number | null;
}) {
  const colours = useLineColours();
  return (
    <Box
      component="svg"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
      className="qmp-fade"
      sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
    >
      {placed.map((node, i) => {
        const width = 1.25 + 3 * Math.sqrt(node.count / maxCount);
        const opacity = active === null ? 0.55 : active === i ? 1 : 0.15;
        // Two lines side by side when it went each way: offset across the line.
        const dx = node.x - 50;
        const dy = node.y - 50;
        const length = Math.hypot(dx, dy) || 1;
        const off = { x: (-dy / length) * 0.7, y: (dx / length) * 0.7 };
        const line = (colour: string, shift: number, key: string) => (
          <line
            key={key}
            x1={50 + off.x * shift}
            y1={50 + off.y * shift}
            x2={node.x + off.x * shift}
            y2={node.y + off.y * shift}
            stroke={colour}
            strokeWidth={width}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={{ opacity, transition: 'opacity 150ms ease' }}
          />
        );
        if (node.in && node.out)
          return [
            line(colours.in, 1, `${node.address}:in`),
            line(colours.out, -1, `${node.address}:out`),
          ];
        return line(node.in ? colours.in : node.out ? colours.out : colours.other, 0, node.address);
      })}
    </Box>
  );
}

function Node({
  node,
  index,
  onActive,
}: {
  node: PlacedNode;
  index: number;
  onActive: (index: number | null) => void;
}) {
  const shown = useDisplayName(node.address, node.address.startsWith('A') ? null : undefined);
  const links = usePersonLinks();
  const colours = useLineColours();
  const words = nodeWords(node);
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
      <Box className="qmp-pop" style={{ animationDelay: `${Math.min(index, 24) * 35}ms` }}>
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
            component={RouterLink}
            to={links.to(node.address)}
            state={links.state}
            aria-label={`${shown.label}, ${words}: ${links.verb}`}
            onMouseEnter={() => onActive(index)}
            onMouseLeave={() => onActive(null)}
            onFocus={() => onActive(index)}
            onBlur={() => onActive(null)}
            sx={{
              display: 'flex',
              borderRadius: '50%',
              p: '3px',
              background: ringOf(node, colours),
              transition: 'scale 150ms ease',
              '&:hover, &.Mui-focusVisible': { scale: '1.12' },
              '&.Mui-focusVisible': { outline: 2, outlineColor: 'primary.main', outlineOffset: 2 },
            }}
          >
            <Box
              sx={{ display: 'flex', borderRadius: '50%', bgcolor: 'background.paper', p: '2px' }}
            >
              <NameAvatar name={shown.name} size={node.size} />
            </Box>
          </ButtonBase>
        </Tooltip>
      </Box>
      {/* Its name under it on wider screens (the tooltip and the link say it everywhere). */}
      <Typography
        aria-hidden
        sx={{
          display: { xs: 'none', sm: 'block' },
          position: 'absolute',
          top: '100%',
          left: '50%',
          translate: '-50% 2px',
          maxWidth: 104,
          fontSize: 14,
          fontWeight: 600,
          lineHeight: 1.2,
          // Over the lines that pass under it: the page's own colour behind the words.
          bgcolor: 'background.default',
          px: 0.5,
          borderRadius: 1,
          textAlign: 'center',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          pointerEvents: 'none',
        }}
      >
        <MarkedName name={shown.name}>{shown.label}</MarkedName>
      </Typography>
    </Box>
  );
}

function Swatch({ colour, label }: { colour: string; label: string }) {
  return (
    <Box component="li" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
      <Box
        aria-hidden
        sx={{ width: 22, height: 4, borderRadius: 2, bgcolor: colour, flexShrink: 0 }}
      />
      <Typography variant="body2">{label}</Typography>
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
  const colours = useLineColours();
  const [active, setActive] = useState<number | null>(null);
  const nodes = circleNodes(recorded);
  const { placed, rest } = circleLayout(nodes);
  const maxCount = placed[0]?.count ?? 1;
  if (!placed.length)
    return (
      <Typography color="text.secondary">
        No accounts linked to it in what was checked, so there is nothing to draw.
      </Typography>
    );
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <Box
        component="figure"
        aria-label={`${me.label} and ${plural(nodes.length, 'linked account')}`}
        sx={{
          position: 'relative',
          m: 0,
          mx: 'auto',
          width: '100%',
          maxWidth: 640,
          aspectRatio: '1 / 1',
          // Room for the outer ring's biggest avatars at the edge.
          p: { xs: 3, sm: 4 },
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
              <NameAvatar name={me.name} size={72} />
            </Box>
            <Typography
              sx={{
                fontWeight: 700,
                maxWidth: 140,
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
          <Box
            component="ul"
            aria-label="Linked accounts, the most transactions first"
            sx={{ m: 0, p: 0 }}
          >
            {placed.map((node, i) => (
              <Node key={node.address} node={node} index={i} onActive={setActive} />
            ))}
          </Box>
        </Box>
      </Box>
      <Box
        component="ul"
        aria-label="What the lines mean"
        sx={{
          listStyle: 'none',
          m: 0,
          p: 0,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          columnGap: 2.5,
          rowGap: 1,
        }}
      >
        <Swatch colour={colours.in} label="Received from it" />
        <Swatch colour={colours.out} label="Sent to it" />
        <Swatch colour={colours.other} label="Reward shares, minting level, names" />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
        The bigger the avatar and its line, the more transactions link them.
      </Typography>
      {rest ? (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Button onClick={onShowList} sx={{ minHeight: 44 }}>
            {`${plural(rest, 'more account')} with fewer transactions: see the list`}
          </Button>
        </Box>
      ) : null}
    </Box>
  );
}
