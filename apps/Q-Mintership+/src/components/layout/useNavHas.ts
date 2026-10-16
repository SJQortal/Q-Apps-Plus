import { useMyStatus } from '../../hooks/useData';
import { usePhoneLayout } from '../../hooks/usePhoneLayout';
import { useLandscapeFrame } from '../../utils/hubFrame';
import { phoneItems, railItems, type NavKey } from './navItems';

/**
 * Whether the navigation on screen (the phone bar or the rail) has `key`.
 * A page that isn't in it is a sub-page there and shows Back: Decisions for
 * members, History in a Minter Admin's phone bar. When both roles' lists
 * agree (Settings: never in the phone bar, always in the rail) that is the
 * answer at once, so Home's gear and Settings' Back are there while the
 * status loads and after it fails. Otherwise, until the status is known, it
 * answers yes, so Back doesn't flash.
 */
export function useNavHas(key: NavKey): boolean {
  const phone = usePhoneLayout();
  const landscape = useLandscapeFrame();
  const { status } = useMyStatus();
  const itemsFor = phone && !landscape ? phoneItems : railItems;
  const asAdmin = itemsFor(true).some((item) => item.key === key);
  const asMember = itemsFor(false).some((item) => item.key === key);
  if (asAdmin === asMember) return asAdmin;
  if (!status) return true;
  return status.isAdmin ? asAdmin : asMember;
}
