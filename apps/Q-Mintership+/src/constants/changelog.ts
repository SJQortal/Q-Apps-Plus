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
      'A new, simpler way into MINTER: level 5+ minters and Minter Admins nominate, Minter Admins sign, reject or let it expire. Not published yet.',
    sections: [
      {
        title: 'For everyone',
        notes: [
          'Home speaks to you: what your MINTER status is, with your real numbers, and the one thing to do next.',
          'Nominations show who nominated, who supports, the signatures and rejections so far, how many Minter Admins are considering, and the time left.',
          'Nominees accept with one step, so approval makes them a minter straight away.',
          "Not nominated yet? Show you're ready to mint: a short self-check, then a join request nominators can see.",
          'Nominations has a Ready to mint list of everyone who asked to join, so nominators can reach out.',
          'Ready to mint says who was in MINTER before, and you can search it by name or address.',
          'Every decision and nomination has its own page, with Copy link to share it.',
          'Public comments on every decision and nomination: reply, edit or delete your own, and mute a name on your device.',
          'Home says what changed since your last visit. Settings can turn on Hub alerts for new nominations, or for being nominated.',
          'Any MINTER member can propose themselves as a Minter Admin, with a short statement.',
        ],
      },
      {
        title: 'For Minter Admins',
        notes: [
          'One Decisions queue for nominations, removals, bans and admin changes, most urgent first, with k of n and a live countdown.',
          'Sign in one step, or several in a row. Every Hub confirmation is explained before it opens, with its fee.',
          'Propose a removal, a ban, an admin change, lifting a ban or cancelling an approved invite, and add your own signature in the same step.',
          'Reject a decision, or withdraw your signature: on chain both are a rejection, counted against the same target as signatures, and the app says so before Hub opens.',
          "Mark a decision or a waiting nomination as Considering, with an optional note, so the other Minter Admins and the nominee know you're looking.",
          'Before an admin change, see what it would do to the target and to every waiting decision, and tick "I\'ve checked these" before Hub opens.',
          'Decisions says when the target has changed since you last looked, and why.',
          'Step down as Minter Admin from your Home or your own page.',
          'Propose cancelling all stale invites, with your signature on each.',
          'Hide a comment for everyone; any Minter Admin can show it again.',
        ],
      },
      {
        title: 'Under the hood',
        notes: [
          'Signature counts and deadlines follow Qortal Core exactly, from live block times.',
          'Every read is bounded, paged and cached; nothing loads everything at once.',
          'Hub 3.0 look with four themes, built for phones first.',
          'Every write was proven on a private test chain before release.',
          'Your answer shows at once and settles as soon as it is in a block.',
          'Every dialog works by keyboard and screen reader, with focus kept where you are.',
        ],
      },
    ],
  },
];
