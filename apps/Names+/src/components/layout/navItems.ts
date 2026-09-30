import type { SvgIconComponent } from '@mui/icons-material';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';

export interface NavItem {
  /** i18n key under core:header */
  labelKey: string;
  path: string;
  Icon: SvgIconComponent;
}

export const NAV_ITEMS: NavItem[] = [
  { labelKey: 'my_names', path: '/', Icon: BadgeOutlinedIcon },
  { labelKey: 'market', path: '/market', Icon: StorefrontOutlinedIcon },
  { labelKey: 'settings', path: '/settings', Icon: SettingsOutlinedIcon },
];

export function isNavActive(pathname: string, path: string): boolean {
  if (path === '/') return pathname === '/' || pathname === '';
  return pathname === path || pathname.startsWith(`${path}/`);
}
