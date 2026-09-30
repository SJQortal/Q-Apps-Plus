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
    date: '2026-09-30',
    title: 'The first + release',
    summary:
      'Names, rebuilt on React 19.3 and MUI 9.4 with the Hub 3.0 look, four themes, a Settings page, fewer node requests and clearer buy and sell flows.',
    sections: [
      {
        title: 'Look and feel',
        notes: [
          'Hub 3.0 layout: a navigation rail on desktop and a bottom bar on phones.',
          'Four themes in Settings: Hub 3.0, Names Classic, Black and White.',
          'My names and the market are lists with avatars and status chips; on phones the actions sit behind a menu.',
          'Every list has loading, empty and error states with Retry.',
        ],
      },
      {
        title: 'Market',
        notes: [
          'Sort by name, price, length or newest; rows show the seller and the registration date.',
          'Buying shows the price, the transaction fee, the total and your balance before Qortal asks you to confirm.',
          'Selling starts with an empty price, accepts only a positive amount and shows the listing fee.',
        ],
      },
      {
        title: 'Faster on Qortal',
        notes: [
          'The for-sale list and your names load in pages instead of one unlimited request.',
          'One avatar lookup for all your names instead of one per name, cached for the session.',
          'Fees are fetched once per session; polling pauses while the tab is hidden and only runs while a transaction is pending.',
          'Inter is bundled as woff2 instead of four TTF files (1.2 MB less to download).',
        ],
      },
      {
        title: 'Fixed',
        notes: [
          'Several messages showed raw translation keys or the wrong text (balance lines, update success, avatar error).',
          'Names with spaces or non-ASCII characters now load their avatar and pass the availability check.',
          'Filtering the list down to your primary name no longer enables Update and Sell on it while you own other names.',
          'Names outside Core\u2019s 3\u201340 character limits are flagged before any request.',
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
