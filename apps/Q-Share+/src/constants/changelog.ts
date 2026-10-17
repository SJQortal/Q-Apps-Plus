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
    version: "1.0.1",
    date: "2026-10-17",
    title: "Notifications, 300 files, folders and playlists",
    notes: [
      "Share up to 300 files at once. Big shares go out in batches of 20 that the network accepts, the share itself once all its files are there, and you can let Hub approve every batch at once.",
      "If publishing stops halfway, the files already on QDN stay in your draft, so publishing again sends only the rest.",
      "Collections can have folders (and folders inside folders) and covers. Move a share between folders, or add it straight to one.",
      "Shares with several audio files play as a playlist, in a player that keeps going while you browse.",
      "Sort by name in the Share form puts numbered tracks in order.",
      "A bell at the top tells you when someone comments on your shares, replies to your comments or adds your share to a collection.",
      "Turn on Hub alerts in Settings → Notifications, and Qortal Hub tells you about new comments even while Q-Share+ is closed.",
      "Audio and video files say Play audio and Play video, and Close player once the player is open.",
      "Subtitles and checksum files preview as text, audiobooks (.m4b) and WebM audio play, and comic books are listed as documents.",
      "On phones, the description's placeholder no longer covers the first word while the keyboard is still composing it.",
      "In a dark Hub, refreshing Q-Share+ on any page but the first no longer shows it in its light colours.",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-09-30",
    title: "Q-Share+ 1.0",
    notes: [
      "Same QDN data as Q-Share: your shares, files and comments are the ones you already have, and what you publish here still opens in the original.",
      "Four themes (Hub 3.0, Q-Share Classic, Black and White) that follow Hub's light and dark mode, all readable at 4.5:1 contrast.",
      "Built for phones and GO: a bottom bar, a Share button, a header that hides as you scroll, Back buttons, filters in a bottom sheet, pull-to-refresh, and Share and Edit forms that fill the screen with Publish above the keyboard.",
      "Home: filters, sort, My shares for one or all of your names, a Following feed, hidden names, list or grid view, name suggestions in the publisher filter, and a ✕ to clear any search field.",
      "Share pages preview images, text, audio and video, open PDFs in Hub's reader, fetch all files at once, save them one by one or as one .zip, and keep descriptions safe.",
      "Publishing: drag and drop, file sizes and a total, a draft that survives closing, progress for each file, and retries that never pay twice.",
      "Collections: save shares to named lists, browse everyone's on the Collections page and each name's on its profile.",
      "Settings: a searchable name switcher, content options, blocked names, network statistics on demand, and Sync to save and restore your settings on QDN.",
      "Lean on Qortal: paged, cached searches, one search and one fetch to open a share, lazy avatars, and a first download a quarter of the original's size.",
    ],
  },
];
