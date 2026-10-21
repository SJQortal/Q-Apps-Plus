/** An asset's own colour, as its coin has it: the theme's info blue turned to the asset's hue. */
import type { Theme } from '@mui/material/styles';
import { assetHue } from '../../../../rules/explorer/assets';
import { withHue } from '../../../decisions/sectionAccents';

export function assetAccent(theme: Theme, assetId: number): string {
  return withHue(theme.palette.info.main, assetHue(assetId));
}
