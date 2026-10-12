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
    version: '1.0.0',
    date: '2026-10-12',
    title: 'Q-Mintership+ 2.0: nominate, then sign',
    summary:
      'A new, simpler way into MINTER: level 5+ minters and Minter Admins nominate, Minter Admins sign or let it expire. Not published yet.',
    sections: [
      {
        title: 'For everyone',
        notes: [
          'Home speaks to you: what your MINTER status is, with your real numbers, and the one thing to do next.',
          'Nominations show who nominated, who supports, the signatures so far and the time left.',
          'Nominees accept with one step, so approval makes them a minter straight away.',
        ],
      },
      {
        title: 'For Minter Admins',
        notes: [
          'One Decisions queue for nominations, removals, bans and admin changes, most urgent first, with k of n and a live countdown.',
          'Sign in one step, or several in a row. Every Hub confirmation is explained before it opens, with its fee.',
        ],
      },
      {
        title: 'Under the hood',
        notes: [
          'Signature counts and deadlines follow Qortal Core exactly, from live block times.',
          'Every read is bounded, paged and cached; nothing loads everything at once.',
          'Hub 3.0 look with four themes, built for phones first.',
        ],
      },
    ],
  },
];
