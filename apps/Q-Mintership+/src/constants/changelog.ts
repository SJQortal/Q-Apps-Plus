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
          'Every decision and nomination has its own page, with Copy link to share it. The link you send after proposing a nomination opens the nomination itself, where the nominee can accept.',
          'History links each decided change to its own decision page.',
          'Public comments on every decision and nomination: reply, edit or delete your own, and mute a name on your device. Settings lists the names you muted, to unmute them.',
          'Home says what changed since your last visit, and nominators see how the nominations they made ended. Settings can turn on Hub alerts for new nominations, for being nominated, or for support on a nomination you made.',
          'Any MINTER member can propose themselves as a Minter Admin, with a short statement (level 5+ is suggested).',
          'A former member whose ban ended or was lifted says so, with the date.',
          'Names inside sentences are always underlined, and the signature ring’s "of 8" is easier to read.',
        ],
      },
      {
        title: 'For Minter Admins',
        notes: [
          'One Decisions queue for nominations, removals, bans and admin changes, most urgent first, with k of n and a live countdown.',
          'Doubles are marked: an admin change that adds someone who is already a Minter Admin, removes someone who isn’t one, or repeats one already waiting says so on its card, and doesn’t count as waiting for you.',
          '"Hide what I answered" keeps the queue to what still needs you, signed or rejected alike.',
          'Sign in one step, or several in a row. Every Hub confirmation is explained before it opens, with its fee.',
          'Propose a removal, a ban, an admin change, lifting a ban or cancelling an approved invite, and add your own signature in the same step.',
          'Reject a decision, or withdraw your signature: on chain both are a rejection, counted against the same target as signatures, and the app says so before Hub opens.',
          "Mark a decision or a waiting nomination as Considering, with an optional note, so the other Minter Admins and the nominee know you're looking. Rejected one but looking again? Mark it as Reconsidering.",
          'Before an admin change, see what it would do to the target and to every waiting decision, and tick "I\'ve checked these" before Hub opens.',
          'Decisions says when the target has changed since you last looked, and why; your Home points there too.',
          'Step down as Minter Admin from your own page.',
          'Activity counts any answer as taking part: only doing nothing is a miss.',
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
