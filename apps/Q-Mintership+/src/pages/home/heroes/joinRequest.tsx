/**
 * For an account outside MINTER whose MINTER join request is open (sent
 * before, from another app or an older version of this one; it can't be
 * withdrawn): one plain line on what happens to it. Nothing invites anyone
 * to send one: nominators choose who to nominate (Simon, 2026-10-18).
 */
import type { MyStatus } from '../../../rules/status';
import { HeroText } from '../Hero';

export function JoinRequestOpen({ status }: { status: MyStatus }) {
  if (!status.hasJoinRequest) return null;
  return (
    <HeroText muted>
      Your account already has an open request to join MINTER. It stays open until a nomination of
      you is approved, which then makes you a member at once, or until the Minter Admins decline it.
    </HeroText>
  );
}
