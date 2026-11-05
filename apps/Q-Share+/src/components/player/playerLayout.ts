import { useSelector } from "react-redux";
import { useLandscapePhone, usePhoneLayout } from "../../hooks/usePhoneLayout";
import type { RootState } from "../../state/store";

/** The player bar: above the phone's bottom bar, at the foot of the window on wider screens. */
export const PLAYER_BAR_HEIGHT = 76;
export const PHONE_PLAYER_BAR_HEIGHT = 64;
/** On a phone held sideways, over the compact bottom bar: the frame is short there. */
export const COMPACT_PLAYER_BAR_HEIGHT = 52;

/** How much of the bottom the player bar covers (0 when nothing is queued). */
export function usePlayerBarHeight(): number {
  const phone = usePhoneLayout();
  const landscape = useLandscapePhone();
  const active = useSelector((state: RootState) => state.player.tracks.length > 0);
  if (!active) return 0;
  if (!phone) return PLAYER_BAR_HEIGHT;
  return landscape ? COMPACT_PLAYER_BAR_HEIGHT : PHONE_PLAYER_BAR_HEIGHT;
}
