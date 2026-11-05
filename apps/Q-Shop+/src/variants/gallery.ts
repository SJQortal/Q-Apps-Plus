/**
 * A variant's product page shows the whole group's pictures (Simon,
 * 2026-10-24: "I want the images of all variants and values to show on
 * product page, and when user is clicking to change the image, the correct
 * variant and value changes as well"): each item's own, in the group's
 * order, then the product's (the lead's after its first, and those past its
 * third). Each picture knows the items it shows, so choosing it chooses its
 * item; one of the product's shows no item, and leaves the choice as it is.
 * The list is the same on every item's page, so it doesn't jump on a switch.
 */
import { valuesKey, variantItems, variantLabel, type VariantOption } from "./model";

export interface GroupPicture {
  src: string;
  /** The items it is the picture of; none for one of the product's. */
  items: string[][];
}

export interface GroupMember {
  values: string[];
  /** Its pictures as its catalogue holds them: the lead's first is its own, the rest the product's. */
  images: unknown;
  lead: boolean;
}

/** Up to 30 items' pictures and the product's 10. */
export const MAX_GROUP_PICTURES = 40;

const pictures = (images: unknown): string[] => (Array.isArray(images) ? images.filter((i): i is string => typeof i === "string" && !!i) : []);

/** The group's pictures, as its members are loaded so far, with the lead's pictures past its third (`more`). */
export function groupPictures(options: VariantOption[], members: GroupMember[], more: string[] = []): GroupPicture[] {
  const out: GroupPicture[] = [];
  const at = new Map<string, GroupPicture>();
  const add = (src: string, item: string[] | null) => {
    let picture = at.get(src);
    if (!picture) {
      picture = { src, items: [] };
      at.set(src, picture);
      out.push(picture);
    }
    if (item && !picture.items.some((i) => valuesKey(i) === valuesKey(item))) picture.items.push(item);
  };
  const byItem = new Map(members.map((m) => [valuesKey(m.values), m]));
  for (const item of variantItems(options)) {
    const member = byItem.get(valuesKey(item));
    if (!member) continue;
    const own = pictures(member.images);
    for (const src of member.lead ? own.slice(0, 1) : own) add(src, item);
  }
  const lead = members.find((m) => m.lead);
  for (const src of [...pictures(lead?.images).slice(1), ...more]) add(src, null);
  return out;
}

const isItem = (picture: GroupPicture | undefined, item: string[]) => !!picture?.items.some((i) => valuesKey(i) === valuesKey(item));

/** Where the gallery opens for an item: its first picture (0 when it has none yet). */
export function firstPictureOf(list: GroupPicture[], item: string[]): number {
  return Math.max(0, list.findIndex((p) => isItem(p, item)));
}

/**
 * The item a chosen picture leads to from the one shown: none when it shows
 * that one, or is the product's; else its item in the same variant, or with
 * the same value, or its first.
 */
export function itemForPicture(picture: GroupPicture | undefined, current: string[]): string[] | null {
  if (!picture || picture.items.length === 0 || isItem(picture, current)) return null;
  return (
    picture.items.find((i) => i[0] === current[0]) ?? picture.items.find((i) => i[1] !== undefined && i[1] === current[1]) ?? picture.items[0]
  );
}

/** The picture the gallery shows: the one chosen while it still fits the item shown, else the item's first. */
export function shownPicture(list: GroupPicture[], chosen: string | null, current: string[]): number {
  const index = chosen ? list.findIndex((p) => p.src === chosen) : -1;
  if (index >= 0 && (list[index].items.length === 0 || isItem(list[index], current))) return index;
  return firstPictureOf(list, current);
}

/** What a picture is of, for its label: its item ("Round / Pale"), its items of one variant ("Round / Orange, Red"), or the variant when it is all of them. */
export function pictureCaption(picture: GroupPicture, options: VariantOption[]): string | undefined {
  const [first] = picture.items;
  if (!first) return undefined;
  if (picture.items.length === 1) return variantLabel(first);
  if (!picture.items.every((i) => i[0] === first[0] && i[1] !== undefined)) return undefined;
  const all = options.find((o) => o.name === first[0])?.values.length === picture.items.length;
  return all ? first[0] : `${first[0]} / ${picture.items.map((i) => i[1]).join(", ")}`;
}
