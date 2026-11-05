import { beforeEach, describe, expect, it } from "vitest";
import { configure, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { qortalCallsFor } from "../../../test/setup";
import { COLLECTION_SPACES } from "../../../utils/collections";
import { store } from "../../../state/store";
import { QDN_PAGE } from "../../../utils/qdnSearch";
import { writeSettings, resetSettingsCache } from "../../../utils/settings";
import type { Video } from "../../../state/features/fileSlice";
import { SPACE_COLLECTION_ID, SPACE_FOLDER_ID, renderSpace, resetSpaceTest, spaceFile, spaceFolder, type SpaceBodies } from "./testUtils";
import { suggestSpace } from "./suggestSpace";
import { toSpaceShare } from "./useSpaceItems";

configure({ asyncUtilTimeout: 5_000 });

const space = (name: string) => document.querySelector(`[data-space="${name}"]`);
const bodyFetches = () => qortalCallsFor("FETCH_QDN_RESOURCE").filter((c) => c.identifier !== SPACE_COLLECTION_ID);

const manyBodies = (count: number): SpaceBodies =>
  Object.fromEntries(
    Array.from({ length: count }, (_, n) => [`qshare_file_many${n}_aaa${n}_metadata`, { title: `Many ${n}`, files: [spaceFile(`${n}.mp3`, "audio/mpeg")] }])
  );

describe("collection spaces", { timeout: 20_000 }, () => {
  beforeEach(() => resetSpaceTest());

  it.each(COLLECTION_SPACES)("opens a %s collection in its space", async (id) => {
    renderSpace({ space: id, folders: [spaceFolder({ items: [{ name: "bob", identifier: "qshare_file_book_ccc333_metadata" }] })] });
    expect(await screen.findByRole("heading", { level: 1, name: "My space" })).toBeInTheDocument();
    expect(space(id)).not.toBeNull();
  });

  it.each(["music", "library"])("takes Hub 3.0's painted fill off the quiet buttons in %s", async (id) => {
    renderSpace({ space: id });
    await screen.findByRole("button", { name: "Edit" });
    const css = Array.from(document.querySelectorAll("style")).map((style) => style.textContent).join("");
    expect(css).toMatch(/\.MuiButton-root\{[^}]*background-image:none/);
    expect(css).toMatch(/\.MuiButton-root:hover\{[^}]*background-image:none/);
  });

  describe("a share with odd JSON", () => {
    const odd: SpaceBodies = {
      qshare_file_odd_aaa111_metadata: {
        title: { not: "text" },
        files: [{ mimetype: 5 }, { filename: 5 }, { filename: "ok.mp3", mimetype: "audio/mpeg", name: 7, identifier: "ok_file", size: "big", service: 1 }, null, "x"],
      },
      qshare_file_fine_bbb222_metadata: { title: "Fine", files: [spaceFile("fine.mp3", "audio/mpeg")] },
    };

    it("doesn't stop the Edit dialog's suggestion", () => {
      expect(suggestSpace([{ mimetype: 5, filename: 5 } as never, { filename: "a.mp3" }])).toBe(null);
    });

    it("keeps only fields of the right type", () => {
      const share = toSpaceShare({ id: "x", user: "bob" } as Video, odd.qshare_file_odd_aaa111_metadata as unknown as Video, false);
      expect(share.title).toBe("X");
      expect(share.files).toEqual([
        { filename: "", identifier: "", name: "" },
        { filename: "", identifier: "", name: "" },
        { filename: "ok.mp3", identifier: "ok_file", name: "", mimetype: "audio/mpeg" },
      ]);
    });

    it.each(COLLECTION_SPACES)("doesn't stop %s", async (id) => {
      resetSpaceTest(odd);
      renderSpace({ space: id, bodies: odd });
      expect(await screen.findAllByText("Fine")).not.toHaveLength(0);
      expect(space(id)).not.toBeNull();
      if (id === "music") expect(screen.getByRole("button", { name: "Remove Odd from collection" })).toBeInTheDocument();
      resetSpaceTest(odd);
    });
  });

  it("gives a folder the collection's space", async () => {
    renderSpace({ space: "album", folderId: SPACE_FOLDER_ID, folders: [spaceFolder({ description: "On stage" })] });
    expect(await screen.findByRole("heading", { level: 1, name: "Live" })).toBeInTheDocument();
    expect(space("album")).not.toBeNull();
    expect(screen.getByText("On stage")).toBeInTheDocument();
    expect(within(screen.getByRole("navigation", { name: "Where this folder is" })).getByRole("button", { name: "My space" })).toBeInTheDocument();
    expect(screen.getByText("This folder is empty")).toBeInTheDocument();
  });

  it("shows the standard page for no space and for one it doesn't know", async () => {
    const { unmount } = renderSpace({ space: "arcade" });
    expect(await screen.findByRole("heading", { level: 1, name: "My space" })).toBeInTheDocument();
    expect(document.querySelector("[data-space]")).toBeNull();
    unmount();
  });

  it("keeps the owner's controls and their dialogs", async () => {
    renderSpace({ space: "cinema", folders: [spaceFolder()] });
    expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New folder" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open folder Live" })).toBeInTheDocument();
    await screen.findByText("Songs");

    fireEvent.click(screen.getByRole("button", { name: "Move Songs" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Remove Songs from collection" }));
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
    await waitFor(() => expect(qortalCallsFor("PUBLISH_QDN_RESOURCE").length).toBe(1));
    const stored = JSON.parse(atob(String(qortalCallsFor("PUBLISH_QDN_RESOURCE")[0].data64)));
    expect(stored.space).toBe("cinema");
    expect(stored.items.map((item: { identifier: string }) => item.identifier)).not.toContain("qshare_file_songs_aaa111_metadata");
    await waitFor(() => expect(screen.queryByText("Songs")).not.toBeInTheDocument());
  });

  it("offers a signed-in visitor the copy, and no owner's controls", async () => {
    renderSpace({ space: "library", signedInAs: "dave" });
    expect(await screen.findByRole("button", { name: "Copy to my collections" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Remove / })).not.toBeInTheDocument();
  });

  it("names a copy's source", async () => {
    renderSpace({ space: "album", body: { copiedFrom: { name: "eve", identifier: "qshare_collection_x_zz11yy", title: "Original" } } });
    expect(await screen.findByRole("button", { name: "“Original”" })).toBeInTheDocument();
  });

  it("still lists a deleted share, and says so", async () => {
    renderSpace({ space: "music" });
    expect(await screen.findByText("Deleted by its publisher")).toBeInTheDocument();
  });

  it("leaves out hidden names", async () => {
    writeSettings({ hiddenNames: ["bob"] });
    renderSpace({ space: "music" });
    await screen.findByRole("heading", { level: 1, name: "My space" });
    expect(bodyFetches().length).toBe(0);
    writeSettings({ hiddenNames: [] });
    resetSettingsCache();
  });

  it("fetches bodies one page at a time", async () => {
    const bodies = manyBodies(QDN_PAGE + 5);
    resetSpaceTest(bodies);
    renderSpace({ space: "music", bodies });
    await screen.findByText("Many 0");
    await waitFor(() => expect(bodyFetches().length).toBe(QDN_PAGE));
    expect(screen.queryByText(`Many ${QDN_PAGE}`)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show more (5)" }));
    expect(await screen.findByText(`Many ${QDN_PAGE}`)).toBeInTheDocument();
    await waitFor(() => expect(bodyFetches().length).toBe(QDN_PAGE + 5));
    expect(screen.queryByRole("button", { name: /Show more/ })).not.toBeInTheDocument();
    resetSpaceTest(bodies);
  });

  it("keeps the page's own states", async () => {
    const deleted = renderSpace({ space: "music", items: [], body: { deleted: true } });
    expect(await screen.findByText("My space was deleted")).toBeInTheDocument();
    expect(document.querySelector("[data-space]")).toBeNull();
    deleted.unmount();

    renderSpace({ space: "music", folderId: "nosuch" });
    expect(await screen.findByText("Folder not found")).toBeInTheDocument();
    expect(document.querySelector("[data-space]")).toBeNull();
  });

  it("makes no search and fetches no file", async () => {
    renderSpace({ space: "music" });
    await screen.findByText("Songs");
    expect(qortalCallsFor("FETCH_QDN_RESOURCE").every((c) => String(c.identifier).startsWith("qshare_"))).toBe(true);
    expect(store.getState().player.tracks.length).toBe(0);
  });
});

describe("toSpaceShare", () => {
  const row = { id: "qshare_file_my-film_bbb222_metadata", user: "bob", title: "", description: "", created: 0 } as Video;

  it("waits for the body with an empty title", () => {
    expect(toSpaceShare(row, undefined, false)).toMatchObject({ title: "", loaded: false, unavailable: false, files: [] });
  });

  it("names a share that never came from its identifier", () => {
    expect(toSpaceShare(row, undefined, true)).toMatchObject({ title: "My film", unavailable: true, loaded: false });
  });

  it("sorts the files by kind", () => {
    const body = {
      ...row,
      isValid: true,
      title: "Film",
      files: [
        spaceFile("a.mp3", "audio/mpeg"),
        spaceFile("b.mp4", "video/mp4"),
        spaceFile("c.wmv", ""),
        spaceFile("d.jpg", "image/jpeg"),
        spaceFile("e.pdf", "application/pdf"),
        spaceFile("f.epub", ""),
        spaceFile("g.zip", "application/zip"),
      ],
      thumbnail: { service: "THUMBNAIL", name: "bob", identifier: "qshare_thumb_x" },
    } as Video;
    const share = toSpaceShare(row, body, false);
    expect(share.audio.map((t) => t.filename)).toEqual(["a.mp3"]);
    expect(share.videos.map((f) => f.filename)).toEqual(["b.mp4"]);
    expect(share.images.map((f) => f.filename)).toEqual(["d.jpg"]);
    expect(share.documents.map((f) => f.filename)).toEqual(["e.pdf", "f.epub"]);
    expect(share.files.length).toBe(7);
    expect(share.thumbnailUrl).toBe("/arbitrary/THUMBNAIL/bob/qshare_thumb_x");
  });

  it("flags a deleted share and an unreadable one, with a readable title", () => {
    const deleted = toSpaceShare(row, { ...row, title: "deleted", isValid: false, deleted: true }, false);
    expect(deleted).toMatchObject({ deleted: true, unreadable: false, title: "My film", thumbnailUrl: null });
    const unreadable = toSpaceShare(row, { ...row, title: "Film", isValid: false, deleted: false }, false);
    expect(unreadable).toMatchObject({ deleted: false, unreadable: true, title: "Film" });
  });

});
