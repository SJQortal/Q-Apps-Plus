import type { SvgIconComponent } from '@mui/icons-material';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { PATHS } from '../../routes/paths';

export type NavKey = 'home' | 'decisions' | 'nominations' | 'history' | 'activity' | 'settings';

export interface NavItem {
  key: NavKey;
  label: string;
  /** Shorter label for the phone bar. */
  short?: string;
  path: string;
  Icon: SvgIconComponent;
  /** Only Minter Admins see it. */
  adminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'home', label: 'Home', path: PATHS.home, Icon: HomeOutlinedIcon },
  {
    key: 'decisions',
    label: 'Decisions',
    path: PATHS.decisions,
    Icon: FactCheckOutlinedIcon,
    adminOnly: true,
  },
  {
    key: 'nominations',
    label: 'Nominations',
    short: 'Nominees',
    path: PATHS.nominations,
    Icon: HowToRegOutlinedIcon,
  },
  { key: 'history', label: 'History', path: PATHS.history, Icon: HistoryOutlinedIcon },
  { key: 'activity', label: 'Activity', path: PATHS.activity, Icon: InsightsOutlinedIcon },
  { key: 'settings', label: 'Settings', path: PATHS.settings, Icon: SettingsOutlinedIcon },
];

/** Every item the rail shows. */
export function railItems(isAdmin: boolean): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
}

/**
 * The phone bar: five items at most (docs/DESIGN.md → Mobile). Admins get
 * Decisions in place of History; History stays reachable from Home,
 * Activity and every person page.
 */
export function phoneItems(isAdmin: boolean): NavItem[] {
  const keys: NavKey[] = isAdmin
    ? ['home', 'decisions', 'nominations', 'activity', 'settings']
    : ['home', 'nominations', 'history', 'activity', 'settings'];
  return keys.map((key) => NAV_ITEMS.find((item) => item.key === key) as NavItem);
}

export function isNavActive(pathname: string, path: string): boolean {
  if (path === '/') return pathname === '/' || pathname === '';
  return pathname === path || pathname.startsWith(`${path}/`);
}
