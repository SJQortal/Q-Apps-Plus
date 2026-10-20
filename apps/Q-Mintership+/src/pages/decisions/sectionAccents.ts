/**
 * Decisions' sections in colour, so the page reads as separate blocks: each
 * kind of decision (By type), the nominations waiting for a Minter Admin and
 * the Minter Admin polls have an accent of their own; the rest of the page's
 * sections share a neutral one.
 *
 * Every accent comes from the theme. Success, warning and error are used as
 * they are; the others are the theme's info blue turned to a hue of their
 * own, keeping its saturation and lightness, so they sit as well in light
 * and dark themes as the theme's own colours do. Accents tint a section,
 * edge it and colour its icon; the text on it stays the theme's text colour.
 */
import { decomposeColor, hslToRgb, type Theme } from '@mui/material/styles';
import type { SvgIconComponent } from '@mui/icons-material';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined';
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined';
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import PersonOffOutlinedIcon from '@mui/icons-material/PersonOffOutlined';
import PollOutlinedIcon from '@mui/icons-material/PollOutlined';
import type { DecisionGroup } from './decisionGroups';

export type SectionAccent = DecisionGroup | 'waiting' | 'polls' | 'neutral';

/** Hues (degrees) the theme's info blue is turned to. */
const TURNED: Partial<Record<SectionAccent, number>> = {
  liftBan: 170, // teal
  cancelInvite: 45, // amber
  admins: 235, // indigo
  polls: 285, // violet
};

/** `colour` with its hue set to `hue`, its saturation and lightness kept. */
export function withHue(colour: string, hue: number): string {
  const [r, g, b] = decomposeColor(colour).values.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return hslToRgb(`hsl(${hue}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`);
}

/** The accent colour of a section, from `theme`. */
export function sectionAccent(theme: Theme, key: SectionAccent): string {
  const p = theme.palette;
  const turned = TURNED[key];
  if (turned !== undefined) return withHue(p.info.main, turned);
  switch (key) {
    case 'invite':
      return p.success.main;
    case 'decline':
      return p.warning.main;
    case 'removal':
      return p.error.main;
    case 'waiting':
      return p.info.main;
    default:
      return p.text.secondary;
  }
}

/** Each section's icon, as its cards and History draw that kind of change. */
export const SECTION_ICON: Record<Exclude<SectionAccent, 'neutral'>, SvgIconComponent> = {
  invite: PersonAddAlt1OutlinedIcon,
  decline: PersonOffOutlinedIcon,
  removal: BlockOutlinedIcon,
  liftBan: LockOpenOutlinedIcon,
  cancelInvite: CancelOutlinedIcon,
  admins: AdminPanelSettingsOutlinedIcon,
  other: HowToRegOutlinedIcon,
  waiting: HourglassEmptyOutlinedIcon,
  polls: PollOutlinedIcon,
};
