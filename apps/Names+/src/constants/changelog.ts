/** The version shown in Settings → About. Bump it with every release. */
export const NAMES_PLUS_VERSION = '1.0.0-plus.1';

export const UPSTREAM_REPO = 'https://github.com/Qortal/names';
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

export const NAMES_PLUS_CHANGELOG: Release[] = [
  {
    version: '1.0.0-plus.1',
    date: '2026-09-29',
    title: 'The first + release',
    summary:
      'Names, rebuilt on React 19.3 and MUI 9.4 with the Hub 3.0 look, a Settings page and four themes.',
    sections: [
      {
        title: 'Look and feel',
        notes: [
          'Hub 3.0 layout: a navigation rail on desktop and a bottom bar on phones.',
          'Four themes in Settings: Hub 3.0, Names Classic, Black and White.',
          'Inter is bundled as woff2 instead of four TTF files (1.2 MB less to download).',
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
