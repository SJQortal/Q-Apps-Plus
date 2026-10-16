import { usePhoneLayout } from '../../hooks/usePhoneLayout';
import { useLandscapeFrame } from '../../utils/hubFrame';
import { phoneItems, railItems, type NavKey } from './navItems';
import { useDecisionsInNav } from './useDecisionsInNav';

/**
 * Whether the navigation on screen (the phone bar or the rail) has `key`.
 * A page that isn't in it is a sub-page there and shows Back: Decisions
 * while it isn't in the navigation (useDecisionsInNav), History in a phone
 * bar that has Decisions. When both lists agree (Settings: never in the
 * phone bar, always in the rail) that is the answer at once, so Home's gear
 * and Settings' Back are there while the status loads and after it fails.
 * Otherwise, until it is known, it answers yes, so Back doesn't flash.
 */
export function useNavHas(key: NavKey): boolean {
  const phone = usePhoneLayout();
  const landscape = useLandscapeFrame();
  const withDecisions = useDecisionsInNav();
  const itemsFor = phone && !landscape ? phoneItems : railItems;
  const withIt = itemsFor(true).some((item) => item.key === key);
  const without = itemsFor(false).some((item) => item.key === key);
  if (withIt === without) return withIt;
  if (withDecisions === undefined) return true;
  return withDecisions ? withIt : without;
}
