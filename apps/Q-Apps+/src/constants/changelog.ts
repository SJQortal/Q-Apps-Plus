export const APP_VERSION = '1.0.0';

export interface Release {
  version: string;
  date: string;
  title: string;
  notes: string[];
}

export const CHANGELOG: readonly Release[] = [
  {
    version: '1.0.0',
    date: '2026-09-30',
    title: 'First version',
    notes: [
      'One page that lists every + app: Q-Mail+, Q-Shop+, Q-Share+, Q-Support+, Q-Tube+, Q-Trade+, Q-Fund+, Names+, Q-Node+ and Q-Mintership+.',
      'Search and category filters, favourites, and a Recently opened row.',
      'An app page with what the + version adds, the QDN publish details, and a link to the original app.',
      'Live QDN details for every app from one batched search, cached for the session.',
      'Hub 3.0 look with the four themes and a Settings page.',
      'A phone layout for Qortal GO and narrow Hub windows.',
    ],
  },
];
