/**
 * A group's avatar, as Qortal Hub shows it: the THUMBNAIL its owner
 * published as `qortal_group_avatar_<groupId>`, loaded once it nears the
 * screen; the group name's first letter until then, and for a group whose
 * owner has no name (MINTER and dev-group belong to Core's null account).
 * Hidden from screen readers: the group's name beside it says it.
 */
import { groupAvatarIdentifier } from '../../data/avatars';
import { NameAvatar } from './NameAvatar';

export function GroupAvatar({
  groupId,
  groupName,
  ownerName,
  size = 28,
}: {
  groupId: number;
  groupName: string | null;
  /** The owner's primary name; null or absent: no image to load. */
  ownerName?: string | null;
  size?: number;
}) {
  return (
    <NameAvatar
      name={ownerName ?? null}
      identifier={groupAvatarIdentifier(groupId)}
      letterFrom={groupName || '#'}
      size={size}
    />
  );
}
