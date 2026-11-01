import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configure, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { getContrastRatio } from "@mui/material/styles";
import { createAppTheme } from "../../../hub-theme";
import { themeConfig } from "../../../theme/qplus-theme";
import { mockFetch, qortalCallsFor } from "../../../test/setup";
import { QDN_PAGE } from "../../../utils/qdnSearch";
import { SPACE_COLLECTION_ID, SPACE_FOLDER_ID, renderSpace, resetSpaceTest, spaceFile, spaceFolder, type SpaceBodies } from "./testUtils";
import { bookCloth, bookFormats, filterBooks, formatBadge, libraryLook, sortBooks } from "./libraryShelf";
import { toSpaceShare, type SpaceShare } from "./useSpaceItems";
import type { Video } from "../../../state/features/fileSlice";

configure({ asyncUtilTimeout: 5_000 });

const realMatchMedia = window.matchMedia;
const phoneScreen = () => {
  window.matchMedia = ((query: string) => ({ ...realMatchMedia(query), matches: true })) as typeof window.matchMedia;
};

const openBook = async (name: RegExp) => {
  fireEvent.click(await screen.findByRole("button", { name }));
  return screen.findByRole("dialog");
};

const BODIES: SpaceBodies = {
  qshare_file_zeta_aaa111_metadata: {
    title: "Zeta guide",
    fullDescription: "A short guide",
    files: [spaceFile("zeta.pdf", "application/pdf", "file_zeta", 2048), spaceFile("notes.txt", "text/plain", "file_notes", 100), spaceFile("zeta.epub", "", "file_epub", 4096)],
  },
  qshare_file_alpha_bbb222_metadata: { title: "Alpha reader", files: [spaceFile("alpha.pdf", "application/pdf")] },
  qshare_file_gone_eee555_metadata: "D",
};

describe("LibrarySpace", { timeout: 20_000 }, () => {
  beforeEach(() => {
    localStorage.clear();
    resetSpaceTest(BODIES);
  });
  afterEach(() => {
    window.matchMedia = realMatchMedia;
    resetSpaceTest(BODIES);
  });

  it("sets the title page and stands the books on a shelf", async () => {
    renderSpace({ space: "library", bodies: BODIES });
    expect(await screen.findByRole("heading", { level: 1, name: "My space" })).toBeInTheDocument();
    expect(screen.getByText("Handy things")).toBeInTheDocument();
    expect(screen.getByText("3 books")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Zeta guide by bob" })).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Books" })).getAllByRole("listitem").length).toBe(3);
  });

  it("opens a book's panel, with its files and the way to its share", async () => {
    renderSpace({ space: "library", bodies: BODIES });
    const panel = within(await openBook(/^Zeta guide by bob/));
    expect(panel.getByRole("heading", { name: "Zeta guide" })).toBeInTheDocument();
    expect(panel.getByText("A short guide")).toBeInTheDocument();
    expect(panel.getByText("PDF")).toBeInTheDocument();
    expect(panel.getByText("EPUB")).toBeInTheDocument();
    expect(panel.getByText("2 KB")).toBeInTheDocument();
    expect(panel.getByRole("button", { name: /Open PDF/ })).toBeInTheDocument();
    expect(panel.getAllByRole("button", { name: /Download/ }).length).toBe(3);

    fireEvent.click(panel.getByRole("button", { name: "Open share" }));
    expect(await screen.findByText("Share page")).toBeInTheDocument();
  });

  it("goes to the publisher from the panel, and closes", async () => {
    renderSpace({ space: "library", bodies: BODIES });
    const dialog = await openBook(/^Alpha reader by bob/);
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const again = await openBook(/^Alpha reader by bob/);
    fireEvent.click(within(again).getByRole("button", { name: "Published by bob" }));
    expect(await screen.findByText("Profile page")).toBeInTheDocument();
  });

  it("gives the owner Move and Remove in the panel, and the panel closes on Remove", async () => {
    renderSpace({ space: "library", bodies: BODIES, folders: [spaceFolder()] });
    const panel = within(await openBook(/^Zeta guide by bob/));
    expect(panel.getByRole("button", { name: "Move Zeta guide" })).toBeInTheDocument();
    fireEvent.click(panel.getByRole("button", { name: "Remove Zeta guide from collection" }));
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
    await waitFor(() => expect(qortalCallsFor("PUBLISH_QDN_RESOURCE").length).toBe(1));
    const stored = JSON.parse(atob(String(qortalCallsFor("PUBLISH_QDN_RESOURCE")[0].data64)));
    expect(stored.space).toBe("library");
    expect(stored.items.map((item: { identifier: string }) => item.identifier)).not.toContain("qshare_file_zeta_aaa111_metadata");
    await waitFor(() => expect(screen.queryByRole("button", { name: /^Zeta guide by bob/ })).not.toBeInTheDocument());
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Zeta guide" })).not.toBeInTheDocument());
  });

  it("gives a visitor no owner's controls, in the panel or the catalogue", async () => {
    renderSpace({ space: "library", signedInAs: "dave", bodies: BODIES, folders: [spaceFolder()] });
    const dialog = await openBook(/^Zeta guide by bob/);
    expect(within(dialog).queryByRole("button", { name: /^Move / })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /^Remove / })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Catalogue" }));
    expect(screen.queryByRole("button", { name: /^Remove / })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy to my collections" })).toBeInTheDocument();
  });

  it("fetches no file before a tap, not even with the panel open", async () => {
    const asked: string[] = [];
    mockFetch("/arbitrary/FILE", () => {
      asked.push("file");
      return {};
    });
    renderSpace({ space: "library", bodies: BODIES });
    await openBook(/^Zeta guide by bob/);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(asked).toEqual([]);
    expect(qortalCallsFor("FETCH_QDN_RESOURCE").every((c) => c.identifier === SPACE_COLLECTION_ID || String(c.identifier).endsWith("_metadata"))).toBe(true);
    expect(qortalCallsFor("GET_QDN_RESOURCE_STATUS").length).toBe(0);
    expect(document.querySelectorAll('img[src*="/arbitrary/FILE"]').length).toBe(0);
  });

  it("says a share was deleted, and the owner can still remove it", async () => {
    renderSpace({ space: "library", bodies: BODIES });
    const dialog = await openBook(/Deleted by its publisher/);
    expect(within(dialog).getByRole("status")).toHaveTextContent("Deleted by its publisher");
    expect(within(dialog).queryByRole("button", { name: /Download/ })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /^Remove .* from collection$/ })).toBeInTheDocument();
  });

  it("finds and sorts this page's books", async () => {
    renderSpace({ space: "library", bodies: BODIES });
    await screen.findByRole("button", { name: "Alpha reader by bob" });
    const order = () => within(screen.getByRole("list", { name: "Books" })).getAllByRole("button").map((b) => b.getAttribute("aria-label"));
    expect(order()[0]).toBe("Zeta guide by bob");
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Sort" }));
    fireEvent.click(await screen.findByRole("option", { name: "By title" }));
    expect(order()[0]).toBe("Alpha reader by bob");

    fireEvent.change(screen.getByRole("textbox", { name: "Find a book" }), { target: { value: "alpha" } });
    expect(screen.queryByRole("button", { name: "Zeta guide by bob" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Alpha reader by bob" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1 book found");

    fireEvent.change(screen.getByRole("textbox", { name: "Find a book" }), { target: { value: "nothing like it" } });
    expect(screen.getByRole("status")).toHaveTextContent("No books match");
    expect(screen.queryByRole("list", { name: "Books" })).not.toBeInTheDocument();
  });

  it("remembers shelf or catalogue, and shows the owner's buttons on the catalogue's rows", async () => {
    const first = renderSpace({ space: "library", bodies: BODIES, folders: [spaceFolder()] });
    await screen.findByRole("button", { name: "Zeta guide by bob" });
    expect(screen.queryByRole("button", { name: "Remove Zeta guide from collection" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Catalogue" }));
    expect(screen.getByRole("button", { name: "Remove Zeta guide from collection" })).toBeInTheDocument();
    first.unmount();

    renderSpace({ space: "library", bodies: BODIES, folders: [spaceFolder()] });
    expect(await screen.findByRole("button", { name: "Move Zeta guide" })).toBeInTheDocument();
  });

  it("still works when storage throws", async () => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error("blocked");
    };
    try {
      renderSpace({ space: "library", bodies: BODIES });
      expect(await screen.findByRole("heading", { level: 1, name: "My space" })).toBeInTheDocument();
    } finally {
      Storage.prototype.getItem = get;
    }
  });

  it("shows folders as shelves, keeps New folder, and opens them", async () => {
    renderSpace({ space: "library", bodies: BODIES, folders: [spaceFolder({ items: [{ name: "bob", identifier: "qshare_file_alpha_bbb222_metadata" }] })] });
    expect(await screen.findByRole("heading", { level: 2, name: "Shelves" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New folder" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open folder Live" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Live" })).toBeInTheDocument();
    expect(document.querySelector('[data-space="library"]')).not.toBeNull();
    expect(within(screen.getByRole("navigation", { name: "Where this folder is" })).getByRole("button", { name: "My space" })).toBeInTheDocument();
  });

  it("shows an empty folder's empty state and no tools", async () => {
    renderSpace({ space: "library", bodies: BODIES, folderId: SPACE_FOLDER_ID, folders: [spaceFolder()] });
    expect(await screen.findByText("This folder is empty")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Find a book" })).not.toBeInTheDocument();
  });

  it("uses the bottom sheet on phones, with 44 px close", async () => {
    phoneScreen();
    renderSpace({ space: "library", bodies: BODIES });
    const dialog = await openBook(/^Zeta guide by bob/);
    expect(dialog).toHaveAttribute("aria-label", "Zeta guide");
    expect(within(dialog).getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("pages a long library, and says what a search covered", async () => {
    const many: SpaceBodies = Object.fromEntries(
      Array.from({ length: QDN_PAGE + 3 }, (_, n) => [`qshare_file_vol${n}_aaa${n}_metadata`, { title: `Volume ${n}`, files: [spaceFile(`${n}.pdf`, "application/pdf")] }])
    );
    resetSpaceTest(many);
    renderSpace({ space: "library", bodies: many });
    await screen.findByRole("button", { name: "Volume 0 by bob" });
    fireEvent.change(screen.getByRole("textbox", { name: "Find a book" }), { target: { value: "Volume 1" } });
    expect(screen.getByRole("status")).toHaveTextContent(`in the first ${QDN_PAGE} of ${QDN_PAGE + 3}`);
    fireEvent.click(screen.getByRole("button", { name: "Show more (3)" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Find a book" }), { target: { value: "" } });
    expect(await screen.findByRole("button", { name: `Volume ${QDN_PAGE} by bob` })).toBeInTheDocument();
    resetSpaceTest(many);
  });
});

describe("library helpers", () => {
  const share = (title: string, user = "bob"): SpaceShare =>
    toSpaceShare({ id: `qshare_file_${title}_x_metadata`, user, title: "", description: "", created: 0 } as Video, { title, user, isValid: true } as unknown as Video, false);
  const pending = toSpaceShare({ id: "qshare_file_wait_metadata", user: "bob", title: "", description: "", created: 0 } as Video, undefined, false);

  it("filters on every word of title and author, names with + and spaces too", () => {
    const list = [share("Moby Dick", "Q+ Reader"), share("Dune", "frank"), pending];
    expect(filterBooks(list, "").length).toBe(3);
    expect(filterBooks(list, "moby q+").map((s) => s.title)).toEqual(["Moby Dick"]);
    expect(filterBooks(list, "FRANK").map((s) => s.title)).toEqual(["Dune"]);
  });

  it("sorts by title, naturally, with ones still on their way last", () => {
    const list = [share("Vol 10"), pending, share("Vol 2"), share("alpha")];
    expect(sortBooks(list, "title").map((s) => s.title)).toEqual(["alpha", "Vol 2", "Vol 10", ""]);
    expect(sortBooks(list, "added")).toBe(list);
  });

  it("badges a file by its extension, or its kind", () => {
    expect(formatBadge({ filename: "a.epub" })).toBe("EPUB");
    expect(formatBadge({ filename: "noext", mimetype: "application/pdf" })).toBe("PDF");
    expect(bookFormats({ documents: [spaceFile("a.pdf", "application/pdf")], files: [spaceFile("b.zip", "application/zip"), spaceFile("a.pdf", "application/pdf")] })).toEqual(["PDF", "ZIP"]);
  });

  describe.each([
    ["hub30", "dark"],
    ["hub30", "light"],
    ["hub20", "dark"],
    ["hub20", "light"],
    ["black", "dark"],
    ["white", "light"],
  ] as const)("in %s %s", (id, mode) => {
    const theme = createAppTheme(id, mode, themeConfig);

    it("keeps the reading room's text at 4.5:1", () => {
      const look = libraryLook(theme);
      expect(getContrastRatio(look.ink, look.room)).toBeGreaterThanOrEqual(4.5);
      expect(getContrastRatio(look.quiet, look.room)).toBeGreaterThanOrEqual(4.5);
      // The page's ready-made nodes (attribution, breadcrumb) use the theme's own text on the room.
      expect(look.quiet).toBe(theme.palette.text.secondary);
    });

    it("keeps every cloth's foil at 4.5:1", () => {
      for (const seed of ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"]) {
        const { cloth, foil } = bookCloth(theme, seed);
        expect(getContrastRatio(foil, cloth)).toBeGreaterThanOrEqual(4.5);
      }
    });
  });
});
