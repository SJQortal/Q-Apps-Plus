import { usePhoneLayout } from '../../hooks/usePhoneLayout';
import { useLandscapeFrame } from '../../utils/hubFrame';
import { phoneItems, railItems, type NavKey } from './navItems';

/**
 * Whether the navigation on screen (the phone bar or the rail) has `key`.
 * A page that isn't in it is a sub-page there and shows Back: Settings in
 * the phone bar (a gear in Home's header opens it).
 */
export function useNavHas(key: NavKey): boolean {
  const phone = usePhoneLayout();
  const landscape = useLandscapeFrame();
  const items = phone && !landscape ? phoneItems() : railItems();
  return items.some((item) => item.key === key);
}
