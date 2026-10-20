/**
 * The colours of Overview's Activity chart: each transaction family's
 * (txFamilyAccent, as the transaction lists draw them) and each milestone's,
 * from the theme so every theme follows: MINTER blue for joining, Minter
 * Admin violet, red for a removal or a ban, gold for a nomination, the
 * names' pink, minting green, the quiet grey for leaving.
 */
import type { Theme } from '@mui/material/styles';
import { withHue } from '../../pages/decisions/sectionAccents';
import type { MarkKind } from '../../rules/explorer/activity';

export function markAccent(theme: Theme, kind: MarkKind): string {
  const p = theme.palette;
  switch (kind) {
    case 'joined':
      return p.primary.main;
    case 'asked':
      return p.info.main;
    case 'declined':
      return p.warning.main;
    case 'removed':
    case 'banned':
      return p.error.main;
    case 'admin':
      return withHue(p.info.main, 275);
    case 'unbanned':
      return withHue(p.info.main, 172);
    case 'nominated':
      return withHue(p.info.main, 45);
    case 'name':
      return withHue(p.info.main, 320);
    case 'minting':
      return p.success.main;
    default:
      return p.text.secondary;
  }
}
