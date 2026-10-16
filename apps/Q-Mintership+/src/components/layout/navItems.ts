import type { SvgIconComponent } from '@mui/icons-material';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import TravelExploreOutlinedIcon from '@mui/icons-material/TravelExploreOutlined';
import { PATHS } from '../../routes/paths';

export type NavKey =
  'home' | 'decisions' | 'nominations' | 'history' | 'activity' | 'explorer' | 'settings';

export interface NavItem {
  key: NavKey;
  label: string;
  /** Shorter label for the phone bar. */
  short?: string;
  path: string;
  Icon: SvgIconComponent;
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'home', label: 'Home', path: PATHS.home, Icon: HomeOutlinedIcon },
  {
    key: 'decisions',
    label: 'Decisions',
    path: PATHS.decisions,
    Icon: FactCheckOutlinedIcon,
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
  { key: 'explorer', label: 'Explorer', path: PATHS.explorer, Icon: TravelExploreOutlinedIcon },
  { key: 'settings', label: 'Settings', path: PATHS.settings, Icon: SettingsOutlinedIcon },
];

/**
 * Every item the rail shows. Decisions is there for Minter Admins, and for
 * everyone else while a proposal they may vote on is open (a removal, a ban,
 * a new Minter Admin: useDecisionsInNav).
 */
export function railItems(withDecisions: boolean): NavItem[] {
  return NAV_ITEMS.filter((item) => item.key !== 'decisions' || withDecisions);
}

/**
 * The phone bar: five items at most (docs/DESIGN.md → Mobile). Decisions,
 * when it is there, takes History's place; History stays reachable from
 * Home, Activity and every person page. Explorer takes the last slot;
 * Settings is then a gear in Home's header (HomePage), and shows Back.
 */
export function phoneItems(withDecisions: boolean): NavItem[] {
  const keys: NavKey[] = withDecisions
    ? ['home', 'decisions', 'nominations', 'activity', 'explorer']
    : ['home', 'nominations', 'history', 'activity', 'explorer'];
  return keys.map((key) => NAV_ITEMS.find((item) => item.key === key) as NavItem);
}

export function isNavActive(pathname: string, path: string): boolean {
  if (path === '/') return pathname === '/' || pathname === '';
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** What a nav item's count says to screen readers: "3 waiting for you", "2 new". */
export function badgeWords(key: NavKey, count: number): string {
  return key === 'history' ? `${count} new` : `${count} waiting for you`;
}
