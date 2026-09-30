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
    version: "1.0.0",
    date: "2026-09-30",
    title: "Q-Share+ 1.0",
    notes: [
      "Same QDN data as Q-Share: your shares, files and comments are the ones you already have, and what you publish here still opens in the original.",
      "Four themes (Hub 3.0, Q-Share Classic, Black and White) that follow Hub's light and dark mode, all readable at 4.5:1 contrast.",
      "Built for phones and GO: a bottom bar, a Share button, a header that hides as you scroll, Back buttons, filters in a bottom sheet, pull-to-refresh, and Share and Edit forms that fill the screen with Publish above the keyboard.",
      "Home: filters, sort, My shares for one or all of your names, a Following feed, hidden names, list or grid view, and name suggestions in the publisher filter.",
      "Share pages preview images, text, audio and video, open PDFs in Hub's reader, fetch all files at once, save them one by one or as one .zip, and keep descriptions safe.",
      "Publishing: drag and drop, file sizes and a total, a draft that survives closing, progress for each file, and retries that never pay twice.",
      "Collections: save shares to named lists, browse everyone's on the Collections page and each name's on its profile.",
      "Settings: a searchable name switcher, content options, blocked names, network statistics on demand, and Sync to save and restore your settings on QDN.",
      "Lean on Qortal: paged, cached searches, one search and one fetch to open a share, lazy avatars, and a first download a quarter of the original's size.",
    ],
  },
];
