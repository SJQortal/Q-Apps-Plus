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
    version: "1.0.0-plus.1",
    date: "2026-09-30",
    title: "Q-Share+ first pass",
    notes: [
      "Moved to React 19.3 and MUI 9.4 on Vite 8.",
      "Four themes: Hub 3.0 (default), Q-Share Classic, Black and White, chosen in Settings and remembered per app.",
      "A Settings page with your active name, appearance, blocked names and this changelog.",
      "The description editor runs on Quill 2; what you publish stays readable in the original Q-Share and old shares still display here.",
      "Same QDN data as Q-Share: your shares, files and comments are the ones you already have.",
    ],
  },
];
