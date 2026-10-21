export interface ReleaseSection {
  title: string;
  notes: string[];
  /**
   * Only for viewers who see the Explorer's detailed parts
   * (rules/explorer/access.ts): anyone else doesn't get this section.
   */
  full?: true;
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
    version: '1.0.1',
    date: '2026-10-20',
    title: 'The original Admin Board, readable again; Q-Asset trades',
    summary:
      'Minter Admins can read the original encrypted Admin Board in History, and the Explorer shows Q-Asset buys and sells and an account’s whole history.',
    sections: [
      {
        title: 'For everyone',
        notes: [
          'Explorer’s Transactions: an asset order says how it was filled and with whom (“Filled: bought 23 igorcoin from igorcoin for 529 QORT”), and the tab’s search finds it by that account too.',
        ],
      },
      {
        title: 'For Minter Admins',
        notes: [
          'History has an Admin Board filter: the cards the Minter Admins posted on the original encrypted Admin Board, with what each said, who it was about, its poll result and its comments, decrypted for you as you read them. Each says it was proposed in the original Q-Mintership.',
        ],
      },
      {
        title: 'Explorer, for Minter Admins, Dev Admins and level 5+ minters',
        full: true,
        notes: [
          'Connections reads every QORT payment each way (up to 10,000), not only the newest 100: a payment from long ago now shows.',
          'Once Overview has read an account’s whole history, Connections, Compare and the sponsee lists use all of it.',
          'Connections lists Q-Asset trades: who an account bought from and sold to, for what, with the two orders behind each; on the circle, what came in and what went out both count.',
          'Connections has one Account report: everything read on chain about the account and its connections, with Core’s own sponsorship report, as a plain Markdown file to save or copy. Each connection names its block, date and full signature, and the report says what was read. It suggests reading the whole history first, and can do it there.',
        ],
      },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-10-12',
    title: 'Q-Mintership+ 2.0: nominate, then approve',
    summary:
      'A new, simpler way into MINTER: level 5+ minters and Minter Admins nominate, Minter Admins approve, reject or let it expire.',
    sections: [
      {
        title: 'For everyone',
        notes: [
          'Home speaks to you: what your MINTER status is, with your real numbers, and the one thing to do next.',
          'Nominations show who nominated, who supports, which Minter Admins approved, rejected or are considering it (side by side, as on Decisions; on a phone the first three, then Show all), and the time left.',
          'Nominees accept with one step, so approval makes them a minter straight away.',
          'Not in MINTER yet? Home points you to the Q-Minter Guide: nominators choose community members who’d make good minters and nominate them.',
          'Every decision and nomination has its own page, with Copy link to share it. The link you send after proposing a nomination opens the nomination itself, where the nominee can accept.',
          'History links each decided change to its own decision page.',
          'History filters by type and by period: When picks the last 30 days (the default), 60 or 120 days, the last year, or a date, and a type such as Bans or Removals is searched over the whole period at once.',
          'Comment counts stay right: a reply counts on the closed card as well as in the open thread, and new comments count without a reload (Refresh reads them too).',
          'On a phone, the Approved, Rejected and Considering columns list each Minter Admin in a compact row: a small avatar beside the name, so more fit on screen.',
          'Decisions shows each kind of decision, the nominations waiting for a Minter Admin and the Minter Admin polls in a section of its own colour, with a clearer title.',
          'Decisions’ tabs show only what has something in it: no Nominations tab while none are open. The Nominations tab is green, as Add to MINTER is.',
          'Comment threads open and close smoothly, without the page jumping.',
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
          'Explorer: look up any account, name or transaction, with name suggestions as you type. An account shows its level, every name it owns (not only its primary one), its groups, whether it mints now, and its transactions in plain words.',
          'Explorer’s Mintership tab tells an account’s MINTER story: its status and rounds, what it published in Q-Mintership+ under any of its names, a Minter Admin’s proposals and answers, and its posts in the original app.',
          'Transactions on Qortal: the latest transactions of every type but messages (or one type you pick) over the last 1,000 or 10,000 blocks, or from a block.',
          'In the Explorer every name, primary or secondary, and every group shows its own avatar, and an account’s page shows its whole address (the person page too).',
          'Explorer’s Transactions filters by type, by one of the account’s names (primary or secondary), by time (the last day, week, month or year, between two dates or between two blocks) and sorts newest, oldest or biggest amount first. What you pick stays in the link.',
          'Each transaction in a list opens to its raw API response, coloured so keys, text and numbers stand apart, with Copy.',
          'Search an account’s Transactions in the Explorer with the small field at the top of the tab: a name (also one an account holds besides the one it shows), an address, an amount, a type, a block or a date, typed in part. Similar words count too, a letter or two off, listed after the exact matches. The search stays in the link.',
          'How Explorer Works (once How to read the Explorer) says what each part of the Explorer shows, where it comes from, and what acts.',
          'Open File shows what a QDN publish holds, right in the Explorer: pictures to zoom, videos and sounds, PDFs page by page (with a dark page view), JSON laid out in colour, tables, text, a ZIP’s list of files, and each file of a website or app. Save File keeps it on your device through Hub’s save prompt; a website or app of many files is saved whole, packed into one .zip. Encrypted resources are never opened.',
          'Each name on an account’s Names tab opens to its whole history: every change since it was registered (sales, listings, renames, its data), by every account that had it, read back through its owners.',
          'Every name on screen opens the name: in a transaction’s line and its details, histories, the Quiz and Open File. It lands on its owner’s Names tab, on that name, with its whole history open. Accounts in a transaction’s line open too.',
          'Back returns to a page as you left it: scrolled to the same place, with the same rows and lists open, whether by the app’s Back, Hub’s, or a crumb of your trail.',
          'On a phone or tablet, swipe left or right on an account to go through its tabs.',
          'Explorer’s Names shows each name as a card (or a list, if you prefer), sortable, with its history right beside it. What an account published on QDN is in Transactions.',
          'On a phone, Explorer is in the bottom bar, and Settings is the gear at the top of Home.',
          'Replies reach you: Hub can alert you when someone replies to your comment (Settings → Notifications), Home lists the replies since your last visit, and opening one goes straight to it in its thread. Replies posted from this version on count.',
          'Close comments at the bottom of a thread folds it away smoothly, and the rest of the page stays where it is.',
          'A transaction’s page says where it belongs and opens it there: a Q-Tube video, comment or like, a Torq post, reply or like, a share in Q-Share, a crowdfund in Q-Fund, an issue in Q-Support, a store in Q-Shop, a blog post, a song, a website or a Q-App. A comment or a like that only holds a hash of what it is about is looked for when you ask.',
          'Copy the link in the Explorer copies the page as it is, with its tab and filters.',
          'When a minting level moved from another account, Node online counts the time on both accounts, and the Minter Profile shows where the level came from and when it moved.',
          'Nominees proposed on chain, as the original Q-Mintership does, show by name in the Explorer.',
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
          'Decline a join request: from Propose, pick someone from Requested to join MINTER Group (who was in MINTER before and when each person asked, sorted by newest or oldest request, level, blocks minted or name, and searchable by name or address), then propose declining it, with a reason everyone sees. Once enough Minter Admins approve, their join request goes, and they can send a new one later.',
          'A note for the Minter Admins only: when you propose, step down or nominate, add a description only the Minter Admins can read (encrypted to them); it shows under the public reason. You can add it later, or edit it, on your own decision or nomination.',
          'Comments for the Minter Admins only: on any decision or nomination, choose Everyone or Minter Admins only for each comment (encrypted to them), in the same thread as the public ones. A reply to one is one too.',
          'Minter Admin polls: ask the Minter Admins an advisory question from Propose. They vote Yes, No or Neutral until it ends (1 to 30 days, 7 by default), with comments. Polls, votes and comments are encrypted to the Minter Admins, and a poll can be shared with admins added since. Nothing changes on chain from the result.',
          '"Hide already voted on" keeps Decisions to what still needs you: decisions you approved or rejected, and Minter Admin polls you voted on.',
          'The History tab counts the changes decided since you last looked (on a phone, Activity’s History button does).',
          'Approve in one step, or several in a row. Every Hub confirmation is explained before it opens, with its fee.',
          'Propose a removal, a ban, an admin change, lifting a ban or cancelling an approved invite, and add your own approval in the same step. Each opens a page of its own, as Propose nomination does, with a list to pick from: the members, the Minter Admins, the bans in force, the approved invites, with avatars. Someone a proposal like it already waits for is crossed out, with a link to it.',
          'Reject a decision, also one you approved: on chain that is a rejection, counted against the same target as approvals, and the app says so before Hub opens.',
          "Mark a decision or a waiting nomination as Considering, with an optional note, so the other Minter Admins and the nominee know you're looking. Rejected one but looking again? Mark it as Reconsidering.",
          'Before an admin change, see what it would do to the target and to every waiting decision, and tick "I\'ve checked these" before Hub opens.',
          'Decisions says when the target has changed since you last looked, and why; your Home points there too.',
          'Step down as Minter Admin from your own page.',
          'Activity counts any signature, approval or rejection, as taking part: only doing nothing is a miss, and a double that runs out is never one.',
          'Minter Admin Activity sorts by any column: press a header, and again to reverse it. Participation bars fill and the score counts up as they load.',
          'Cancel an approved invite lists every invite nobody used, with who invited and when it was approved, and cancels the older ones in one go, with your approval on each.',
          'Hide a comment for everyone; any Minter Admin can show it again.',
          'A decision’s and a nomination’s page open the person in the Explorer.',
        ],
      },
      {
        title: 'Explorer, for Minter Admins, Dev Admins and level 5+ minters',
        full: true,
        notes: [
          'These parts of the Explorer are shown to Minter Admins, Dev Admins and MINTER members at level 5 or above.',
          'Connections shows how an account is linked to others, each link with the transactions behind it: a minting level moved, a sponsor and the accounts it sponsored, names bought or sold, payments each way, where its first QORT came from, QORT sent to or got from exchanges, and nominations, supports and votes. As a circle or a list, with the same small search as Transactions; the circle puts the most transactions first, or the most QORT. Open any account to follow the links on; the trail shows the way back.',
          'Compare 2 to 4 accounts: what passed between them, a timeline together, what they have in common, and the facts side by side. Copy findings gives them as text to share. Adding an account to Compare says so in a small note just under the button; a decision’s and a nomination’s page compare the nominee with their nominator in one step.',
          'A sponsor’s sponsored accounts in one list (in MINTER now, minting now, level, minting penalty), and on request who made their first QORT payment and where their QORT went.',
          'The Overview shows an account’s direct links, its activity over time (a chart with its milestones) and QORT minted, purchased / sold and received / sent, added up from its whole history; the Minter Profile shows QORT minted beside blocks minted. Exchanges’ accounts are named as such.',
          'The activity chart says plainly when it has read an account’s whole history, so there is nothing older to read; a longer one has Read older and Read all of it, phones included.',
          'Connections rows are more compact: the block sits beside the sentence and the button that opens the transactions is on the right (just the count on a phone). Opened, each transaction shows its details, the accounts in it and Open transaction.',
          'The Connections circle’s See the list opens the whole list under the circle: the accounts on the circle first, a clear line, then the ones it leaves out.',
          'When a minting level moved from another account, the Minter Profile shows the QORT minted there and the QORT minted by both accounts together.',
          'QORT minted reads accounts whose balance Core writes as 0E-8, and says when it can’t read something, with Retry.',
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
          'The Explorer only reads: it sends nothing and costs nothing. Busy accounts are read in pages, two searches at a time, and every list says how far it got.',
        ],
      },
    ],
  },
];
