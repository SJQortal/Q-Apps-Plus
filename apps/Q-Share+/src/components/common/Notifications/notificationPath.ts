import { collectionPath } from "../../../utils/collections";
import { sharePath } from "../../../utils/qortalLinks";
import type { AppNotification } from "../../../utils/notifications/store";

/** Where a notification leads: the share's comments, the collection, or the comment's share once it is found. */
export function notificationPath(item: AppNotification): string {
  if (item.kind === "collection" && item.collection)
    return collectionPath(item.collection.name, item.collection.identifier);
  if (item.share) return `${sharePath(item.share.name, item.share.identifier)}#comments`;
  if (item.comment)
    return `/comment/${encodeURIComponent(item.comment.name)}/${encodeURIComponent(item.comment.identifier)}`;
  return "/";
}
