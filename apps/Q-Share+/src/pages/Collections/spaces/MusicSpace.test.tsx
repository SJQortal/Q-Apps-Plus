import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configure, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { resetAudioCovers } from "../../../hooks/useAudioCover";
import { closePlayer } from "../../../state/features/playerSlice";
import { store } from "../../../state/store";
import { readOncePerObserve } from "../../../test/intersection";
import { fetchCalls, mockFetch, qortalCallsFor } from "../../../test/setup";
import { QDN_PAGE } from "../../../utils/qdnSearch";
import { averageColor, heroWash } from "./musicTint";
import { buildQueue, queueOwner } from "./musicQueue";
import { SPACE_BODIES, SPACE_FOLDER_ID, renderSpace, resetSpaceTest, spaceFile, spaceFolder, type SpaceBodies } from "./testUtils";
import { toSpaceShare } from "./useSpaceItems";
import { getContrastRatio } from "@mui/material/styles";

configure({ asyncUtilTimeout: 5_000 });

const realMatchMedia = window.matchMedia;
const phoneScreen = () => {
  window.matchMedia = ((query: string) => ({ ...realMatchMedia(query), matches: true })) as typeof window.matchMedia;
};

const player = () => store.getState().player;
const heading = () => screen.findByRole("heading", { level: 1, name: "My space" });

const row = (name: string) => toSpaceShare({ id: `id_${name}`, user: "bob" } as never, { title: name, files: [spaceFile(`${name}.mp3`, "audio/mpeg")] } as never, false);

describe("music space", { timeout: 20_000 }, () => {
  beforeEach(() => {
    resetSpaceTest();
    resetAudioCovers();
    store.dispatch(closePlayer());
  });
  afterEach(() => {
    window.matchMedia = realMatchMedia;
    store.dispatch(closePlayer());
  });

  it("draws a table of tracks grouped by share, with compact rows for the rest", async () => {
    renderSpace();
    await heading();
    expect(screen.getByText("Playlist")).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Tracks" });
    expect(await within(table).findByText("one")).toBeInTheDocument();
    expect(within(table).getByText("two")).toBeInTheDocument();
    expect(within(table).getByRole("button", { name: "Open Songs" })).toBeInTheDocument();
    expect(within(table).getByRole("button", { name: "Open Book" })).toBeInTheDocument();
    expect(within(table).getByText("PDF")).toBeInTheDocument();
    expect(await screen.findByText("2 tracks · 2 KB")).toBeInTheDocument();
  });

  it("plays every track of the page, across shares, naming the collection", async () => {
    const bodies: SpaceBodies = {
      qshare_file_a_aaa111_metadata: { title: "A", files: [spaceFile("a1.mp3", "audio/mpeg"), spaceFile("a2.mp3", "audio/mpeg")] },
      qshare_file_b_bbb222_metadata: { title: "B", files: [spaceFile("b1.mp3", "audio/mpeg")] },
    };
    resetSpaceTest(bodies);
    renderSpace({ bodies });
    await screen.findByText("b1");

    fireEvent.click(screen.getByRole("button", { name: "Play all" }));
    expect(player().tracks.map((track) => track.filename)).toEqual(["a1.mp3", "a2.mp3", "b1.mp3"]);
    expect(player().share?.title).toBe("My space");
    // The player opens this as a share page, so it must be one.
    expect(player().share?.identifier).toBe("qshare_file_a_aaa111_metadata");
    expect(player().playing).toBe(true);

    fireEvent.click(await screen.findByRole("button", { name: "Pause" }));
    expect(player().playing).toBe(false);
    fireEvent.click(await screen.findByRole("button", { name: "Resume" }));
    expect(player().playing).toBe(true);
    resetSpaceTest(bodies);
  });

  it("starts at a tapped track, and pauses it on a second tap", async () => {
    renderSpace();
    await screen.findByText("two");
    fireEvent.click(screen.getByRole("button", { name: "Play two" }));
    expect(player().order[player().position]).toBe(1);
    expect(player().playing).toBe(true);
    fireEvent.click(await screen.findByRole("button", { name: "Pause two" }));
    expect(player().playing).toBe(false);
    expect(await screen.findByRole("button", { name: "Resume two" })).toBeInTheDocument();
  });

  it("shuffles", async () => {
    renderSpace();
    await screen.findByText("two");
    fireEvent.click(screen.getByRole("button", { name: "Shuffle" }));
    expect(player().shuffle).toBe(true);
    expect(player().tracks).toHaveLength(2);
  });

  it("gives the owner Move, Remove, Edit and New folder on every kind of share", async () => {
    renderSpace({ folders: [spaceFolder()] });
    await screen.findByText("two");
    await screen.findByText("Deleted by its publisher");
    for (const name of ["Songs", "Book", "Film", "Photo"]) {
      expect(screen.getByRole("button", { name: `Move ${name}` })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: `Remove ${name} from collection` })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New folder" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Remove .* from collection$/ })).toHaveLength(5);

    fireEvent.click(screen.getByRole("button", { name: "Remove Songs from collection" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("shows a visitor no owner controls, and Copy when signed in", async () => {
    renderSpace({ signedInAs: "carol" });
    await screen.findByText("two");
    expect(screen.queryByRole("button", { name: /^Remove / })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Move / })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy to my collections" })).toBeInTheDocument();
  });

  it("says when a share is deleted, leaves it out of the queue and still opens it", async () => {
    renderSpace();
    expect(await screen.findByText("Deleted by its publisher")).toBeInTheDocument();
    await screen.findByText("two");
    fireEvent.click(screen.getByRole("button", { name: "Play all" }));
    expect(player().tracks).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /^Open .*gone/i }));
    expect(await screen.findByText("Share page")).toBeInTheDocument();
  });

  it("opens the album from its header", async () => {
    renderSpace();
    fireEvent.click(await screen.findByRole("button", { name: "Open Songs" }));
    expect(await screen.findByText("Share page")).toBeInTheDocument();
  });

  it("asks the node for no file before a tap, even with the rows in view", async () => {
    readOncePerObserve();
    renderSpace();
    // Nothing on the node: art must not trigger a fetch of the file.
    mockFetch("/arbitrary/resource/status", { status: "MISSING" });
    await screen.findByText("two");
    await waitFor(() => expect(fetchCalls.some((call) => call.includes("/arbitrary/resource/status"))).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fetchCalls.filter((call) => call.startsWith("/arbitrary/FILE/"))).toEqual([]);
    expect(document.querySelector('img[src*="/arbitrary/FILE/"]')).toBeNull();
    expect(qortalCallsFor("GET_QDN_RESOURCE_URL")).toEqual([]);
  });

  it("gives every row a Download that asks for nothing until tapped", async () => {
    renderSpace();
    expect(await screen.findByRole("button", { name: "Download one.mp3" })).toBeInTheDocument();
    expect(fetchCalls.filter((call) => call.startsWith("/arbitrary/FILE/"))).toEqual([]);
  });

  it("shows albums for folders, and opens them", async () => {
    renderSpace({ folders: [spaceFolder({ items: [{ name: "bob", identifier: "qshare_file_book_ccc333_metadata" }] })] });
    await heading();
    expect(screen.getByRole("heading", { name: "Albums" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open folder Live" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Live" })).toBeInTheDocument();
    expect(document.querySelector('[data-space="music"]')).not.toBeNull();
    expect(screen.getByText("Album")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Open Book" })).toBeInTheDocument();
  });

  it("shows the empty state in an empty place, with no Play", async () => {
    renderSpace({ folderId: SPACE_FOLDER_ID, folders: [spaceFolder()] });
    expect(await screen.findByText("This folder is empty")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Play all" })).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("offers no Play when the shares have no audio", async () => {
    const bodies = { qshare_file_book_ccc333_metadata: SPACE_BODIES.qshare_file_book_ccc333_metadata };
    renderSpace({ bodies });
    await screen.findByRole("button", { name: "Open Book" });
    expect(screen.getByText("No tracks in these shares.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Play all" })).not.toBeInTheDocument();
  });

  it("no Shuffle for a single track", async () => {
    const bodies: SpaceBodies = { qshare_file_a_aaa111_metadata: { title: "A", files: [spaceFile("solo.mp3", "audio/mpeg")] } };
    resetSpaceTest(bodies);
    renderSpace({ bodies });
    await screen.findByText("solo");
    expect(screen.getByRole("button", { name: "Play all" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Shuffle" })).not.toBeInTheDocument();
    expect(screen.getByText("1 track · 1000 Bytes")).toBeInTheDocument();
    resetSpaceTest(bodies);
  });

  it("pages a long collection and says Play covers what is shown", async () => {
    const bodies: SpaceBodies = Object.fromEntries(
      Array.from({ length: 300 }, (_, n) => [`qshare_file_many${n}_aaa${n}_metadata`, { title: `Many ${n}`, files: [spaceFile(`t${n}.mp3`, "audio/mpeg")] }])
    );
    resetSpaceTest(bodies);
    renderSpace({ bodies });
    expect(await screen.findByText(`Play covers the ${QDN_PAGE} tracks shown here. Show more adds the rest.`)).toBeInTheDocument();
    expect(screen.queryByText("t25")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Show more \(280\)$/ }));
    expect(await screen.findByText("t25")).toBeInTheDocument();
    resetSpaceTest(bodies);
  });

  it("folds a very long album, and shows it all on a tap", async () => {
    const bodies: SpaceBodies = {
      qshare_file_a_aaa111_metadata: { title: "Big", files: Array.from({ length: 40 }, (_, n) => spaceFile(`s${n}.mp3`, "audio/mpeg")) },
    };
    resetSpaceTest(bodies);
    renderSpace({ bodies });
    await screen.findByText("s29");
    expect(screen.queryByText("s30")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Play all" }));
    expect(player().tracks).toHaveLength(40);
    fireEvent.click(screen.getByRole("button", { name: "Show all 40 tracks" }));
    expect(await screen.findByText("s39")).toBeInTheDocument();
    resetSpaceTest(bodies);
  });

  it("copes with long titles and names with + and spaces", async () => {
    const long = "A very long album title ".repeat(10).trim();
    const bodies: SpaceBodies = { qshare_file_a_aaa111_metadata: { title: long, files: [spaceFile("x.mp3", "audio/mpeg")] } };
    resetSpaceTest(bodies);
    renderSpace({ bodies, items: [{ name: "Big + Bold name", identifier: "qshare_file_a_aaa111_metadata" }] });
    await screen.findByText("x");
    fireEvent.click(screen.getByRole("button", { name: "Shares by Big + Bold name" }));
    expect(await screen.findByText("Profile page")).toBeInTheDocument();
    resetSpaceTest(bodies);
  });

  it("has the phone's layout: Play floats, and a tap on a row plays", async () => {
    phoneScreen();
    renderSpace();
    await screen.findByText("two");
    expect(screen.getAllByRole("button", { name: "Play all" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Download one.mp3" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("two"));
    expect(player().order[player().position]).toBe(1);
    fireEvent.click(await screen.findByRole("button", { name: "Pause two" }));
    expect(player().playing).toBe(false);
  });
});

describe("music space helpers", () => {
  it("buildQueue plays each file once and skips the gone", () => {
    const a = row("a");
    const gone = { ...row("b"), deleted: true };
    const { tracks, indexOf } = buildQueue([a, gone, { ...a, key: "again" }]);
    expect(tracks).toHaveLength(1);
    expect(indexOf.size).toBe(1);
  });

  it("queueOwner is the first share that has audio", () => {
    const silent = { ...row("a"), audio: [] };
    expect(queueOwner([silent, row("b")], "T")).toEqual({ name: "bob", identifier: "id_b", title: "T" });
    expect(queueOwner([silent], "T")).toBeNull();
    expect(queueOwner([row("b")], "T", "/collection/a/b")?.path).toBe("/collection/a/b");
  });

  it("averageColor averages opaque pixels only", () => {
    expect(averageColor([10, 20, 30, 255, 30, 40, 50, 255, 255, 255, 255, 0])).toBe("rgb(20, 30, 40)");
    expect(averageColor([1, 2, 3, 0])).toBeNull();
  });

  it.each([
    ["dark page", "#0E0F14", "#F5F5F5", "#b8bcc4"],
    ["warm light page", "#DDD6CA", "#1A1A1A", "#4a4a4a"],
    ["black page", "#000000", "#FFFFFF", "#9aa0a6"],
    ["white page", "#ffffff", "#0f1419", "#536471"],
  ])("heroWash keeps text at 4.5:1 on a %s, whatever the cover", (_, base, primary, secondary) => {
    for (const tint of ["#ff0000", "#00ff00", "#0000ff", "#808080", "#ffffff", "#000000", "#c8b400"]) {
      const wash = heroWash(tint, base, [primary, secondary]);
      if (!wash) continue;
      expect(getContrastRatio(primary, wash)).toBeGreaterThanOrEqual(4.5);
      expect(getContrastRatio(secondary, wash)).toBeGreaterThanOrEqual(Math.min(4.5, getContrastRatio(secondary, base)));
    }
  });

  it("heroWash counts a text colour's own alpha", () => {
    // A 0.2 wash would leave this grey at 4.4:1.
    expect(heroWash("#ffffff", "#000000", ["rgba(255, 255, 255, 0.5)"])).toBe("rgb(31, 31, 31)");
  });

  it("heroWash gives up on colours it can't read", () => {
    expect(heroWash("var(--qp-primary)", "#000000", ["#ffffff"])).toBeNull();
  });
});
