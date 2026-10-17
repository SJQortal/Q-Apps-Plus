/**
 * The Explorer's status chips in colour: where an account stands in MINTER,
 * whether it mints now, its level, and its part in a group or a name. The
 * colour says what kind of fact it is, never good or bad: MINTER blue,
 * Minter Admins violet, Dev Admins (the dev group's admins) teal, minting
 * green with a live dot, a ban red, a penalty
 * amber, a group's owner gold; an account outside MINTER, or one that was
 * in it, stays quiet grey. A level's tint deepens with the level.
 *
 * Every accent comes from the theme (the theme's own colours, or its info
 * blue turned to a hue: sectionAccents.ts → withHue), on a soft wash of
 * itself with an edge; the words keep 4.5:1 (utils/readable.ts). The chip's
 * words say it all: the icon and dot are decorative. What each one means is
 * said on hover or a tap, and on focus where it takes it (`focusable`:
 * ExplainTip, constants/chipExplanations.ts).
 */
import type { ReactElement } from 'react';
import { Box, Chip } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import CodeOutlinedIcon from '@mui/icons-material/CodeOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import StarOutlineOutlinedIcon from '@mui/icons-material/StarOutlineOutlined';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import { readableOn } from '../../utils/readable';
import { ExplainTip } from '../common/ExplainTip';
import {
  ADMIN_EXPLANATION,
  BANNED_EXPLANATION,
  DEV_ADMIN_EXPLANATION,
  FORMER_EXPLANATION,
  GROUP_ADMIN_EXPLANATION,
  GROUP_OWNER_EXPLANATION,
  levelExplanation,
  MEMBER_EXPLANATION,
  MINTING_EXPLANATION,
  OUTSIDE_EXPLANATION,
  penaltyExplanation,
  PRIMARY_NAME_EXPLANATION,
} from '../../constants/chipExplanations';
import { statusAccent, statusKindOf, type StatusKind } from './statusKinds';

const ICON: Partial<Record<StatusKind, ReactElement>> = {
  admin: <AdminPanelSettingsOutlinedIcon />,
  devAdmin: <CodeOutlinedIcon />,
  groupAdmin: <AdminPanelSettingsOutlinedIcon />,
  member: <VerifiedOutlinedIcon />,
  banned: <BlockOutlinedIcon />,
  penalty: <WarningAmberOutlinedIcon />,
  former: <HistoryOutlinedIcon />,
  owner: <WorkspacePremiumOutlinedIcon />,
  primary: <StarOutlineOutlinedIcon />,
};

/** A small dot that pulses while something is live (still with reduced motion). */
function LiveDot() {
  return (
    <Box
      component="span"
      aria-hidden
      className="qmp-live-dot"
      sx={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        bgcolor: 'currentColor',
        ml: '6px !important',
        mr: '-2px !important',
        flexShrink: 0,
      }}
    />
  );
}

/** What a chip of `kind` means, on its own (a plain tag says it all). */
function explanationOf(kind: StatusKind, label: string): string | null {
  switch (kind) {
    case 'admin':
      return ADMIN_EXPLANATION;
    case 'devAdmin':
      return DEV_ADMIN_EXPLANATION;
    case 'member':
      return MEMBER_EXPLANATION;
    case 'minting':
      return MINTING_EXPLANATION;
    case 'banned':
      return BANNED_EXPLANATION;
    case 'penalty':
      return penaltyExplanation();
    case 'former':
      return FORMER_EXPLANATION;
    case 'outside':
      return OUTSIDE_EXPLANATION;
    case 'level':
      return levelExplanation(Number(label.replace(/\D/g, '')));
    case 'owner':
      return GROUP_OWNER_EXPLANATION;
    case 'groupAdmin':
      return GROUP_ADMIN_EXPLANATION;
    case 'primary':
      return PRIMARY_NAME_EXPLANATION;
    default:
      return null;
  }
}

/** How strong a level's wash is: from soft at level 0 to full at level 10. */
function levelWash(level: number, dark: boolean): number {
  const base = dark ? 0.1 : 0.08;
  return base + Math.min(Math.max(level, 0), 10) * (dark ? 0.022 : 0.016);
}

export function StatusChip({
  label,
  kind = statusKindOf(label),
  explain,
  focusable = false,
}: {
  label: string;
  /** What it says (from its words when left out). */
  kind?: StatusKind;
  /** What it means, said on hover, a tap or focus (by its kind when left out; null: nothing). */
  explain?: string | null;
  /** Takes the keyboard focus to say what it means (a page's header; not a list's rows). */
  focusable?: boolean;
}) {
  const text = explain === undefined ? explanationOf(kind, label) : explain;
  return (
    <ExplainTip text={text} focusable={focusable}>
      <ChipOf label={label} kind={kind} />
    </ExplainTip>
  );
}

function ChipOf({ label, kind, ...rest }: { label: string; kind: StatusKind }) {
  const theme = useTheme();
  const accent = statusAccent(theme, kind);
  const dark = theme.palette.mode === 'dark';
  if (!accent)
    return (
      <Chip
        {...rest}
        size="small"
        variant="outlined"
        label={label}
        icon={ICON[kind]}
        sx={{ fontSize: 14, color: 'text.secondary', '& .MuiChip-icon': { color: 'inherit' } }}
      />
    );
  const level = kind === 'level' ? Number(label.replace(/\D/g, '')) : 0;
  const wash = kind === 'level' ? levelWash(level, dark) : dark ? 0.16 : 0.12;
  // Read against the chip's own wash over every surface, not the bare page.
  const text = readableOn(theme, accent, wash);
  return (
    <Chip
      {...rest}
      size="small"
      label={label}
      icon={kind === 'minting' ? <LiveDot /> : ICON[kind]}
      sx={{
        fontSize: 14,
        fontWeight: 600,
        color: text,
        bgcolor: alpha(accent, wash),
        border: `1px solid ${alpha(accent, dark ? 0.5 : 0.45)}`,
        '& .MuiChip-icon': { color: accent, fontSize: 18 },
      }}
    />
  );
}
