/** The version shown in Settings → About. Bump it with every release. */
export const QTUBE_PLUS_VERSION = '2.1.0-plus.1';

export const UPSTREAM_REPO = 'https://github.com/Qortal/q-tube';
export const SOURCE_REPO = 'https://github.com/SJQortal/Q-Apps-Plus';

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

export const QTUBE_PLUS_CHANGELOG: Release[] = [
  {
    version: '2.1.0-plus.1',
    date: '2026-09-29',
    title: 'The first + release',
    summary:
      'Q-Tube 2.1.0, rebuilt on React 19.3 and MUI 9.4 with the Hub 3.0 look, a Settings page and four themes. Your videos, playlists, comments and super likes are the same QDN data as in Q-Tube.',
    sections: [
      {
        title: 'Look and feel',
        notes: [
          'Four themes in Settings: Hub 3.0, Q-Tube Classic, Black and White. Hub 3.0 and Classic follow Hub’s light or dark mode.',
          'A Settings page with your account, the theme picker, blocked names and this changelog.',
          'Inter is bundled as woff2 instead of twelve Roboto TTF files (1.8 MB less to download).',
        ],
      },
      {
        title: 'Under the hood',
        notes: [
          'Upgraded to React 19.3, MUI 9.4, Vite 8 and TypeScript 5.9.',
          'A test harness with a mocked qortalRequest, so nothing in tests can publish or spend.',
        ],
      },
    ],
  },
];
