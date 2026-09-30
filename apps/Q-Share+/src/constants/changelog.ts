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
