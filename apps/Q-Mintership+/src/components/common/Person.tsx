/**
 * People everywhere: an avatar and a name (or a short address), linking to
 * the person's page. Names come from what the caller already has, or from the
 * cached /names/primary lookup.
 */
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, IconButton, Link, Tooltip, Typography } from '@mui/material';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import { useDisplayName } from '../../hooks/useDisplayName';
import { personPath } from '../../routes/paths';
import { shortAddress } from '../../utils/format';
import { copyText } from '../../utils/links';
import { NameAvatar } from './NameAvatar';

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
  /** Inside a sentence (PersonInline): only the name is the link, at the text's size. */
  inline?: boolean;
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
}: PersonChipProps) {
  const shown = useDisplayName(address, name);
  const stretch = link && !inline;
  const label = (
    <Typography
      component="span"
      sx={{
        fontWeight: strong ? 600 : 400,
        overflowWrap: 'anywhere',
        display: 'block',
        lineHeight: 1.3,
      }}
    >
      {shown.label}
    </Typography>
  );
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        minWidth: 0,
        ...(stretch
          ? { position: 'relative', width: 'fit-content', maxWidth: '100%', minHeight: 44 }
          : {}),
      }}
    >
      <NameAvatar name={shown.name} size={size} />
      <Box sx={{ minWidth: 0 }}>
        {link ? (
          <Link
            component={RouterLink}
            to={personPath(address)}
            underline="hover"
            color="inherit"
            aria-label={`${shown.label}: open their page`}
            sx={
              stretch
                ? { '&::after': { content: '""', position: 'absolute', inset: 0 } }
                : undefined
            }
          >
            {label}
          </Link>
        ) : (
          label
        )}
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

/** A person inside a sentence ("Nominated by [Ada] 2 days ago"): small avatar, the sentence's size. */
export function PersonInline({ address, name }: { address: string; name?: string | null }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        verticalAlign: 'middle',
        maxWidth: '100%',
        '& p, & span': { display: 'inline' },
        // The name reads as part of the sentence around it.
        '& .MuiTypography-root': { fontSize: 'inherit' },
      }}
    >
      <PersonChip address={address} name={name} size={20} strong={false} inline />
    </Box>
  );
}

/**
 * A row of small avatars (signers), each linking to the person, the rest
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
            <ShownName address={p.address} name={p.name} />
          </span>
        ))}
        {rest > 0 ? ` and ${rest} more` : ''}
      </Typography>
    </Box>
  );
}

function ShownName({ address, name }: { address: string; name?: string | null }) {
  return <>{useDisplayName(address, name).label}</>;
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
  return (
    <Tooltip title={shown.label}>
      <Link
        component={RouterLink}
        to={personPath(address)}
        aria-label={shown.label}
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

/** A short address with a copy button. */
export function AddressText({ address, full = false }: { address: string; full?: boolean }) {
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
          aria-label={copied ? 'Address copied' : 'Copy address'}
          onClick={async () => {
            if (await copyText(address)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }
          }}
          sx={{ width: 44, height: 44 }}
        >
          {copied ? (
            <CheckOutlinedIcon fontSize="small" />
          ) : (
            <ContentCopyOutlinedIcon fontSize="small" />
          )}
        </IconButton>
      </Tooltip>
    </Box>
  );
}
