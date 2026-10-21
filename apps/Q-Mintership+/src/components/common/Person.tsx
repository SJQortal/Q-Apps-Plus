/**
 * People everywhere: an avatar and a name (or a short address), linking to
 * the person's page, or inside the Explorer to their account there
 * (personLinks.tsx). Names come from what the caller already has, or from
 * the cached /names/primary lookup.
 */
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, IconButton, Link, Tooltip, Typography } from '@mui/material';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import { useDisplayName } from '../../hooks/useDisplayName';
import { shortAddress } from '../../utils/format';
import { copyText } from '../../utils/links';
import { MarkedName } from './MarkedName';
import { NameAvatar } from './NameAvatar';
import { usePersonLinks } from './personLinks';

export interface PersonChipProps {
  address: string;
  /** A name the caller already has; `null` means "has no name"; omit to look it up. */
  name?: string | null;
  size?: number;
  /** A line under the name, e.g. "Level 6 · nominated 2 days ago". */
  secondary?: React.ReactNode;
  /** Link to the person's page (default true). */
  link?: boolean;
  /** Bold name (default true). */
  strong?: boolean;
  /**
   * Inside a sentence (PersonInline): only the name is the link, at the text's size,
   * always underlined.
   */
  inline?: boolean;
  /**
   * On phones a smaller avatar (20 px) and name (14 px), the avatar centred
   * beside a name that wraps onto two lines (narrow columns: AnswerColumns).
   */
  compactOnPhone?: boolean;
  /** Right after the name, outside its link: a small mark (the viewer's own answer's tick). */
  mark?: React.ReactNode;
  /** The name crossed out (a proposal about them already waits); the second line says why. */
  struck?: boolean;
}

/**
 * Avatar + name (+ a second line), linking to the person's page. The whole
 * chip, at least 44 px tall, is the link's tap area (docs/DESIGN.md → Touch),
 * while the link itself stays the name, so the second line is still read.
 */
export function PersonChip({
  address,
  name,
  size = 36,
  secondary,
  link = true,
  strong = true,
  inline = false,
  compactOnPhone = false,
  mark = null,
  struck = false,
}: PersonChipProps) {
  const shown = useDisplayName(address, name);
  const links = usePersonLinks();
  const stretch = link && !inline;
  const label = (
    <Typography
      component="span"
      sx={{
        fontWeight: strong ? 600 : 400,
        overflowWrap: 'anywhere',
        display: 'block',
        lineHeight: 1.3,
        ...(compactOnPhone ? { fontSize: { xs: 14 }, lineHeight: { xs: 1.25, sm: 1.3 } } : {}),
        ...(struck ? { textDecoration: 'line-through', color: 'text.secondary' } : {}),
      }}
    >
      <MarkedName name={shown.name}>{shown.label}</MarkedName>
    </Typography>
  );
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: compactOnPhone ? { xs: 0.75, sm: 1 } : 1.25,
        py: compactOnPhone ? { xs: 0.25, sm: 0.5 } : 0,
        minWidth: 0,
        ...(stretch
          ? { position: 'relative', width: 'fit-content', maxWidth: '100%', minHeight: 44 }
          : {}),
      }}
    >
      <NameAvatar name={shown.name} size={size} phoneSize={compactOnPhone ? 20 : undefined} />
      <Box sx={{ minWidth: 0 }}>
        <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
          {link ? (
            <Link
              component={RouterLink}
              to={links.to(address)}
              state={links.state}
              // In a sentence the underline is what marks the name as a link (its colour
              // is the sentence's); a chip's avatar and layout already do.
              underline={inline ? 'always' : 'hover'}
              color="inherit"
              aria-label={`${shown.label}: ${links.verb}`}
              sx={
                stretch
                  ? { '&::after': { content: '""', position: 'absolute', inset: 0 } }
                  : inline
                    ? {
                        textDecorationColor: 'currentColor',
                        textUnderlineOffset: '0.15em',
                        '&:hover': { textDecorationThickness: '2px' },
                      }
                    : undefined
              }
            >
              {label}
            </Link>
          ) : (
            label
          )}
          {mark}
        </Box>
        {secondary ? (
          <Typography
            component="span"
            variant="body2"
            color="text.secondary"
            sx={{ display: 'block', lineHeight: 1.3 }}
          >
            {secondary}
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}

/**
 * A person inside a sentence ("Nominated by [Ada] 2 days ago"): small avatar,
 * the sentence's size and colour, the name always underlined.
 */
export function PersonInline({ address, name }: { address: string; name?: string | null }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        verticalAlign: 'middle',
        maxWidth: '100%',
        // Its words inline with the sentence; the avatar stays a circle with its letter.
        '& p, & span:not([data-avatar])': { display: 'inline' },
        // The name reads as part of the sentence around it.
        '& .MuiTypography-root': { fontSize: 'inherit' },
      }}
    >
      <PersonChip address={address} name={name} size={20} strong={false} inline />
    </Box>
  );
}

/**
 * A row of small avatars (signers), each linking to the person ("Ada: open
 * their page"), the rest
 * counted. List semantics sit on the items, not on the links. Each avatar
 * is a 44 px tap target. `showNames` adds the names in a line below, for
 * phones, where a tooltip can't be read.
 */
export function AvatarStack({
  people,
  max = 8,
  size = 28,
  label,
  showNames = false,
}: {
  people: Array<{ address: string; name?: string | null }>;
  max?: number;
  size?: number;
  label: string;
  showNames?: boolean;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  // The first avatar lines up with the text above, its tap target reaching past it.
  const inset = Math.max(0, (44 - size) / 2);
  const list = (
    <Box
      component="ul"
      aria-label={label}
      sx={{
        listStyle: 'none',
        m: 0,
        ml: `${-inset}px`,
        p: 0,
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      {shown.map((p) => (
        <Box component="li" key={p.address} sx={{ display: 'flex' }}>
          <StackedAvatar address={p.address} name={p.name} size={size} />
        </Box>
      ))}
      {rest > 0 ? (
        <Box component="li" sx={{ display: 'flex', alignItems: 'center', px: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            +{rest}
          </Typography>
        </Box>
      ) : null}
    </Box>
  );
  if (!showNames) return list;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, minWidth: 0 }}>
      {list}
      {/* The same names the avatar links carry, readable without a tooltip. */}
      <Typography
        variant="body2"
        color="text.secondary"
        aria-hidden
        sx={{ overflowWrap: 'anywhere' }}
      >
        {shown.map((p, i) => (
          <span key={p.address}>
            {i > 0 ? (i === shown.length - 1 && !rest ? ' and ' : ', ') : ''}
            <PersonName address={p.address} name={p.name} />
          </span>
        ))}
        {rest > 0 ? ` and ${rest} more` : ''}
      </Typography>
    </Box>
  );
}

/**
 * A person's name as plain text (or their short address), crossed out when
 * MarkedName says so: for a name inside a line the caller styles.
 */
export function PersonName({ address, name }: { address: string; name?: string | null }) {
  const shown = useDisplayName(address, name);
  return <MarkedName name={shown.name}>{shown.label}</MarkedName>;
}

function StackedAvatar({
  address,
  name,
  size,
}: {
  address: string;
  name?: string | null;
  size: number;
}) {
  const shown = useDisplayName(address, name);
  const links = usePersonLinks();
  return (
    <Tooltip title={<MarkedName name={shown.name}>{shown.label}</MarkedName>}>
      <Link
        component={RouterLink}
        to={links.to(address)}
        state={links.state}
        aria-label={`${shown.label}: ${links.verb}`}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 44,
          minHeight: 44,
          borderRadius: '50%',
        }}
      >
        <NameAvatar name={shown.name} size={size} />
      </Link>
    </Tooltip>
  );
}

/**
 * A short address with a copy button. `label` names whose address it is
 * ("Alice's address (A)"), so several on one screen are told apart.
 */
export function AddressText({
  address,
  full = false,
  label,
}: {
  address: string;
  full?: boolean;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Box
      component="span"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}
    >
      <Typography
        component="span"
        variant="body2"
        sx={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          overflowWrap: 'anywhere',
        }}
      >
        {full ? address : shortAddress(address)}
      </Typography>
      <Tooltip title={copied ? 'Copied' : 'Copy address'}>
        <IconButton
          size="small"
          aria-label={
            label
              ? copied
                ? `${label} copied`
                : `Copy ${label}`
              : copied
                ? 'Address copied'
                : 'Copy address'
          }
          onClick={async () => {
            if (await copyText(address)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }
          }}
          sx={{ width: 44, height: 44 }}
        >
          {copied ? (
            <CheckOutlinedIcon fontSize="small" className="qmp-pop" />
          ) : (
            <ContentCopyOutlinedIcon fontSize="small" />
          )}
        </IconButton>
      </Tooltip>
    </Box>
  );
}
