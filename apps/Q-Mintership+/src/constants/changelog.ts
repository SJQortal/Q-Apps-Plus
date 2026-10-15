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
    title: 'Q-Mintership+ 2.0: nominate, then approve',
    summary:
      'A new, simpler way into MINTER: level 5+ minters and Minter Admins nominate, Minter Admins approve, reject or let it expire. Not published yet.',
    sections: [
      {
        title: 'For everyone',
        notes: [
          'Home speaks to you: what your MINTER status is, with your real numbers, and the one thing to do next.',
          'Nominations show who nominated, who supports, which Minter Admins approved, rejected or are considering it (side by side, as on Decisions; on a phone the first three, then Show all), and the time left.',
          'Nominees accept with one step, so approval makes them a minter straight away.',
          "Not nominated yet? Show you're ready to mint: a short self-check, then a join request nominators can see.",
          'Nominations has a Ready to mint list of everyone who asked to join, so nominators can reach out.',
          'Ready to mint says who was in MINTER before, and you can search it by name or address.',
          'Every decision and nomination has its own page, with Copy link to share it. The link you send after proposing a nomination opens the nomination itself, where the nominee can accept.',
          'History links each decided change to its own decision page.',
          'History’s On chain list filters by type: invites, join requests, joins, declined requests, removals and bans, leaves, lifted bans, cancelled invites and Minter Admin changes, each with its count.',
          'Public comments on every decision and nomination: reply, edit or delete your own, and mute a name on your device. Settings lists the names you muted, to unmute them.',
          'Home’s Your nominations has Details and Open in Decisions on each nomination.',
          'Home says what changed since your last visit, and nominators see how the nominations they made ended. Settings can turn on Hub alerts for new nominations, for being nominated, or for support on a nomination you made.',
          'Any MINTER member can propose themselves as a Minter Admin, with a short statement (level 5+ is suggested).',
          'A former member whose ban ended or was lifted says so, with the date. A declined join request never makes anyone a former member.',
          'Names inside sentences are always underlined, and the approval ring’s "of 8" is easier to read.',
          'A nomination’s links show straight away, each with the icon of the app or website it opens.',
          'Avatars your node is still fetching come in by themselves, without a refresh; until then, the name’s first letter shows.',
          'Replies stand apart from the comment they answer, and each quotes it: press the quote to go there.',
          'A nomination’s reason shows in full, in a frame of its own with its links (on a phone a long one opens with Show the whole reason), and each comment sits in its own frame.',
          'Not a Minter Admin? Vote Yes or No on an open nomination, so the admins can weigh the community’s view. Who voted shows beside Copy link on its card, and on their comments. Advisory: the Minter Admins decide on chain.',
        ],
      },
      {
        title: 'For Minter Admins',
        notes: [
          'One Decisions queue for nominations, removals, bans and admin changes, most urgent first, with k of n and a live countdown.',
          'Approve and Reject: the same two words on every decision, button and line. Approving says what Hub will show: a GROUP_APPROVAL, your yes to a change already proposed on chain.',
          'Each decision shows who approved, who rejected and who is considering side by side, with the rule for a tie (approvals are counted first), and its comments show what each Minter Admin chose.',
          'Cancelling an approved invite says which invite it cancels: who sent it and when it was approved.',
          'Decisions by type: a section for each kind of change (Add to MINTER, Remove or ban, Cancel an approved invite, Minter Admin changes, …), with a chip per type that jumps to it; or most urgent first, as one queue. The choice stays on this device.',
          'Minter Admin polls show Yes, No and Neutral side by side, as a decision shows its answers, and their details in full (Show more on a phone); Decisions and Nominations use more of a wide screen.',
          'Doubles are marked: an admin change that adds someone who is already a Minter Admin, removes someone who isn’t one, or repeats one already waiting says so on its card, and doesn’t count as waiting for you. A repeat of a waiting change still shows what it would do to the target.',
          'Decline a join request: from Ready to mint or Propose, propose taking someone off the list, with a reason everyone sees. Once enough Minter Admins approve, their join request goes, and they can send a new one later.',
          'Minter Admin polls: ask the Minter Admins an advisory question from Propose. They vote Yes, No or Neutral until it ends (1 to 30 days, 7 by default), with comments. Polls, votes and comments are encrypted to the Minter Admins, and a poll can be shared with admins added since. Nothing changes on chain from the result.',
          '"Hide already voted on" keeps Decisions to what still needs you: decisions you approved or rejected, and Minter Admin polls you voted on.',
          'The History tab counts the changes decided since you last looked (on a phone, Activity’s History button does).',
          'Approve in one step, or several in a row. Every Hub confirmation is explained before it opens, with its fee.',
          'Propose a removal, a ban, an admin change, lifting a ban or cancelling an approved invite, and add your own approval in the same step.',
          'Reject a decision, also one you approved: on chain that is a rejection, counted against the same target as approvals, and the app says so before Hub opens.',
          "Mark a decision or a waiting nomination as Considering, with an optional note, so the other Minter Admins and the nominee know you're looking. Rejected one but looking again? Mark it as Reconsidering.",
          'Before an admin change, see what it would do to the target and to every waiting decision, and tick "I\'ve checked these" before Hub opens.',
          'Decisions says when the target has changed since you last looked, and why; your Home points there too.',
          'Step down as Minter Admin from your own page.',
          'Activity counts any answer as taking part: only doing nothing is a miss, and a double that runs out is never one.',
          'Propose cancelling all stale invites, with your approval on each.',
          'Hide a comment for everyone; any Minter Admin can show it again.',
        ],
      },
      {
        title: 'Under the hood',
        notes: [
          'Approval counts and deadlines follow Qortal Core exactly, from live block times.',
          'Every read is bounded, paged and cached; nothing loads everything at once.',
          'Hub 3.0 look with four themes, built for phones first.',
          'Every write was proven on a private test chain before release.',
          'A refresh keeps Hub’s dark or light mode, and a tab left open across an update loads the new version instead of showing an error.',
          'Your answer shows at once and settles as soon as it is in a block.',
          'Every dialog works by keyboard and screen reader, with focus kept where you are.',
          'Subtle motion: refresh icons turn while they load, pages and lists fade in, the navigation highlight glides, buttons give a little when pressed, and ticks pop in. Reduced motion turns it all off.',
          'In GO: a new page opens at its top, the bottom bar steps aside for the keyboard, and the app follows GO’s own bars as they hide and come back.',
        ],
      },
    ],
  },
];
