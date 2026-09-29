/** The + version series continues from upstream q-shop, which never set a version (0.0.0). */
export const APP_VERSION = "1.0.0-plus.1";

export interface Release {
  version: string;
  date: string;
  title: string;
  notes: string[];
}

export const CHANGELOG: Release[] = [
  {
    version: "1.0.0-plus.1",
    date: "2026-09-30",
    title: "Q-Shop+ first release",
    notes: [
      "Four themes: Hub 3.0, Q-Shop Classic, Black and White, chosen on the new Settings page.",
      "React 19.3 and MUI 9.4 under the hood; 1.4 MB of unused fonts and the old blog editor removed.",
      "Your preferred coin (QORT or ARRR) is remembered between visits.",
      "Blocked names and the changelog live in Settings.",
      "Reads and writes exactly the same stores, products, orders and reviews as Q-Shop.",
    ],
  },
];
