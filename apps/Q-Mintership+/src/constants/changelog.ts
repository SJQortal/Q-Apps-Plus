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

export const CHANGELOG: Release[] = [
  {
    version: '3.0.5-plus.1',
    date: '2026-09-29',
    title: 'React rewrite, phase 1',
    summary:
      'Q-Mintership rebuilt on React 19.3 and MUI 9.4 with the Hub 3.0 look, four themes and a Settings page. The boards arrive in the next phases; the original app keeps working meanwhile.',
    sections: [
      {
        title: 'Look and feel',
        notes: [
          'Hub 3.0 layout: a navigation rail on desktop and a bottom bar on phones and narrow Hub panes.',
          'Four themes in Settings: Hub 3.0, Q-Mintership Classic, Black and White.',
          'A Settings page with your account, appearance, board defaults and this changelog.',
        ],
      },
      {
        title: 'Under the hood',
        notes: [
          'Every Qortal call from the original QortalApi.js is now a typed, unit-tested module.',
          'Searches are paged, merged and cached instead of unlimited.',
          'Old #/minter/… deep links still open the right card.',
          'Nothing in tests can publish, sign, vote or spend: every write action is mocked.',
        ],
      },
    ],
  },
];
