import { useState, type ComponentType } from 'react';
import { styled } from '@mui/material/styles';
import type { SvgIconProps } from '@mui/material';
import MailOutlined from '@mui/icons-material/MailOutlined';
import StorefrontOutlined from '@mui/icons-material/StorefrontOutlined';
import FolderSharedOutlined from '@mui/icons-material/FolderSharedOutlined';
import SupportAgentOutlined from '@mui/icons-material/SupportAgentOutlined';
import OndemandVideoOutlined from '@mui/icons-material/OndemandVideoOutlined';
import CurrencyExchangeOutlined from '@mui/icons-material/CurrencyExchangeOutlined';
import VolunteerActivismOutlined from '@mui/icons-material/VolunteerActivismOutlined';
import BadgeOutlined from '@mui/icons-material/BadgeOutlined';
import DnsOutlined from '@mui/icons-material/DnsOutlined';
import GroupsOutlined from '@mui/icons-material/GroupsOutlined';
import AppsRounded from '@mui/icons-material/AppsRounded';
import type { AppIconId } from '../apps/manifest';
import { qortalAvatarUrl } from '../qortal/avatar';
import { hasQortalRequest } from '../qortal/request';
import { primarySoft } from '../hub-theme';

const ICONS: Record<AppIconId, ComponentType<SvgIconProps>> = {
  mail: MailOutlined,
  shop: StorefrontOutlined,
  share: FolderSharedOutlined,
  support: SupportAgentOutlined,
  tube: OndemandVideoOutlined,
  trade: CurrencyExchangeOutlined,
  fund: VolunteerActivismOutlined,
  names: BadgeOutlined,
  node: DnsOutlined,
  mintership: GroupsOutlined,
  apps: AppsRounded,
};

/** Avatars that failed to load, so a list doesn't re-request them on every render. */
const failedAvatars = new Map<string, number>();
const AVATAR_RETRY_MS = 60_000;

export function resetAvatarFailures() {
  failedAvatars.clear();
}

function avatarRecentlyFailed(name: string): boolean {
  const at = failedAvatars.get(name);
  return at !== undefined && Date.now() - at < AVATAR_RETRY_MS;
}

const Tile = styled('span', { shouldForwardProp: (prop) => prop !== '$size' })<{ $size: number }>(
  ({ theme, $size }) => ({
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: $size,
    height: $size,
    borderRadius: Math.max(8, Math.round($size * 0.22)),
    background: primarySoft(theme),
    color: theme.palette.mode === 'dark' ? theme.palette.primary.main : theme.palette.primary.dark,
    overflow: 'hidden',
    '& img': {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      transition: 'opacity 180ms ease',
    },
  })
);

interface AppIconProps {
  /** Qortal name whose avatar is the app icon. */
  name: string;
  icon: AppIconId;
  size?: number;
  /** Set false to skip the QDN avatar (e.g. in tests or tiny chips). */
  live?: boolean;
}

/**
 * The app's icon: the Qortal avatar of its name (the same image Hub's app
 * library shows), loaded lazily, with a bundled icon underneath until it
 * arrives or if it never does.
 */
export function AppIcon({ name, icon, size = 56, live = true }: AppIconProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(() => avatarRecentlyFailed(name));
  const Icon = ICONS[icon] ?? AppsRounded;
  const showAvatar = live && !failed && hasQortalRequest();
  return (
    <Tile $size={size} aria-hidden>
      {!loaded && <Icon sx={{ fontSize: Math.round(size * 0.52) }} />}
      {showAvatar && (
        <img
          src={qortalAvatarUrl(name)}
          alt=""
          loading="lazy"
          decoding="async"
          style={{ opacity: loaded ? 1 : 0 }}
          onLoad={() => setLoaded(true)}
          onError={() => {
            failedAvatars.set(name, Date.now());
            setFailed(true);
          }}
        />
      )}
    </Tile>
  );
}
