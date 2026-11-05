import type { ReactNode } from "react";
import type { Video } from "../../../state/features/fileSlice";
import type { Collection, CollectionCover, CollectionFolder, CollectionSpaceId } from "../../../utils/collections";
import type { SpaceItems, SpaceShare } from "./useSpaceItems";

/** One step of the way to a folder: its id, or null for the collection itself. */
export interface SpaceCrumb {
  id: string | null;
  title: string;
}

/**
 * What every space is given, for the collection's own page and each folder's.
 * The ready-made nodes are the standard page's own controls: use them, or
 * redraw one from the data beside it, but keep what it does. They read the
 * theme's text colours, so put them on a theme surface, not bare on a picture.
 */
export interface SpaceProps {
  space: CollectionSpaceId;
  collection: Collection;
  /** The folder this page shows, or null on the collection's own page. */
  folder: CollectionFolder | null;
  /** The way here, from the collection to this folder's parent; empty on the collection's own page. */
  trail: SpaceCrumb[];
  /** `trail` as the standard page's links, or null on the collection's own page. */
  breadcrumb: ReactNode;
  /** This place's title, never empty, for the page's one h1. */
  title: string;
  description: string;
  /** Shares in this place and below it, and the folders directly in it. */
  counts: { shares: number; folders: number };
  /** This place's own cover, or null. A folder doesn't take the collection's. */
  cover: CollectionCover | null;
  /** This place's shares, resolved a page at a time. */
  items: SpaceItems;
  subfolders: CollectionFolder[];
  /** The standard "Folders" section with its tiles, or null when there are none. */
  foldersSection: ReactNode;
  /** The standard empty state, or null unless this place has no shares and no folders. */
  emptyState: ReactNode;
  isOwner: boolean;
  /** Owner only: the collection's or this folder's Edit dialog. Also behind `actions`. */
  onEdit: () => void;
  /** Owner only, and undefined at the folder limits. Also behind `actions`. */
  onNewFolder: (() => void) | undefined;
  /** Owner only: confirms, then deletes the collection or this folder. Also behind `actions`. */
  onDelete: () => void;
  /** Owner only, and undefined when the collection has no folders. Confirms in a dialog. */
  onMove: ((share: Video) => void) | undefined;
  /** Owner only. Confirms in a dialog. */
  onRemove: (share: Video) => void;
  /** Edit, New folder and Delete for the owner; Copy to my collections for a signed-in visitor; or null. */
  actions: ReactNode;
  /** The visitor's Copy button alone, or null. Already inside `actions`. */
  copyAction: ReactNode;
  /** "Copy of … by …", when it is a copy, and the publisher, counts and date. */
  attribution: ReactNode;
  /** Open a folder of this collection, or the collection itself with null. */
  openFolder: (id: string | null) => void;
  /** The share's page. */
  openShare: (share: Pick<SpaceShare, "user" | "identifier">) => void;
  /** A name's profile. */
  openProfile: (name: string) => void;
}

/** What the collection page hands SpaceView: everything but the items, which it resolves from `rows`. */
export type SpacePageProps = Omit<SpaceProps, "items"> & { rows: Video[] };
