import type { SvgIconComponent } from '@mui/icons-material';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import HowToVoteOutlinedIcon from '@mui/icons-material/HowToVoteOutlined';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import LeaderboardOutlinedIcon from '@mui/icons-material/LeaderboardOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { PATHS } from '../../routes/paths';

export interface NavItem {
  label: string;
  path: string;
  Icon: SvgIconComponent;
  /** Only shown to Minter Admins and forum admins (the legacy ADMIN BOARD / ADMIN TOOLS buttons). */
  adminOnly?: boolean;
  /** Shown in the phone bottom bar (at most five). */
  phone?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Home', path: PATHS.home, Icon: HomeOutlinedIcon, phone: true },
  { label: 'Forum', path: PATHS.forum, Icon: ForumOutlinedIcon, phone: true },
  { label: 'Minter Board', path: PATHS.minters, Icon: HowToVoteOutlinedIcon, phone: true },
  { label: 'MAM Board', path: PATHS.mam, Icon: AdminPanelSettingsOutlinedIcon },
  { label: 'Stats', path: PATHS.stats, Icon: LeaderboardOutlinedIcon, phone: true },
  { label: 'Admin Board', path: PATHS.adminBoard, Icon: LockOutlinedIcon, adminOnly: true },
  { label: 'Admin Tools', path: PATHS.tools, Icon: BuildOutlinedIcon, adminOnly: true },
  { label: 'Settings', path: PATHS.settings, Icon: SettingsOutlinedIcon, phone: true },
];

export function isNavActive(pathname: string, path: string): boolean {
  if (path === '/') return pathname === '/' || pathname === '';
  return pathname === path || pathname.startsWith(`${path}/`);
}
