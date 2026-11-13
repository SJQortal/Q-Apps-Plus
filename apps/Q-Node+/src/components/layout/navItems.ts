import type { SvgIconComponent } from '@mui/icons-material';
import DnsOutlinedIcon from '@mui/icons-material/DnsOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';

export interface NavItem {
  /** i18n key under core:header */
  labelKey: string;
  path: string;
  Icon: SvgIconComponent;
}

export const NAV_ITEMS: NavItem[] = [
  { labelKey: 'node', path: '/', Icon: DnsOutlinedIcon },
  { labelKey: 'settings', path: '/settings', Icon: SettingsOutlinedIcon },
];

export function isNavActive(pathname: string, path: string): boolean {
  if (path === '/') return pathname === '/' || pathname === '';
  return pathname === path || pathname.startsWith(`${path}/`);
}
