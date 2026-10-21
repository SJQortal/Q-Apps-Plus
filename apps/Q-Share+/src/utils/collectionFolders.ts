/**
 * Folders inside a collection (utils/collections.ts): a tree stored in the
 * collection's own JSON, so every change is one publish of one DOCUMENT and
 * nothing can be left half-moved. Pure helpers; each returns a new body.
 * A folder is addressed by its id, unique within the collection; `null`
 * means the collection itself.
 */
import type { CollectionCover, CollectionFolder, CollectionItem } from "./collections";

/** The collection itself or a folder: what holds shares and folders. */
export interface Container {
  items: CollectionItem[];
  folders?: CollectionFolder[];
}

const sameItem = (a: CollectionItem, b: CollectionItem) => a.name === b.name && a.identifier === b.identifier;

const itemKey = (item: CollectionItem) => `${item.name}\u0000${item.identifier}`;
// Bodies are immutable (each edit makes a new one), so the list is kept per body.
const itemsOf = new WeakMap<Container, CollectionItem[]>();

/** Every share in the collection and its folders, each once, the collection's own first. */
export function allCollectionItems(body: Container): CollectionItem[] {
  const cached = itemsOf.get(body);
  if (cached) return cached;
  const out: CollectionItem[] = [];
  const seen = new Set<string>();
  const visit = (container: Container) => {
    for (const item of container.items) {
      const key = itemKey(item);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(item);
      }
    }
    for (const folder of container.folders ?? []) visit(folder);
  };
  visit(body);
  itemsOf.set(body, out);
  return out;
}

/** Whether the share is anywhere in the collection; stops at the first match. */
export function containsItem(body: Container, item: CollectionItem): boolean {
  if (body.items.some((existing) => sameItem(existing, item))) return true;
  return (body.folders ?? []).some((folder) => containsItem(folder, item));
}

/** The folder with `id` and the folders above it, outermost first (the folder itself last). */
export function findFolder(body: Container, id: string): { folder: CollectionFolder; path: CollectionFolder[] } | null {
  const search = (folders: CollectionFolder[], above: CollectionFolder[]): { folder: CollectionFolder; path: CollectionFolder[] } | null => {
    for (const folder of folders) {
      const path = [...above, folder];
      if (folder.id === id) return { folder, path };
      const found = search(folder.folders, path);
      if (found) return found;
    }
    return null;
  };
  return search(body.folders ?? [], []);
}

/** The collection (id null) or one of its folders, or null when there is no such folder. */
export function containerOf(body: Container, id: string | null): Container | null {
  if (id === null) return body;
  return findFolder(body, id)?.folder ?? null;
}

export function folderCount(body: Container): number {
  return (body.folders ?? []).reduce((sum, folder) => sum + 1 + folderCount(folder), 0);
}

/** No shares and no folders: how a collection looks once deleted (QDN keeps it, emptied). */
export function isEmptyCollection(body: Container): boolean {
  return allCollectionItems(body).length === 0 && folderCount(body) === 0;
}

/**
 * Deleted with Delete, and still empty. (One deleted before 1.0.1 has no
 * flag: it is merely empty, which the lists of other people's collections
 * leave out anyway.)
 */
export function isDeletedCollection(body: Container & { deleted?: boolean }): boolean {
  return body.deleted === true && isEmptyCollection(body);
}

/** 1 for the collection's own folders, 2 inside those, and so on; 0 for the collection. */
export function folderDepth(body: Container, id: string | null): number {
  return id === null ? 0 : (findFolder(body, id)?.path.length ?? 0);
}

/** A copy of `body` with the container `id` replaced by `change(container)`. Unknown ids change nothing. */
export function updateContainer<T extends Container>(body: T, id: string | null, change: (container: Container) => Container): T {
  if (id === null) {
    const next = change(body);
    return { ...body, items: next.items, folders: next.folders };
  }
  const walk = (folders: CollectionFolder[]): CollectionFolder[] =>
    folders.map((folder) => {
      if (folder.id === id) {
        const next = change(folder);
        return { ...folder, items: next.items, folders: next.folders ?? [] };
      }
      return { ...folder, folders: walk(folder.folders) };
    });
  return { ...body, folders: walk(body.folders ?? []) };
}

export function hasItemIn(body: Container, id: string | null, item: CollectionItem): boolean {
  return Boolean(containerOf(body, id)?.items.some((existing) => sameItem(existing, item)));
}

/** Adds `item` to the container when it isn't there, removes it when it is. */
export function toggleItemIn<T extends Container>(body: T, id: string | null, item: CollectionItem): T {
  return updateContainer(body, id, (container) => ({
    ...container,
    items: container.items.some((existing) => sameItem(existing, item))
      ? container.items.filter((existing) => !sameItem(existing, item))
      : [...container.items, { name: item.name, identifier: item.identifier }],
  }));
}

/** Moves `item` from one container to another (kept once there, in the order it is added). */
export function moveItem<T extends Container>(body: T, item: CollectionItem, from: string | null, to: string | null): T {
  if (from === to) return body;
  const removed = updateContainer(body, from, (container) => ({
    ...container,
    items: container.items.filter((existing) => !sameItem(existing, item)),
  }));
  return updateContainer(removed, to, (container) => ({
    ...container,
    items: container.items.some((existing) => sameItem(existing, item))
      ? container.items
      : [...container.items, { name: item.name, identifier: item.identifier }],
  }));
}

export function addFolder<T extends Container>(body: T, parentId: string | null, folder: CollectionFolder): T {
  return updateContainer(body, parentId, (container) => ({ ...container, folders: [...(container.folders ?? []), folder] }));
}

/** A copy with the folder's title, description or cover changed (cover null removes it). */
export function editFolder<T extends Container>(
  body: T,
  id: string,
  changes: { title?: string; description?: string; cover?: CollectionCover | null }
): T {
  const walk = (folders: CollectionFolder[]): CollectionFolder[] =>
    folders.map((folder) => {
      if (folder.id !== id) return { ...folder, folders: walk(folder.folders) };
      const next: CollectionFolder = {
        ...folder,
        title: changes.title ?? folder.title,
        description: changes.description ?? folder.description,
      };
      if (changes.cover === null) delete next.cover;
      else if (changes.cover) next.cover = changes.cover;
      return next;
    });
  return { ...body, folders: walk(body.folders ?? []) };
}

/** A copy without the folder (and what is in it); the shares themselves stay on QDN. */
export function removeFolder<T extends Container>(body: T, id: string): T {
  const walk = (folders: CollectionFolder[]): CollectionFolder[] =>
    folders.filter((folder) => folder.id !== id).map((folder) => ({ ...folder, folders: walk(folder.folders) }));
  return { ...body, folders: walk(body.folders ?? []) };
}

/** Direct folders, and shares in this container and everything below it. */
export function contentsCount(container: Container): { shares: number; folders: number } {
  return { shares: allCollectionItems(container).length, folders: container.folders?.length ?? 0 };
}

const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** A folder id not used in `body` yet. */
export function newFolderId(body: Container, random: () => number = Math.random): string {
  const used = new Set<string>();
  const collect = (folders: CollectionFolder[] = []) => {
    for (const folder of folders) {
      used.add(folder.id);
      collect(folder.folders);
    }
  };
  collect(body.folders);
  for (;;) {
    const id = Array.from({ length: 6 }, () => ID_ALPHABET[Math.floor(random() * ID_ALPHABET.length)]).join("");
    if (!used.has(id)) return id;
  }
}

/** The collection and its folders in tree order, for pickers. */
export function containerOptions(body: Container & { title?: string }): Array<{ id: string | null; title: string; depth: number }> {
  const out: Array<{ id: string | null; title: string; depth: number }> = [{ id: null, title: body.title ?? "", depth: 0 }];
  const walk = (folders: CollectionFolder[], depth: number) => {
    for (const folder of folders) {
      out.push({ id: folder.id, title: folder.title, depth });
      walk(folder.folders, depth + 1);
    }
  };
  walk(body.folders ?? [], 1);
  return out;
}
