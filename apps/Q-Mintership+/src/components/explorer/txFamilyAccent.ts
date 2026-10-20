/**
 * Each transaction family's colour, for its icon in a soft circle (a row of
 * the Explorer's lists): payments green, names pink, minting amber, groups
 * the theme's blue, QDN cyan, trading orange, messages the theme's info
 * blue, the rest grey. From the theme (its own colours, or its info blue
 * turned to a hue: sectionAccents.ts → withHue), so it follows every theme.
 * Decorative: the sentence beside the icon says what happened.
 */
import type { Theme } from '@mui/material/styles';
import { withHue } from '../../pages/decisions/sectionAccents';
import type { TxFamilyKey } from '../../rules/explorer/txFamilies';

export type TxFamily = Exclude<TxFamilyKey, 'all'>;

export const TX_FAMILIES: readonly TxFamily[] = [
  'payments',
  'names',
  'minting',
  'groups',
  'qdn',
  'trading',
  'messages',
  'other',
];

export function txFamilyAccent(theme: Theme, family: TxFamily): string {
  const p = theme.palette;
  switch (family) {
    case 'payments':
      return p.success.main;
    case 'names':
      return withHue(p.info.main, 320);
    case 'minting':
      return p.warning.main;
    case 'groups':
      return p.primary.main;
    case 'qdn':
      return withHue(p.info.main, 188);
    case 'trading':
      return withHue(p.info.main, 22);
    case 'messages':
      return p.info.main;
    default:
      return p.text.secondary;
  }
}
