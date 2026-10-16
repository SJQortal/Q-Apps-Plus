/**
 * What each Explorer status chip says, and its colour (StatusChip.tsx): a
 * kind from the chip's own words, and its accent from the theme.
 */
import type { Theme } from '@mui/material/styles';
import { withHue } from '../../pages/decisions/sectionAccents';

export type StatusKind =
  | 'admin'
  | 'devAdmin'
  | 'member'
  | 'minting'
  | 'banned'
  | 'penalty'
  | 'former'
  | 'outside'
  | 'level'
  | 'owner'
  | 'groupAdmin'
  | 'primary'
  | 'plain';

/** The kind of a status chip, from its words (the words the Explorer already uses). */
export function statusKindOf(label: string): StatusKind {
  if (label === 'Minter Admin') return 'admin';
  if (label === 'Dev Admin') return 'devAdmin';
  if (label === 'MINTER member' || /^In MINTER( since |$)/.test(label)) return 'member';
  if (label === 'Minting now') return 'minting';
  if (label === 'Banned from MINTER') return 'banned';
  if (label === 'Minting penalty') return 'penalty';
  if (label === 'Former member') return 'former';
  if (label === 'Not in MINTER') return 'outside';
  if (/^Level \d+$/.test(label)) return 'level';
  return 'plain';
}

/** The accent of a kind, from `theme`; null for the quiet ones. */
export function statusAccent(theme: Theme, kind: StatusKind): string | null {
  const p = theme.palette;
  switch (kind) {
    case 'admin':
    case 'groupAdmin':
      return withHue(p.info.main, 275); // violet
    case 'member':
    case 'primary':
    case 'level':
      return p.primary.main;
    case 'minting':
      return p.success.main;
    case 'banned':
      return p.error.main;
    case 'penalty':
      return p.warning.main;
    case 'owner':
      return withHue(p.info.main, 45); // gold
    case 'devAdmin':
      return withHue(p.info.main, 172); // teal
    default:
      return null;
  }
}
