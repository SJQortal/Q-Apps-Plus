export const APP_VERSION = "1.0.0-plus.1";
export const UPSTREAM_URL = "https://github.com/Qortal/q-fund-v2";
export const SOURCE_URL = "https://github.com/SJQortal/Q-Apps-Plus";

export interface ChangelogEntry {
  version: string;
  date: string;
  notes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.0.0-plus.1",
    date: "2026-09-30",
    notes: [
      "First + release, built from Qortal/q-fund-v2 master (2024-04-17).",
      "Runs on React 19.3 and MUI 9.4; the editor moved to react-quill-new (Quill 2) and stays readable in the original Q-Fund.",
      "Four themes (Hub 3.0, Q-Fund Classic, Black, White) and a Settings page with this changelog.",
      "Test harness with a qortalRequest mock; no test can publish or spend QORT.",
    ],
  },
];
