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
 * words say it all: the icon and dot are decorative.
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

/** How strong a level's wash is: from soft at level 0 to full at level 10. */
function levelWash(level: number, dark: boolean): number {
  const base = dark ? 0.1 : 0.08;
  return base + Math.min(Math.max(level, 0), 10) * (dark ? 0.022 : 0.016);
}

export function StatusChip({
  label,
  kind = statusKindOf(label),
}: {
  label: string;
  /** What it says (from its words when left out). */
  kind?: StatusKind;
}) {
  const theme = useTheme();
  const accent = statusAccent(theme, kind);
  const dark = theme.palette.mode === 'dark';
  if (!accent)
    return (
      <Chip
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
