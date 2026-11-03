import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configure, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { createTheme, decomposeColor, getContrastRatio } from "@mui/material/styles";
import { fetchCallsMatching, mockQortalAction, qortalCallsFor } from "../../../test/setup";
import { WORDS_SCRIM } from "./CinemaSpace";
import { cinemaTheme } from "./cinemaTheme";
import { cinemaQueue, entryKey, episodeName, upNext } from "./cinemaPlayer";
import { posterNote } from "./cinemaPosters";
import { renderSpace, resetSpaceTest, spaceFile, spaceFolder, SPACE_FOLDER_ID, type SpaceBodies } from "./testUtils";
import { toSpaceShare } from "./useSpaceItems";
import type { Video } from "../../../state/features/fileSlice";
import { makeFilmCoverFile } from "../../../utils/coverImage";

// jsdom has no canvas: the cover is "made" from the picked file as it is, named after the shape asked for.
vi.mock("../../../utils/coverImage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../utils/coverImage")>()),
  makeFilmCoverFile: vi.fn(async (file: File, shape = "landscape") => new File([file], `video-cover-${shape}.webp`, { type: "image/webp" })),
}));

configure({ asyncUtilTimeout: 5_000 });

const SERIES: SpaceBodies = {
  qshare_file_show_aaa111_metadata: {
    title: "The Show",
    files: [spaceFile("ep1.mp4", "video/mp4", "ep_one", 2048), spaceFile("ep2.mp4", "video/mp4", "ep_two", 2048)],
  },
  qshare_file_film_bbb222_metadata: { title: "Film", files: [spaceFile("film.mp4", "video/mp4", "film_file")] },
};

const noFileAsked = () => {
  expect(fetchCallsMatching(/\/arbitrary\/FILE\//)).toEqual([]);
  expect(qortalCallsFor("GET_QDN_RESOURCE_STATUS")).toEqual([]);
  expect(document.querySelector("video")).toBeNull();
};

describe("the cinema", { timeout: 20_000 }, () => {
  const play = vi.fn(() => Promise.resolve());
  beforeEach(() => {
    resetSpaceTest();
    resetSpaceTest(SERIES);
    play.mockClear();
    window.HTMLMediaElement.prototype.play = play;
  });
  afterEach(() => resetSpaceTest(SERIES));

  it("puts a billboard over rows sorted by what the shares are", async () => {
    renderSpace({ space: "cinema" });
    expect(await screen.findByRole("heading", { level: 1, name: "My space" })).toBeInTheDocument();
    const billboard = screen.getByRole("region", { name: "About this collection" });
    expect(within(billboard).getByText("Now showing")).toBeInTheDocument();
    expect(await within(billboard).findByText("Film")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Play Film" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Open Songs. 2 files" })).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Also here" })).getByText("Deleted by its publisher")).toBeInTheDocument();
    // Its thumbnail is the backdrop, asked for without holding the node.
    const pictures = Array.from(document.querySelectorAll("img")).map((img) => img.getAttribute("src"));
    expect(pictures).toContain("/arbitrary/THUMBNAIL/bob/qshare_thumb_film?async=true");
  });

  it("lays a scrim under the billboard's words at every width, not only side by side", async () => {
    renderSpace({ space: "cinema" });
    const heading = await screen.findByRole("heading", { level: 1, name: "My space" });
    const words = Array.from(heading.parentElement!.classList).find((name) => name.startsWith("css-"));
    const css = Array.from(document.querySelectorAll("style")).map((style) => style.textContent).join("");
    const outsideMedia = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
    expect(outsideMedia).toMatch(new RegExp(`\\.${words}::before\\{[^}]*z-index:-1`));
  });

  it.each(["light", "dark"] as const)("keeps the words at 4.5:1 over a white picture on a %s app theme", (mode) => {
    const { palette } = cinemaTheme(createTheme({ palette: { mode } }));
    const over = (top: string, under: number[], opacity = decomposeColor(top).values[3] ?? 1) =>
      decomposeColor(top).values.slice(0, 3).map((value, channel) => value * opacity + under[channel] * (1 - opacity));
    const stage = over(palette.background.default, [255, 255, 255], WORDS_SCRIM);
    const css = (channels: number[]) => `rgb(${channels.map(Math.round).join(", ")})`;
    expect(getContrastRatio(css(over(palette.text.secondary, stage)), css(stage))).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio(palette.text.primary, css(stage))).toBeGreaterThanOrEqual(4.5);
  });

  it("says a poster's status and details to screen readers", async () => {
    const bodies: SpaceBodies = { ...SERIES };
    resetSpaceTest(bodies);
    renderSpace({ space: "cinema", bodies, items: [...Object.keys(SERIES), "qshare_file_lost_ccc333_metadata"].map((identifier) => ({ name: "bob", identifier })) });
    expect(await screen.findByRole("button", { name: "More about The Show. 2 episodes · 4 KB" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /^Open .*\. Not available right now$/ }, { timeout: 15_000 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^More about .*\. Not available right now$/ })).toBeInTheDocument();
  });

  it("asks for no file until someone taps Play", async () => {
    renderSpace({ space: "cinema" });
    await screen.findByRole("button", { name: "Play Film" });
    noFileAsked();

    mockQortalAction("GET_QDN_RESOURCE_STATUS", { status: "READY" });
    fireEvent.click(screen.getByRole("button", { name: "Play Film" }));
    const player = await screen.findByRole("dialog", { name: "Film" });
    await waitFor(() => expect(qortalCallsFor("GET_QDN_RESOURCE_STATUS").length).toBe(1));
    const video = await waitFor(() => {
      const found = player.querySelector("video");
      expect(found).not.toBeNull();
      return found as HTMLVideoElement;
    });
    expect(video.getAttribute("src")).toContain("/arbitrary/FILE/bob/file_film.mp4");
    await waitFor(() => expect(play).toHaveBeenCalled());
  });

  it("starts the player from the billboard, and Escape closes it", async () => {
    mockQortalAction("GET_QDN_RESOURCE_STATUS", { status: "READY" });
    renderSpace({ space: "cinema" });
    await screen.findByRole("button", { name: "Play Film" });
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    const player = await screen.findByRole("dialog", { name: "Film" });
    expect(within(player).getByRole("button", { name: "Copy link" })).toBeInTheDocument();
    fireEvent.keyDown(player, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("goes through a share's episodes and on to the next share", async () => {
    mockQortalAction("GET_QDN_RESOURCE_STATUS", { status: "READY" });
    renderSpace({ space: "cinema", bodies: SERIES });
    fireEvent.click(await screen.findByRole("button", { name: "Play The Show" }));
    const player = await screen.findByRole("dialog", { name: "The Show" });
    expect(within(player).getByRole("button", { name: "Previous video" })).toBeDisabled();
    expect(within(player).getByText("Video 1 of 3")).toBeInTheDocument();
    expect(within(player).getByRole("heading", { name: "Episodes · 2" })).toBeInTheDocument();
    expect(within(player).getByRole("button", { name: /Ep1/ })).toHaveAttribute("aria-current", "true");

    fireEvent.click(within(player).getByRole("button", { name: /Ep2/ }));
    expect(await within(player).findByText("Video 2 of 3")).toBeInTheDocument();
    expect(within(player).getByRole("button", { name: /Ep2/ })).toHaveAttribute("aria-current", "true");

    fireEvent.click(within(player).getByRole("button", { name: "Next video" }));
    expect(await screen.findByRole("dialog", { name: "Film" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next video" })).toBeDisabled();
  });

  it("opens a share without video on its page", async () => {
    renderSpace({ space: "cinema" });
    fireEvent.click(await screen.findByRole("button", { name: "Open Book. 1 file" }));
    expect(await screen.findByText("Share page")).toBeInTheDocument();
    noFileAsked();
  });

  it("gives the owner Move and Remove on every poster, also a deleted one", async () => {
    renderSpace({ space: "cinema", folders: [spaceFolder()] });
    expect(await screen.findByRole("button", { name: "Move Film" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Remove Film from collection" })).toBeInTheDocument();
    const deleted = (await screen.findByText("Deleted by its publisher")).closest("li") as HTMLElement;
    expect(within(deleted).getByRole("button", { name: /^Remove .* from collection$/ })).toBeInTheDocument();
    expect(within(deleted).queryByRole("button", { name: /^(Play|Open|More about) / })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove Film from collection" }));
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
    await waitFor(() => expect(qortalCallsFor("PUBLISH_QDN_RESOURCE").length).toBe(1));
  });

  it("gives a visitor the Copy and no owner's controls", async () => {
    renderSpace({ space: "cinema", signedInAs: "dave" });
    await screen.findByRole("button", { name: "Play Film" });
    expect(screen.getByRole("button", { name: "Copy to my collections" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Remove / })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Move / })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  describe("covers the owner chooses", () => {
    const FILM = "qshare_file_film_bbb222_metadata";
    const still = { service: "THUMBNAIL", name: "alice", identifier: "qshare_cover_film0001" };
    const imgs = (identifier: string) => Array.from(document.querySelectorAll<HTMLImageElement>(`img[src="/arbitrary/THUMBNAIL/alice/${identifier}?async=true"]`));

    beforeEach(() => {
      vi.mocked(makeFilmCoverFile).mockClear();
      mockQortalAction("PUBLISH_MULTIPLE_QDN_RESOURCES", true);
      URL.createObjectURL = vi.fn(() => "blob:video-cover-preview");
      URL.revokeObjectURL = vi.fn();
    });

    it("puts the chosen still on the poster, the billboard and the player in place of the share's thumbnail, for visitors too", async () => {
      renderSpace({ space: "cinema", signedInAs: "dave", body: { itemCovers: [{ name: "bob", identifier: FILM, cover: still }] } });
      await screen.findByRole("button", { name: "Play Film" });
      // Poster, and the billboard's picture and its glow.
      await waitFor(() => expect(imgs(still.identifier).length).toBeGreaterThanOrEqual(2));
      expect(document.querySelector('img[src="/arbitrary/THUMBNAIL/bob/qshare_thumb_film?async=true"]')).toBeNull();
      expect(screen.queryByRole("button", { name: /cover/ })).not.toBeInTheDocument();
      // A horizontal still fills its frame.
      expect(imgs(still.identifier).every((img) => img.style.objectFit !== "contain")).toBe(true);
    });

    it("lets the owner publish a horizontal or a vertical cover, cutting the picked picture again on a change", async () => {
      renderSpace({ space: "cinema" });
      fireEvent.click(await screen.findByRole("button", { name: "Add a cover to Film" }));
      const dialog = within(await screen.findByRole("dialog", { name: "Video cover" }));
      expect(dialog.getByRole("button", { name: "Horizontal" })).toHaveAttribute("aria-pressed", "true");
      const picture = new File([new Uint8Array([1, 2, 3])], "poster.jpg", { type: "image/jpeg" });
      fireEvent.change(dialog.getByTestId("item-cover-input"), { target: { files: [picture] } });
      await dialog.findByRole("button", { name: "Change image" });
      expect(vi.mocked(makeFilmCoverFile)).toHaveBeenLastCalledWith(picture, "landscape");

      fireEvent.click(dialog.getByRole("button", { name: "Vertical" }));
      await waitFor(() => expect(vi.mocked(makeFilmCoverFile)).toHaveBeenLastCalledWith(picture, "portrait"));
      // The preview shows it as the poster will: whole.
      await waitFor(() => expect(document.querySelector<HTMLImageElement>('img[src="blob:video-cover-preview"]:not([aria-hidden])')?.style.objectFit).toBe("contain"));
      fireEvent.click(dialog.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES").length).toBe(1));
      const [thumb, doc] = (qortalCallsFor("PUBLISH_MULTIPLE_QDN_RESOURCES")[0] as unknown as { resources: Array<Record<string, unknown>> }).resources;
      expect(thumb).toMatchObject({ service: "THUMBNAIL", name: "alice", filename: "video-cover-portrait.webp", tag1: "qshare_cover_" });
      const stored = JSON.parse(atob(String(doc.data64)));
      expect(stored.itemCovers).toEqual([{ name: "bob", identifier: FILM, cover: { service: "THUMBNAIL", name: "alice", identifier: thumb.identifier }, shape: "portrait" }]);
      expect(stored.space).toBe("cinema");

      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Video cover" })).not.toBeInTheDocument());
      // On the poster now, whole, over a blur of itself.
      await waitFor(() => expect(imgs(String(thumb.identifier)).some((img) => img.style.objectFit === "contain")).toBe(true));
      expect(screen.getByRole("button", { name: "Change the cover of Film" })).toBeInTheDocument();
    });

    it("opens on the shape the cover was cut to", async () => {
      renderSpace({ space: "cinema", body: { itemCovers: [{ name: "bob", identifier: FILM, cover: still, shape: "portrait" }] } });
      fireEvent.click(await screen.findByRole("button", { name: "Change the cover of Film" }));
      const dialog = within(await screen.findByRole("dialog", { name: "Video cover" }));
      expect(dialog.getByRole("button", { name: "Vertical" })).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("opens folders from tiles, and looks the same inside them", async () => {
    renderSpace({ space: "cinema", folders: [spaceFolder()] });
    fireEvent.click(await screen.findByRole("button", { name: "Open folder Live" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Live" })).toBeInTheDocument();
    expect(document.querySelector('[data-space="cinema"]')).not.toBeNull();
    expect(screen.getByText("This folder is empty")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Play" })).not.toBeInTheDocument();
  });

  it("shows the way to a folder", async () => {
    renderSpace({ space: "cinema", folderId: SPACE_FOLDER_ID, folders: [spaceFolder()] });
    expect(await screen.findByRole("navigation", { name: "Where this folder is" })).toBeInTheDocument();
  });

  it("offers the full text of a long description", async () => {
    renderSpace({ space: "cinema", body: { description: "First line\nSecond line" } });
    const more = await screen.findByRole("button", { name: "Show all" });
    fireEvent.click(more);
    expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
  });

  it("pages a long collection, also from the player", async () => {
    const bodies: SpaceBodies = Object.fromEntries(
      Array.from({ length: 23 }, (_, n) => [`qshare_file_v${n}_aaa${n}_metadata`, { title: `Video ${n}`, files: [spaceFile(`${n}.mp4`, "video/mp4", `file_${n}`)] }])
    );
    resetSpaceTest(bodies);
    mockQortalAction("GET_QDN_RESOURCE_STATUS", { status: "READY" });
    renderSpace({ space: "cinema", bodies });
    expect(await screen.findByRole("button", { name: "Show more (3)" })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Play Video 19" }));
    const player = await screen.findByRole("dialog", { name: "Video 19" });
    expect(within(player).getByRole("button", { name: "Next video" })).toBeDisabled();
    fireEvent.click(within(player).getByRole("button", { name: "Load more videos" }));
    await waitFor(() => expect(within(player).getByRole("button", { name: "Next video" })).toBeEnabled());
    resetSpaceTest(bodies);
  });

  it("works with phone sizes", async () => {
    const real = window.matchMedia;
    window.matchMedia = ((query: string) => ({ ...real(query), matches: true })) as typeof window.matchMedia;
    renderSpace({ space: "cinema" });
    expect(await screen.findByRole("button", { name: "Play Film" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Scroll / })).not.toBeInTheDocument();
    window.matchMedia = real;
  });

  it("copes with names that have a plus and spaces", async () => {
    const bodies: SpaceBodies = { qshare_file_film_bbb222_metadata: { title: "Film", files: [{ ...spaceFile("a b.mp4", "video/mp4", "id_x"), name: "Mr + Mrs" }] } };
    mockQortalAction("GET_QDN_RESOURCE_STATUS", { status: "READY" });
    renderSpace({ space: "cinema", bodies, items: [{ name: "Mr + Mrs", identifier: "qshare_file_film_bbb222_metadata" }] });
    fireEvent.click(await screen.findByRole("button", { name: "Play Film" }));
    const player = await screen.findByRole("dialog", { name: "Film" });
    await waitFor(() => expect(player.querySelector("video")?.getAttribute("src")).toBe("/arbitrary/FILE/Mr%20%2B%20Mrs/id_x"));
    expect(within(player).getByRole("button", { name: "By Mr + Mrs" })).toBeInTheDocument();
  });
});

describe("cinema helpers", () => {
  const row = (id: string) => ({ id, user: "bob", title: "", description: "", created: 0 }) as Video;
  const share = (id: string, body: Record<string, unknown>) => toSpaceShare(row(id), { ...row(id), isValid: true, ...body } as Video, false);

  it("queues each share's videos in order, leaving out deleted shares", () => {
    const gone = toSpaceShare(row("c"), { ...row("c"), isValid: false, deleted: true, files: [spaceFile("x.mp4", "video/mp4")] } as unknown as Video, false);
    const queue = cinemaQueue([
      share("a", { title: "A", files: [spaceFile("1.mp4", "video/mp4"), spaceFile("n.pdf", "application/pdf"), spaceFile("2.mp4", "video/mp4")] }),
      gone,
      share("b", { title: "B", files: [spaceFile("3.webm", "video/webm")] }),
    ]);
    expect(queue.map((entry) => entry.file.filename)).toEqual(["1.mp4", "2.mp4", "3.webm"]);
    expect(new Set(queue.map(entryKey)).size).toBe(3);
  });

  it("says a file's name the way a person would", () => {
    expect(episodeName("episode-2-the-depot.webm")).toBe("Episode 2 the depot");
    expect(episodeName("my_film.final.mp4")).toBe("My film final");
    expect(episodeName("---.mp4")).toBe("---.mp4");
  });

  it("lists the next shares once each, not this share's own episodes", () => {
    const queue = cinemaQueue([
      share("a", { title: "A", files: [spaceFile("1.mp4", "video/mp4", "a1"), spaceFile("2.mp4", "video/mp4", "a2")] }),
      share("b", { title: "B", files: [spaceFile("3.mp4", "video/mp4", "b1"), spaceFile("4.mp4", "video/mp4", "b2")] }),
      share("c", { title: "C", files: [spaceFile("5.mp4", "video/mp4", "c1")] }),
    ]);
    expect(upNext(queue, 0).map((entry) => entry.file.filename)).toEqual(["3.mp4", "5.mp4"]);
    expect(upNext(queue, 4)).toEqual([]);
  });

  it("says who and how big for a film, how many for a series", () => {
    expect(posterNote(share("a", { files: [spaceFile("1.mp4", "video/mp4", "i", 1024)] }))).toBe("bob · 1 KB");
    expect(posterNote(share("a", { files: [spaceFile("1.mp4", "video/mp4", "i", 1024), spaceFile("2.mp4", "video/mp4", "j", 1024)] }))).toBe("2 episodes · 2 KB");
    expect(posterNote(share("a", { files: [spaceFile("n.pdf", "application/pdf")] }))).toBe("1 file");
  });

  it.each(["light", "dark"] as const)("stays dark and readable over a %s app theme", (mode) => {
    const outer = createTheme({ palette: { mode, primary: { main: mode === "light" ? "#111111" : "#88aaff" } } });
    const { palette } = cinemaTheme(outer);
    expect(palette.mode).toBe("dark");
    expect(getContrastRatio(palette.text.primary, palette.background.default)).toBeGreaterThan(4.5);
    expect(getContrastRatio(palette.primary.contrastText, palette.primary.main)).toBeGreaterThan(4.5);
    expect(getContrastRatio(palette.error.contrastText, palette.error.main)).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio(palette.secondary.main, palette.common.black)).toBeGreaterThanOrEqual(4.5);
  });

});
