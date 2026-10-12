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
}

/** Avatar + name (+ a second line), linking to the person's page. */
export function PersonChip({
  address,
  name,
  size = 36,
  secondary,
  link = true,
  strong = true,
}: PersonChipProps) {
  const shown = useDisplayName(address, name);
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
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
      <NameAvatar name={shown.name} size={size} />
      <Box sx={{ minWidth: 0 }}>
        {link ? (
          <Link
            component={RouterLink}
            to={personPath(address)}
            underline="hover"
            color="inherit"
            aria-label={`${shown.label}: open their page`}
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

/** A row of small avatars (signers), with the rest counted. */
export function AvatarStack({
  people,
  max = 8,
  size = 28,
  label,
}: {
  people: Array<{ address: string; name?: string | null }>;
  max?: number;
  size?: number;
  label: string;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <Box
      role="list"
      aria-label={label}
      sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}
    >
      {shown.map((p) => (
        <StackedAvatar key={p.address} address={p.address} name={p.name} size={size} />
      ))}
      {rest > 0 ? (
        <Typography role="listitem" variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
          +{rest}
        </Typography>
      ) : null}
    </Box>
  );
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
        role="listitem"
        aria-label={shown.label}
        sx={{ display: 'inline-flex', borderRadius: '50%' }}
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
