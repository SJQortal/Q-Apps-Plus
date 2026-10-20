import type { SvgIconComponent } from '@mui/icons-material';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import TravelExploreOutlinedIcon from '@mui/icons-material/TravelExploreOutlined';
import { PATHS } from '../../routes/paths';

export type NavKey = 'home' | 'decisions' | 'history' | 'explorer' | 'settings';

export interface NavItem {
  key: NavKey;
  label: string;
  /** Shorter label for the phone bar. */
  short?: string;
  path: string;
  /** Other paths it is the place of (a nomination's page, the nominate form). */
  also?: readonly string[];
  Icon: SvgIconComponent;
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'home', label: 'Home', path: PATHS.home, Icon: HomeOutlinedIcon },
  {
    key: 'decisions',
    label: 'Decisions',
    path: PATHS.decisions,
    // Nominations is one of its tabs (Simon, 2026-10-17): a nomination and the forms are its.
    also: [PATHS.nominations, PATHS.nominate, PATHS.propose],
    Icon: FactCheckOutlinedIcon,
  },
  { key: 'history', label: 'History', path: PATHS.history, Icon: HistoryOutlinedIcon },
  { key: 'explorer', label: 'Explorer', path: PATHS.explorer, Icon: TravelExploreOutlinedIcon },
  { key: 'settings', label: 'Settings', path: PATHS.settings, Icon: SettingsOutlinedIcon },
];

/**
 * Every item the rail shows, the same for everyone: Decisions holds the
 * nominations too, so it is in everyone's navigation.
 */
export function railItems(): NavItem[] {
  return NAV_ITEMS;
}

/**
 * The phone bar: five items at most (docs/DESIGN.md → Mobile): Home,
 * Decisions, History and Explorer. Minter Admin activity lives in the
 * Explorer (its page, under Browse: Minter Admins). Settings is a gear in
 * Home's header (HomePage), and shows Back.
 */
export function phoneItems(): NavItem[] {
  const keys: NavKey[] = ['home', 'decisions', 'history', 'explorer'];
  return keys.map((key) => NAV_ITEMS.find((item) => item.key === key) as NavItem);
}

/** Whether `pathname` is the item's place: its path or one under it (or one of its `also`). */
export function isNavActive(pathname: string, path: string, also: readonly string[] = []): boolean {
  if (path === '/') return pathname === '/' || pathname === '';
  return [path, ...also].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** What a nav item's count says to screen readers: "3 waiting for you", "2 new". */
export function badgeWords(key: NavKey, count: number): string {
  return key === 'history' ? `${count} new` : `${count} waiting for you`;
}
