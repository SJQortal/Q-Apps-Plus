import { describe, expect, it } from "vitest";
import type { CollectionBody, CollectionFolder } from "./collections";
import {
  addFolder,
  allCollectionItems,
  containerOf,
  containerOptions,
  containsItem,
  contentsCount,
  editFolder,
  findFolder,
  folderCount,
  folderDepth,
  hasItemIn,
  moveItem,
  newFolderId,
  removeFolder,
  toggleItemIn,
} from "./collectionFolders";

const a = { name: "alice", identifier: "qshare_file_a_1_metadata" };
const b = { name: "bob", identifier: "qshare_file_b_2_metadata" };
const c = { name: "carol", identifier: "qshare_file_c_3_metadata" };
const cover = { service: "THUMBNAIL" as const, name: "dj", identifier: "qshare_cover_abcd1234" };

const folder = (id: string, items = [] as typeof a[], folders: CollectionFolder[] = []): CollectionFolder => ({
  id,
  title: `Folder ${id}`,
  description: "",
  items,
  folders,
});

const body: CollectionBody = {
  version: 1,
  title: "Music",
  description: "",
  items: [a],
  created: 1,
  updated: 1,
  folders: [folder("live", [b], [folder("tokyo", [c, a])]), folder("demos")],
};

describe("collection folders", () => {
  it("finds folders anywhere, with the path down to them", () => {
    expect(findFolder(body, "tokyo")?.path.map((f) => f.id)).toEqual(["live", "tokyo"]);
    expect(findFolder(body, "nope")).toBeNull();
    expect(containerOf(body, null)).toBe(body);
    expect(containerOf(body, "demos")?.items).toEqual([]);
    expect(folderDepth(body, "tokyo")).toBe(2);
    expect(folderDepth(body, null)).toBe(0);
    expect(folderCount(body)).toBe(3);
  });

  it("lists every share once, the collection's own first", () => {
    expect(allCollectionItems(body)).toEqual([a, b, c]);
    // The same body gives the same list without walking it again.
    expect(allCollectionItems(body)).toBe(allCollectionItems(body));
    expect(containsItem(body, c)).toBe(true);
    expect(containsItem(body, { name: "carol", identifier: "other" })).toBe(false);
    const many = { items: Array.from({ length: 5000 }, (_, i) => ({ name: "n", identifier: `id${i % 2500}` })) };
    expect(allCollectionItems(many)).toHaveLength(2500);
    expect(contentsCount(body)).toEqual({ shares: 3, folders: 2 });
    expect(contentsCount(findFolder(body, "live")!.folder)).toEqual({ shares: 3, folders: 1 });
  });

  it("adds and removes a share in one folder without touching the others or the original", () => {
    const added = toggleItemIn(body, "demos", a);
    expect(hasItemIn(added, "demos", a)).toBe(true);
    expect(hasItemIn(added, null, a)).toBe(true);
    expect(hasItemIn(body, "demos", a)).toBe(false);
    const removed = toggleItemIn(added, "tokyo", a);
    expect(containerOf(removed, "tokyo")?.items).toEqual([c]);
    expect(containerOf(removed, "demos")?.items).toEqual([a]);
    expect(toggleItemIn(body, null, b).items).toEqual([a, b]);
  });

  it("moves a share between containers in one step", () => {
    const moved = moveItem(body, b, "live", null);
    expect(moved.items).toEqual([a, b]);
    expect(containerOf(moved, "live")?.items).toEqual([]);
    // Already there: kept once.
    const once = moveItem(body, a, "tokyo", null);
    expect(once.items).toEqual([a]);
    expect(containerOf(once, "tokyo")?.items).toEqual([c]);
    expect(moveItem(body, a, null, null)).toBe(body);
  });

  it("adds, edits and removes folders at any depth", () => {
    const withNew = addFolder(body, "tokyo", folder("encore"));
    expect(findFolder(withNew, "encore")?.path.map((f) => f.id)).toEqual(["live", "tokyo", "encore"]);
    const top = addFolder({ ...body, folders: undefined }, null, folder("first"));
    expect(top.folders?.map((f) => f.id)).toEqual(["first"]);

    const edited = editFolder(withNew, "tokyo", { title: "Tokyo 2024", cover });
    expect(findFolder(edited, "tokyo")?.folder).toMatchObject({ title: "Tokyo 2024", cover, items: [c, a] });
    expect(findFolder(editFolder(edited, "tokyo", { cover: null }), "tokyo")?.folder.cover).toBeUndefined();

    const gone = removeFolder(edited, "live");
    expect(gone.folders?.map((f) => f.id)).toEqual(["demos"]);
    expect(allCollectionItems(gone)).toEqual([a]);
    expect(findFolder(body, "live")).not.toBeNull();
  });

  it("makes folder ids that aren't taken", () => {
    const values = [0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
    const taken = { ...body, folders: [folder("aaaaaa")] };
    expect(newFolderId(taken, () => values.shift() ?? 0.1)).toBe("ssssss");
    expect(newFolderId(body)).toMatch(/^[a-z0-9]{6}$/);
  });

  it("offers the collection and its folders in tree order for pickers", () => {
    expect(containerOptions(body)).toEqual([
      { id: null, title: "Music", depth: 0 },
      { id: "live", title: "Folder live", depth: 1 },
      { id: "tokyo", title: "Folder tokyo", depth: 2 },
      { id: "demos", title: "Folder demos", depth: 1 },
    ]);
  });
});
