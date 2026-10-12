import { useMyStatus } from '../../hooks/useData';
import { usePhoneLayout } from '../../hooks/usePhoneLayout';
import { useLandscapeFrame } from '../../utils/hubFrame';
import { phoneItems, railItems, type NavKey } from './navItems';

/**
 * Whether the navigation on screen (the phone bar or the rail) has `key`.
 * A page that isn't in it is a sub-page there and shows Back: Decisions for
 * members, History in a Minter Admin's phone bar. Until the status is known
 * it answers yes, so Back doesn't flash.
 */
export function useNavHas(key: NavKey): boolean {
  const phone = usePhoneLayout();
  const landscape = useLandscapeFrame();
  const { status } = useMyStatus();
  if (!status) return true;
  const items = phone && !landscape ? phoneItems(status.isAdmin) : railItems(status.isAdmin);
  return items.some((item) => item.key === key);
}
