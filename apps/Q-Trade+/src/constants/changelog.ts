/** The version shown in Settings → About. Bump it with every release. */
export const QTRADE_PLUS_VERSION = "1.0.0-plus.1";

export const UPSTREAM_REPO = "https://github.com/Qortal/q-trade";
export const SOURCE_REPO = "https://github.com/SJQortal/Q-Apps-Plus";

export interface ReleaseSection {
  title: string;
  notes: string[];
}

export interface Release {
  version: string;
  date: string;
  title: string;
  summary: string;
  sections: ReleaseSection[];
}

export const QTRADE_PLUS_CHANGELOG: Release[] = [
  {
    version: "1.0.0-plus.1",
    date: "2026-09-30",
    title: "The first + release",
    summary:
      "Q-Trade, rebuilt on React 19.3 and MUI 9.4 with the Hub 3.0 look, a Settings page and four themes. Buying, selling, fees and sending work exactly as before.",
    sections: [
      {
        title: "Look and feel",
        notes: [
          "Hub 3.0 layout: Buy, Sell, History and Settings in a navigation rail on desktop and a bottom bar on phones.",
          "Four themes in Settings: Hub 3.0, Q-Trade Classic, Black and White.",
          "Terms and conditions, the node indicator and the fee settings moved to the Settings page.",
          "Inter is bundled as woff2 instead of three TTF files (1.4 MB less to download).",
        ],
      },
      {
        title: "Under the hood",
        notes: [
          "Upgraded to React 19.3, MUI 9.4, Vite 8 and TypeScript 5.9.",
          "A test harness with a mocked qortalRequest, so nothing in tests can trade, sign or spend.",
        ],
      },
    ],
  },
];
