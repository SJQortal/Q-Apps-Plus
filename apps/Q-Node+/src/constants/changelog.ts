/** The version shown in Settings → About. Bump it with every release. */
export const QNODE_PLUS_VERSION = '1.0.3-plus.1';

export const UPSTREAM_REPO = 'https://github.com/Qortal/Q-Node';
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

export const QNODE_PLUS_CHANGELOG: Release[] = [
  {
    version: '1.0.3-plus.1',
    date: '2026-09-29',
    title: 'The first + release',
    summary:
      'Q-Node, rebuilt on React 19.3 and MUI 9.4 with the Hub 3.0 look, a Settings page and four themes.',
    sections: [
      {
        title: 'Look and feel',
        notes: [
          'Hub 3.0 layout: a navigation rail on desktop and a bottom bar on phones.',
          'Four themes in Settings: Hub 3.0, Q-Node Classic, Black and White.',
          'Inter is bundled as woff2 instead of four TTF files (about 0.8 MB less to download).',
        ],
      },
      {
        title: 'Under the hood',
        notes: [
          'Upgraded to React 19.3, MUI 9.4, Vite 8 and TypeScript 5.9.',
          'A test harness with a mocked qortalRequest, so nothing in tests can touch a node.',
          'The changelog is bundled as data instead of a Markdown renderer.',
        ],
      },
    ],
  },
  {
    version: '1.0.3',
    date: '2026-02-14',
    title: 'Q-Node 1.0.3 (upstream)',
    summary: 'Sorted widgets and a QDN data peers widget.',
    sections: [
      {
        title: 'Added',
        notes: [
          'Sort widgets alphabetically.',
          'Widget "connected QDN data peers".',
          'Changelog file and a changelog dialog.',
        ],
      },
    ],
  },
  {
    version: '1.0.2',
    date: '2026-02-07',
    title: 'Q-Node 1.0.2 (upstream)',
    summary: 'Peer direction, remembered table sizes and data peers.',
    sections: [
      {
        title: 'Added',
        notes: [
          'Direction column for peers.',
          'Persistent row selection for tables.',
          'Manage data peers widget.',
        ],
      },
      { title: 'Fixed', notes: ['Get minting accounts API call.'] },
    ],
  },
  {
    version: '1.0.1',
    date: '2026-01-30',
    title: 'Q-Node 1.0.1 (upstream)',
    summary: 'The initial release of Q-Node.',
    sections: [
      {
        title: 'Added',
        notes: [
          'Node status dashboard with real-time data.',
          'Connected peers management.',
          'Minting accounts overview.',
          'Admin actions (restart, stop, force sync).',
          'Internationalization (i18n) support.',
          'Responsive design with Material-UI.',
          'Widget-based layout with sortable cards.',
        ],
      },
    ],
  },
];
