import pkg from "../../package.json";

export const APP_VERSION: string = pkg.version;
export const UPSTREAM_REPO = "https://github.com/Qortal/q-share";
export const PLUS_REPO = "https://github.com/SJQortal/Q-Apps-Plus";

export interface Release {
  version: string;
  date: string;
  title: string;
  notes: string[];
}

/** Newest first. Keep this in step with CHANGELOG.md. */
export const CHANGELOG: Release[] = [
  {
    version: "1.0.0-plus.6",
    date: "2026-09-30",
    title: "Find your names",
    notes: [
      "With more than 15 names, the name switcher has a search field: type part of a name, accents and capitals optional, and press Enter or tap it.",
      "Settings → Account uses the same picker, with avatars, instead of a plain list.",
      "The arrow keys move through the whole account menu, and your active name is always in view when it opens.",
    ],
  },
  {
    version: "1.0.0-plus.5",
    date: "2026-09-30",
    title: "Grid view and name suggestions",
    notes: [
      "Grid view: show shares as cards on Home, profiles and collections, with the list/grid switch above each list or in Settings → Appearance.",
      "The publisher filter suggests names as you type, with their avatars; pick one to filter at once.",
      "My shares can show the shares of all your names, not only the active one.",
      "The account menu shows each name's avatar.",
      "The header lines up with the page: the tagline sits beside Q-Share+, and the buttons end where the content ends.",
    ],
  },
  {
    version: "1.0.0-plus.4",
    date: "2026-09-30",
    title: "Tested in Qortal Hub",
    notes: [
      "Checked in Qortal Hub with real shares, on desktop, narrow and phone sizes, in all four themes and in Hub's light and dark mode.",
      "Safer share pages: a description can no longer run script or restyle the app, and web links copy their address instead of doing nothing.",
      "Copied links open Q-Share+ in Hub: they now name the app Q-Share+ instead of Q-Share%2B, which opened a blank tab.",
      "PDFs open in Hub's own PDF reader. The inline preview was always blank in Hub and GO.",
      "Home shows titles at once, says when a share isn't reachable instead of spinning forever, leaves deleted shares out, and keeps paging when hidden names empty a page.",
      "Phones: the header and Back bars stay put, pages are lighter, the Share button and toasts no longer cover content, landscape has a compact bar with Share in it, and share pages have one compact row of actions.",
      "Saving: saying no in Hub is not an error, GO and big files stream straight from the node, and downloads that finish after you leave a share can still be saved.",
      "Publishing waits as long as Hub does, checks QDN before offering a retry so nothing is paid twice, shows each file's progress, and understands a decline in every Hub language.",
      "Hub's light/dark switch applies without a reload; comments filed under a share's comments id show up; the editor no longer adds colours that vanish in other themes.",
    ],
  },
  {
    version: "1.0.0-plus.3",
    date: "2026-09-30",
    title: "Settings sync, zip saves, profile collections",
    notes: [
      "Settings → Sync saves your settings and theme to QDN under your name and restores them on another device. Saving publishes a small document, so Hub asks you to confirm.",
      "Save all as .zip on a share page once its files are on the node: one save dialog for the whole share.",
      "The downloads list saves any file that is ready, your own share page offers Edit share, and profile pages have a Collections tab.",
      "The publish dialog shows the total size and the time elapsed while Hub works.",
      "An accessibility audit now runs on every screen in every theme; the structure it asked for is in place.",
    ],
  },
  {
    version: "1.0.0-plus.2",
    date: "2026-09-30",
    title: "Phones, collections and previews",
    notes: [
      "Built for phones and GO: a bottom bar, a floating Share button, a header that hides as you scroll, Back buttons, filters in a bottom sheet, pull-to-refresh, and Share and Edit forms that fill the screen with Publish above the keyboard.",
      "Collections: save any share to a named collection with the bookmark button, browse them on the Collections page, and edit or remove items. Collections are new data; the original Q-Share ignores them.",
      "Sharing files: drag and drop or tap to choose, see each file's type and size and the total, remove files before publishing, watch progress step by step and retry the ones that failed. A draft survives closing the dialog.",
      "Share pages preview PDF and text files, open images in a lightbox, play audio and video on demand, and fetch all files with one tap.",
      "Home has a Following feed, My shares, hidden names, and refreshes after you publish.",
      "Settings: automatic image previews, the Following feed, default sort, hidden names, and Clear finished downloads.",
      "Still lean on Qortal: one paged search on first load, one search and one fetch to open a share, and a smaller first download than before.",
      "106 tests, a clean lint, and a screenshot check of every screen at five sizes in four themes.",
    ],
  },
  {
    version: "1.0.0-plus.1",
    date: "2026-09-30",
    title: "Q-Share+ first pass",
    notes: [
      "Same QDN data as Q-Share: your shares, files and comments are the ones you already have.",
      "Faster on Qortal: no more unlimited searches, one paged search on first load, comment threads in two searches, and a first download a third of the size.",
      "Four themes: Hub 3.0 (default), Q-Share Classic, Black and White, chosen in Settings and remembered per app.",
      "A cleaner Home: filters in a rail (a Filters button on phones), sort by newest or oldest, a My shares chip, and clear empty and error states.",
      "Rows show file count, size and age; Copy link, Edit and Block are labelled buttons that work on touch screens.",
      "Share pages preview images inline and play audio and video on demand; copied links open Q-Share+ and keep names with spaces or + intact.",
      "A Settings page with your active name, appearance, blocked names, on-demand network statistics and this changelog.",
      "The description editor runs on Quill 2; what you publish stays readable in the original Q-Share and old shares still display here.",
      "Downloads stop polling when the file is ready or the tab is hidden.",
      "Moved to React 19.3 and MUI 9.4 on Vite 8, with 26 tests.",
    ],
  },
];
