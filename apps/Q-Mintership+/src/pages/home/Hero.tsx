/**
 * The status hero every Home starts with: an eyebrow, a headline, a few
 * plain sentences with the account's real numbers, the primary action, and
 * a short "What's next". Plus the small inline pieces the heroes share.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Link, Typography, keyframes } from '@mui/material';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import { primarySoft } from '../../hub-theme';
import { Celebration } from '../../components/common/Celebration';
import { useDisplayName } from '../../hooks/useDisplayName';
import { personPath } from '../../routes/paths';
import { copyText } from '../../utils/links';
import { readablePrimary } from './readable';

const rise = keyframes`
  from { opacity: 0; transform: translate3d(0, 6px, 0); }
  to { opacity: 1; transform: none; }
`;

export interface HeroProps {
  eyebrow: string;
  title: ReactNode;
  /** The sentences: plain paragraphs (HeroText), a ring, a progress bar. */
  children?: ReactNode;
  /** Shown beside the headline (a k-of-n ring). */
  aside?: ReactNode;
  /** The primary action first; full width on phones. */
  actions?: ReactNode;
  /** One or two sentences about what happens next. */
  next?: ReactNode;
  celebrate?: boolean;
}

export function Hero({ eyebrow, title, children, aside, actions, next, celebrate }: HeroProps) {
  const id = useId();
  return (
    <Box
      component="section"
      aria-labelledby={id}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        p: { xs: 2, sm: 3 },
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        animation: `${rise} 200ms ease-out both`,
      }}
    >
      <Celebration active={Boolean(celebrate)} />
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            component="p"
            sx={{
              color: (theme) => readablePrimary(theme),
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              mb: 0.5,
            }}
          >
            {eyebrow}
          </Typography>
          <Typography
            id={id}
            component="h2"
            sx={{
              fontSize: { xs: 22, sm: 26 },
              fontWeight: 800,
              lineHeight: 1.2,
              overflowWrap: 'anywhere',
            }}
          >
            {title}
          </Typography>
        </Box>
        {aside ? <Box sx={{ flexShrink: 0 }}>{aside}</Box> : null}
      </Box>
      {children ? (
        <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>{children}</Box>
      ) : null}
      {actions ? (
        <Box
          sx={{
            mt: 2.5,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            '& > *': { flex: { xs: '1 1 100%', sm: '0 0 auto' } },
            '& .MuiButton-root': { minHeight: 44 },
          }}
        >
          {actions}
        </Box>
      ) : null}
      {next ? (
        <Box
          sx={{
            mt: 2,
            p: 1.5,
            borderRadius: 1,
            bgcolor: (theme) => primarySoft(theme),
            display: 'flex',
            gap: 1,
            alignItems: 'flex-start',
          }}
        >
          <ArrowForwardOutlinedIcon
            aria-hidden
            sx={{ fontSize: 20, mt: '1px', color: 'text.primary' }}
          />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              What&rsquo;s next
            </Typography>
            <Typography component="div" variant="body2">
              {next}
            </Typography>
          </Box>
        </Box>
      ) : null}
    </Box>
  );
}

/** One paragraph of hero copy. */
export function HeroText({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return (
    <Typography
      component="p"
      sx={{ overflowWrap: 'anywhere', color: muted ? 'text.secondary' : 'text.primary' }}
    >
      {children}
    </Typography>
  );
}

/** A real number in running text, bold and with even digits. */
export function Num({ children }: { children: ReactNode }) {
  return (
    <Box component="strong" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
      {children}
    </Box>
  );
}

/** A person's name (or short address) in running text, linking to their page. */
export function PersonLink({ address, name }: { address: string; name?: string | null }) {
  const shown = useDisplayName(address, name);
  return (
    <Link
      component={RouterLink}
      to={personPath(address)}
      underline="always"
      sx={{ fontWeight: 600, overflowWrap: 'anywhere', color: (theme) => readablePrimary(theme) }}
    >
      {shown.label}
    </Link>
  );
}

/** "Ada", "Ada and Bo", "Ada, Bo and Cy" as person links. */
export function PeopleList({
  people,
}: {
  people: Array<{ address: string; name?: string | null }>;
}) {
  return (
    <>
      {people.map((p, i) => (
        <span key={p.address}>
          {i > 0 ? (i === people.length - 1 ? ' and ' : ', ') : ''}
          <PersonLink address={p.address} name={p.name} />
        </span>
      ))}
    </>
  );
}

/** A button that copies `text` and says so for a moment (announced to screen readers). */
export function CopyButton({
  text,
  label,
  copiedLabel = 'Copied',
  variant = 'outlined',
}: {
  text: string;
  label: string;
  copiedLabel?: string;
  variant?: 'contained' | 'outlined' | 'text';
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );
  return (
    <Button
      variant={variant}
      startIcon={copied ? <CheckOutlinedIcon /> : <ContentCopyOutlinedIcon />}
      onClick={async () => {
        if (!(await copyText(text))) return;
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1800);
      }}
    >
      <span aria-live="polite">{copied ? copiedLabel : label}</span>
    </Button>
  );
}
