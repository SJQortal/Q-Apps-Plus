import { useCallback, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, configure, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { mockAllIsIntersecting } from "react-intersection-observer/test-utils";
import { fetchCallsMatching, mockFetch, mockQortalAction, qortalCallsFor } from "../../../test/setup";
import { renderWithProviders } from "../../../test/renderWithProviders";
import { store } from "../../../state/store";
import { removeDownload, setAddToDownloads, updateDownloads } from "../../../state/features/globalSlice";
import { resetSettingsCache, writeSettings } from "../../../utils/settings";
import { MyContext } from "../../../wrappers/DownloadWrapper";
import type { Video } from "../../../state/features/fileSlice";
import AlbumSpace from "./AlbumSpace";
import { albumDates, albumLayout, heroSummary } from "./albumModel";
import { SPACE_FOLDER_ID, renderSpace, resetSpaceTest, spaceFile, spaceFolder, type SpaceBodies } from "./testUtils";
import type { SpaceProps } from "./types";
import { toSpaceShare, type SpaceItems } from "./useSpaceItems";

configure({ asyncUtilTimeout: 5_000 });

const PHOTO_BODIES: SpaceBodies = {
  qshare_file_trip_aaa111_metadata: {
    title: "Trip + friends",
    files: [
      spaceFile("beach.jpg", "image/jpeg", "file_beach"),
      spaceFile("hills.jpg", "image/jpeg", "file_hills"),
      spaceFile("notes.pdf", "application/pdf", "file_notes"),
    ],
    thumbnail: { service: "THUMBNAIL", name: "bob", identifier: "qshare_thumb_trip" },
  },
  qshare_file_one_bbb222_metadata: { title: "One photo", files: [spaceFile("one.png", "image/png", "file_one")] },
  qshare_file_tune_ccc333_metadata: { title: "A tune", files: [spaceFile("tune.mp3", "audio/mpeg", "file_tune")] },
  qshare_file_gone_ddd444_metadata: "D",
};

/** The node holds these files; every other status check says it doesn't. */
const onTheNode = (...identifiers: string[]) => {
  mockFetch("/arbitrary/resource/status", (url: URL) => ({
    status: identifiers.some((id) => url.pathname.endsWith(`/${id}`)) ? "READY" : "NOT_PUBLISHED",
  }));
  mockQortalAction("GET_QDN_RESOURCE_STATUS", (params: Record<string, unknown>) => ({
    status: identifiers.includes(String(params.identifier)) ? "READY" : "MISSING_DATA",
  }));
};

const images = () => Array.from(document.querySelectorAll("img")).map((img) => img.getAttribute("src") ?? "");
const fileImages = () => images().filter((src) => src.startsWith("/arbitrary/FILE/"));

const renderAlbum = (options: Parameters<typeof renderSpace>[0] = {}) =>
  renderSpace({ space: "album", bodies: PHOTO_BODIES, ...options });

describe("album space", { timeout: 20_000 }, () => {
  beforeEach(() => {
    resetSpaceTest(PHOTO_BODIES);
    for (const id of ["file_beach", "file_hills", "file_one"]) store.dispatch(removeDownload(id));
    mockQortalAction("GET_QDN_RESOURCE_STATUS", { status: "MISSING_DATA" });
    mockFetch("/arbitrary/resource/status", { status: "NOT_PUBLISHED" });
  });

  it("draws each picture as a tile, with sections, and other shares small", async () => {
    renderAlbum();
    expect(await screen.findByRole("heading", { level: 1, name: "My space" })).toBeInTheDocument();
    expect(document.querySelector('[data-space="album"]')).not.toBeNull();
    expect(await screen.findByRole("heading", { level: 2, name: "Trip + friends" })).toBeInTheDocument();
    expect(screen.getByText("2 photos, 1 other file · bob")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open beach.jpg, from Trip + friends" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open hills.jpg, from Trip + friends" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Open one.png, from One photo" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /^Open A tune/ })).toBeInTheDocument();
    expect(await screen.findByText("Deleted by its publisher")).toBeInTheDocument();
    expect(await screen.findByText("3 photos")).toBeInTheDocument();
  });

  it("opens the share from a heading and a small tile", async () => {
    renderAlbum();
    fireEvent.click(await screen.findByRole("button", { name: /^Open A tune/ }));
    expect(await screen.findByText("Share page")).toBeInTheDocument();
  });

  it("asks peers for nothing until a tile is tapped", async () => {
    renderAlbum();
    await screen.findByRole("button", { name: "Open beach.jpg, from Trip + friends" });
    await screen.findByText("Deleted by its publisher");
    act(() => mockAllIsIntersecting(true));
    await waitFor(() => expect(fetchCallsMatching("/arbitrary/resource/status").length).toBeGreaterThan(0));
    expect(fileImages()).toEqual([]);
    expect(qortalCallsFor("GET_QDN_RESOURCE_STATUS")).toEqual([]);
    expect(Object.keys(store.getState().global.downloads ?? {})).not.toContain("file_beach");
    expect(screen.getAllByText(/Tap to load/).length).toBeGreaterThan(0);
  });

  it("shows a share's thumbnail on its first picture, and small files the node holds", async () => {
    // isOnNode remembers its answers, so this file is new to it.
    onTheNode("file_held");
    const bodies = { ...PHOTO_BODIES, qshare_file_held_eee555_metadata: { title: "Held", files: [spaceFile("held.png", "image/png", "file_held")] } };
    resetSpaceTest(bodies);
    renderAlbum({ bodies });
    await screen.findByRole("button", { name: "Open held.png, from Held" });
    await screen.findByRole("button", { name: "Open beach.jpg, from Trip + friends" });
    act(() => mockAllIsIntersecting(true));
    await waitFor(() => expect(fileImages()).toContain("/arbitrary/FILE/bob/file_held?async=true"));
    expect(images()).toContain("/arbitrary/THUMBNAIL/bob/qshare_thumb_trip?async=true");
    expect(fileImages().some((src) => src.includes("file_hills"))).toBe(false);
    resetSpaceTest(bodies);
  });

  it("doesn't ask about a file past the card limit", async () => {
    onTheNode("file_big");
    const bodies = { ...PHOTO_BODIES, qshare_file_big_eee555_metadata: { title: "Big", files: [spaceFile("big.jpg", "image/jpeg", "file_big", 9 * 1024 * 1024)] } };
    resetSpaceTest(bodies);
    renderAlbum({ bodies });
    await screen.findByRole("button", { name: "Open big.jpg, from Big" });
    act(() => mockAllIsIntersecting(true));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(fetchCallsMatching(/file_big/)).toEqual([]);
    expect(fileImages()).toEqual([]);
    resetSpaceTest(bodies);
  });

  it("leaves pictures alone with image previews off", async () => {
    onTheNode("file_off");
    writeSettings({ autoPreviewImages: false });
    const bodies = { ...PHOTO_BODIES, qshare_file_off_eee555_metadata: { title: "Off", files: [spaceFile("off.jpg", "image/jpeg", "file_off")] } };
    resetSpaceTest(bodies);
    renderAlbum({ bodies });
    await screen.findByRole("button", { name: "Open off.jpg, from Off" });
    act(() => mockAllIsIntersecting(true));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(fileImages()).toEqual([]);
    expect(fetchCallsMatching(/file_off/)).toEqual([]);
    writeSettings({ autoPreviewImages: true });
    resetSettingsCache();
    resetSpaceTest(bodies);
  });

  it("gets the tapped file onto the node, with progress, and only that one", async () => {
    renderAlbum();
    fireEvent.click(await screen.findByRole("button", { name: "Open beach.jpg, from Trip + friends" }));
    const viewer = await screen.findByRole("dialog", { name: "Photo viewer" });
    expect(within(viewer).getByText("1 of 3")).toBeInTheDocument();
    await waitFor(() => expect(qortalCallsFor("GET_QDN_RESOURCE_STATUS").map((c) => c.identifier)).toEqual(["file_beach"]));

    act(() => {
      store.dispatch(setAddToDownloads({ name: "bob", service: "FILE", identifier: "file_beach", properties: {} }));
      store.dispatch(updateDownloads({ identifier: "file_beach", status: { status: "DOWNLOADING", percentLoaded: 40 } }));
    });
    expect(await within(viewer).findByRole("progressbar", { name: "beach.jpg loading progress" })).toHaveAttribute("aria-valuenow", "40");
    expect(fileImages()).toEqual([]);

    act(() => {
      store.dispatch(updateDownloads({ identifier: "file_beach", status: { status: "READY", percentLoaded: 100 } }));
    });
    const image = await within(viewer).findByRole("img", { name: "beach.jpg" });
    expect(image.getAttribute("src")).toBe("/arbitrary/FILE/bob/file_beach?async=true");
    expect(qortalCallsFor("GET_QDN_RESOURCE_STATUS").length).toBe(1);
  });

  it("moves by buttons, arrow keys and swipe, asking only for where it settles", async () => {
    onTheNode("file_beach", "file_hills", "file_one");
    renderAlbum();
    fireEvent.click(await screen.findByRole("button", { name: "Open beach.jpg, from Trip + friends" }));
    const viewer = await screen.findByRole("dialog", { name: "Photo viewer" });
    expect(await within(viewer).findByRole("img", { name: "beach.jpg" })).toBeInTheDocument();
    expect(within(viewer).queryByRole("button", { name: "Previous photo" })).not.toBeInTheDocument();

    // Passing over a picture doesn't ask for it.
    fireEvent.click(within(viewer).getByRole("button", { name: "Next photo" }));
    fireEvent.keyDown(viewer, { key: "ArrowRight" });
    expect(within(viewer).getByText("3 of 3")).toBeInTheDocument();
    expect(within(viewer).queryByRole("button", { name: "Next photo" })).not.toBeInTheDocument();
    await within(viewer).findByRole("img", { name: "one.png" });
    expect(qortalCallsFor("GET_QDN_RESOURCE_STATUS").map((c) => c.identifier)).toEqual(["file_beach", "file_one"]);

    const stage = within(viewer).getByTestId("album-stage");
    fireEvent.touchStart(stage, { touches: [{ clientX: 50, clientY: 100 }] });
    fireEvent.touchEnd(stage, { changedTouches: [{ clientX: 220, clientY: 104 }] });
    expect(within(viewer).getByText("2 of 3")).toBeInTheDocument();
    // A short or mostly upright drag is not a swipe.
    fireEvent.touchStart(stage, { touches: [{ clientX: 50, clientY: 100 }] });
    fireEvent.touchEnd(stage, { changedTouches: [{ clientX: 80, clientY: 300 }] });
    expect(within(viewer).getByText("2 of 3")).toBeInTheDocument();

    fireEvent.keyDown(viewer, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Photo viewer" })).not.toBeInTheDocument());
  });

  it("saves through Hub once on the node, and opens the share and the publisher", async () => {
    onTheNode("file_one");
    mockQortalAction("GET_QDN_RESOURCE_PROPERTIES", { filename: "one.png", mimeType: "image/png", size: 1000 });
    const save = vi.fn(() => true);
    mockQortalAction("SAVE_FILE", save);
    mockFetch("/arbitrary/FILE/", () => new Blob(["x"]));
    renderAlbum();
    fireEvent.click(await screen.findByRole("button", { name: "Open one.png, from One photo" }));
    const viewer = await screen.findByRole("dialog", { name: "Photo viewer" });
    const download = within(viewer).getByRole("button", { name: "Download one.png" });
    await waitFor(() => expect(download).toBeEnabled());
    fireEvent.click(download);
    await waitFor(() => expect(save).toHaveBeenCalled());

    fireEvent.click(within(viewer).getByRole("button", { name: "bob" }));
    expect(await screen.findByText("Profile page")).toBeInTheDocument();
  });

  it("opens the share from the viewer", async () => {
    renderAlbum();
    fireEvent.click(await screen.findByRole("button", { name: "Open one.png, from One photo" }));
    const viewer = await screen.findByRole("dialog", { name: "Photo viewer" });
    fireEvent.click(within(viewer).getByRole("button", { name: "Open share" }));
    expect(await screen.findByText("Share page")).toBeInTheDocument();
  });

  it("shows the picture on its tile once it has been opened", async () => {
    onTheNode("file_hills");
    renderAlbum();
    fireEvent.click(await screen.findByRole("button", { name: "Open hills.jpg, from Trip + friends" }));
    const viewer = await screen.findByRole("dialog", { name: "Photo viewer" });
    fireEvent.load(await within(viewer).findByRole("img", { name: "hills.jpg" }));
    fireEvent.keyDown(viewer, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Photo viewer" })).not.toBeInTheDocument());
    act(() => mockAllIsIntersecting(true));
    await waitFor(() => expect(fileImages()).toContain("/arbitrary/FILE/bob/file_hills?async=true"));
  });

  it("offers a failed fetch again", async () => {
    mockQortalAction("GET_QDN_RESOURCE_STATUS", { status: "NOT_PUBLISHED" });
    renderAlbum();
    fireEvent.click(await screen.findByRole("button", { name: "Open one.png, from One photo" }));
    const viewer = await screen.findByRole("dialog", { name: "Photo viewer" });
    expect(await within(viewer).findByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(within(viewer).getByRole("button", { name: "Download one.png" })).toBeDisabled();
  });

  it("gives the owner Move and Remove on every kind of share", async () => {
    renderAlbum({ folders: [spaceFolder()] });
    await screen.findByText("Deleted by its publisher");
    // A section has them in its heading.
    const section = screen.getByRole("region", { name: "Trip + friends" });
    expect(within(section).getByRole("button", { name: "Move Trip + friends" })).toBeInTheDocument();
    expect(within(section).getByRole("button", { name: "Remove Trip + friends from collection" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Options for / }).length).toBe(3);

    fireEvent.click(screen.getByRole("button", { name: "Options for One photo" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Remove One photo from collection" }));
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
    await waitFor(() => expect(qortalCallsFor("PUBLISH_QDN_RESOURCE").length).toBe(1));
    const published = JSON.parse(atob(String(qortalCallsFor("PUBLISH_QDN_RESOURCE")[0].data64)));
    expect(published.items.map((item: { identifier: string }) => item.identifier)).not.toContain("qshare_file_one_bbb222_metadata");
    expect(published.space).toBe("album");
  });

  it("removes a deleted share through its menu, and moves a picture's share", async () => {
    renderAlbum({ folders: [spaceFolder()] });
    await screen.findByText("Deleted by its publisher");
    fireEvent.click(screen.getByRole("button", { name: /^Options for .*gone/i }));
    expect(await screen.findByRole("menuitem", { name: /^Remove .*gone.* from collection$/i })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Options for One photo" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Move One photo" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("gives visitors no owner controls", async () => {
    renderAlbum({ signedInAs: "carol", folders: [spaceFolder()] });
    await screen.findByText("Deleted by its publisher");
    expect(screen.getByRole("button", { name: "Copy to my collections" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Options for / })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^(Move|Remove) / })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("keeps the owner's page controls, attribution and the folder tiles", async () => {
    renderAlbum({ folders: [spaceFolder({ items: [{ name: "bob", identifier: "qshare_file_one_bbb222_metadata" }] })] });
    expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New folder" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open folder Live" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Live" })).toBeInTheDocument();
    expect(document.querySelector('[data-space="album"]')).not.toBeNull();
    expect(screen.getByRole("navigation", { name: "Where this folder is" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Open one.png, from One photo" })).toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    renderAlbum({ items: [], folderId: SPACE_FOLDER_ID, folders: [spaceFolder()] });
    expect(await screen.findByText("This folder is empty")).toBeInTheDocument();
  });

  it("pages long lists, and draws a big share's tiles a part at a time", async () => {
    const files = Array.from({ length: 50 }, (_, n) => spaceFile(`p${n}.jpg`, "image/jpeg", `file_p${n}`));
    const bodies: SpaceBodies = Object.fromEntries(
      Array.from({ length: 25 }, (_, n) => [`qshare_file_s${n}_aaa${n}_metadata`, n === 0 ? { title: "Big", files } : { title: `Share ${n}`, files: [spaceFile(`s${n}.jpg`, "image/jpeg", `file_s${n}`)] }])
    );
    resetSpaceTest(bodies);
    renderAlbum({ bodies });
    await screen.findByRole("button", { name: "Open p0.jpg, from Big" });
    expect(screen.queryByRole("button", { name: "Open p40.jpg, from Big" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show more photos (10)" }));
    expect(screen.getByRole("button", { name: "Open p49.jpg, from Big" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show more (5)" }));
    expect(await screen.findByRole("button", { name: "Open s24.jpg, from Share 24" })).toBeInTheDocument();
    resetSpaceTest(bodies);
  });
});

describe("album viewer past the page", () => {
  const video = (id: string, title: string, identifier: string): { row: Video; body: Video } => {
    const row = { id, user: "bob" } as Video;
    return { row, body: { ...row, title, files: [spaceFile(`${identifier}.jpg`, "image/jpeg", identifier)] } as unknown as Video };
  };

  it("loads the next page when Next runs out", async () => {
    mockQortalAction("GET_QDN_RESOURCE_STATUS", { status: "READY" });
    const first = video("a", "First", "file_a");
    const second = video("b", "Second", "file_b");
    const props = (items: SpaceItems): SpaceProps =>
      ({
        space: "album",
        collection: {},
        folder: null,
        trail: [],
        breadcrumb: null,
        title: "T",
        description: "",
        counts: { shares: 2, folders: 0 },
        cover: null,
        items,
        subfolders: [],
        foldersSection: null,
        emptyState: null,
        isOwner: false,
        onEdit: vi.fn(),
        onNewFolder: undefined,
        onDelete: vi.fn(),
        onMove: undefined,
        onRemove: vi.fn(),
        actions: null,
        copyAction: null,
        attribution: null,
        openFolder: vi.fn(),
        openShare: vi.fn(),
        openProfile: vi.fn(),
      }) as unknown as SpaceProps;
    const page2: SpaceItems = { shares: [toSpaceShare(first.row, first.body, false), toSpaceShare(second.row, second.body, false)], total: 2, pending: 0, hasMore: false, showMore: vi.fn() };
    function Harness() {
      const [more, setMore] = useState(false);
      const showMore = useCallback(() => setMore(true), []);
      const page1: SpaceItems = { shares: page2.shares.slice(0, 1), total: 2, pending: 0, hasMore: true, showMore };
      return (
        <MyContext.Provider value={{ downloadVideo: vi.fn(), retryDownload: vi.fn() }}>
          <AlbumSpace {...props(more ? page2 : page1)} />
        </MyContext.Provider>
      );
    }
    renderWithProviders(<Harness />);
    expect(screen.getByText("1+ photos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open file_a.jpg, from First" }));
    const viewer = await screen.findByRole("dialog", { name: "Photo viewer" });
    expect(within(viewer).getByText("1 of 1+")).toBeInTheDocument();
    fireEvent.click(within(viewer).getByRole("button", { name: "Next photo" }));
    expect(await within(viewer).findByText("2 of 2")).toBeInTheDocument();
  });
});

describe("album model", () => {
  const row = { id: "x", user: "bob" } as Video;
  const share = (files: unknown[], extra: Record<string, unknown> = {}) => toSpaceShare(row, { ...row, title: "X", files, ...extra } as unknown as Video, false);

  it("leaves out files from someone's odd JSON", () => {
    const { photos, others } = albumLayout([
      share([{ filename: "a.jpg", mimetype: "image/jpeg" }, { filename: "b.jpg", mimetype: "image/jpeg", name: "bob", identifier: "b", service: "DOCUMENT" }]),
    ]);
    expect(photos).toEqual([]);
    expect(others.length).toBe(1);
  });

  it("says when the photos are from only if all are known", () => {
    const { photos } = albumLayout([share([spaceFile("a.jpg", "image/jpeg")], { created: Date.UTC(2024, 5, 15) })]);
    expect(albumDates(photos, { hasMore: true, pending: 0 })).toBe("");
    expect(albumDates(photos, { hasMore: false, pending: 0 })).toMatch(/2024/);
    expect(heroSummary(photos, { hasMore: false, pending: 0 }, { shares: 1, folders: 2 })).toMatch(/^1 photo · 2 folders · .*2024$/);
  });
});
