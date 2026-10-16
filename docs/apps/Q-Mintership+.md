# Q-Mintership+

Who joins the MINTER group (694), and therefore who mints QORT: propose a nomination, then Minter Admins sign, reject or let it expire.

**Published:** not yet.

**Version on the branch:** `1.0.0` (not published), Q-Mintership+ 2.0, a rewrite on React 19.3 + MUI 9.4. Nights 1 to 3 are done on the branch: [SJQortal/Q-Apps-Plus#23](https://github.com/SJQortal/Q-Apps-Plus/pull/23). Night 2 added Simon's answers and proved every write on a private testnet. Night 3 marked "double" decisions, built Simon's answers to the night 2 questions and checked the app read-only in Hub with real data; Simon's guided real actions come next.

## Baseline at import

- **Upstream:** [Qortal/Q-Mintership-Alpha](https://github.com/Qortal/Q-Mintership-Alpha) branch `Nominations` at `cb6fcef` (2026-06-04, 95 commits), version label `v3.0.5b`.
- **Stack:** plain HTML/JS (Mobirise + Bootstrap), no build step, ~28.7k lines in 7 files. Kept in `apps/Q-Mintership+/legacy/` for reference (`git mv`, history kept).
- **Original theme (Hub 2.0, "Q-Mintership Classic"):** the `--qm-*` palette of `legacy/assets/css/forum-styles.css`, in `src/theme/classic.ts`.
- **i18n:** no. **Tests:** none. **Build:** none (static files).
- **QDN services:** BLOG_POST, MAIL_PRIVATE, FILE_PRIVATE, FILE, DOCUMENT.

## Notes

- **Decided (Simon, 2026-10-12): a new, simpler process**, in `src/` from scratch, replacing the scaffold's port of the old boards. The plan that decided it is Simon's; the facts it rests on were checked against Qortal Core 6.1.4–6.1.9, Qortal Hub's source and a mainnet node, and are pinned by tests here.
- **No threshold vote.** Changing MINTER's approval percentage is not possible in today's Core (the group's owner is the null account, and its `UPDATE_GROUP` would need that owner). Simon decided the app offers nothing for it, not even an advisory vote, until Core can apply such a change. A Core change is a separate track. Minter Admin polls (below, added on night 3) are advisory questions among the Minter Admins and change nothing on chain; nominations still have no votes or polls.
- **A clean break from the old cards and polls.** What happens on chain (invite, approvals, join) works in every app; the old cards, polls, comments and AR cards stay readable in History.
- **Added by Simon (2026-10-13), built on night 2:** Reject, Withdraw my signature and Considering; safeguards for the admin-count trap; who may propose admin changes; comments; a shareable link for every decision and nomination; "Propose nomination"; notifications. Every write is proven on a private testnet (see Testnet).
- **Added by Simon (2026-10-13), built on night 3:** doubles; his answers to the night 2 questions; Decline a join request; Minter Admin polls; subtle motion across the app. Each new write is proven on the testnet too.
- **Added by Simon (2026-10-15), built overnight to 2026-10-16:** the Explorer, a tab to look up any account, name or transaction and follow how accounts are linked (see The Explorer below). It only reads.

## The new process

| Step | Who | What happens | On chain |
|---|---|---|---|
| 1. Propose nomination | any **MINTER member at level 5+**, or any Minter Admin | Nominators look for people who'd make good minters and reach out; Nominations → **Ready to mint** lists those who asked to join. **Propose nomination**: pick the candidate by name or address, write a short reason and optional `qortal://` links. Blocked: self-nomination, current members, banned accounts, anyone with an open nomination (support it instead). | A small QDN **nomination** record (see Data contract) |
| 2. Accept (nominee, recommended) | the candidate | "Accept your nomination" sends **JOIN_GROUP** (0.01 QORT), so approval later makes them a member at once. The app explains the fee, and what to do with a 0 balance. Already done if they showed they're ready to mint. | JOIN_GROUP → join request |
| 3. First approval | the first Minter Admin who approves | Creates the GROUP_INVITE (txGroupId 694) and their own GROUP_APPROVAL, two Hub confirmations shown as one guided step. **The clock starts here.** | GROUP_INVITE + GROUP_APPROVAL |
| 4. Approvals | other Minter Admins | **Approve**, **Reject**, or do nothing and let it expire. An admin who approved can still **Reject** (on chain a rejection that replaces the approval), and one who rejected can still approve later: only each admin's latest answer counts. An admin can also mark a decision, or a nomination waiting for its first signature, as **Considering** ("I've looked at this, not sure yet"); one whose latest answer is a rejection can mark it as **Reconsidering**. A ring shows `k of n` and a countdown. Answers show at once as "You approved ✓ (confirming…)" or "You rejected (confirming…)", and settle once they are in a block. (Until 2026-10-15 the words were Sign, Signed ✓ and Withdraw my signature.) | GROUP_APPROVAL (approval true for Approve, false for Reject); Considering is a QDN record |
| 5. Done | Core | At the threshold Core applies it by itself: the nominee is in (or, with no join request, gets "Join now"). With as many rejections Core ends it as REJECTED; signatures are counted first, so with enough of both it is approved. Otherwise it expires. Either way they can be nominated again. | automatic |

- **Ready to mint, before any nomination:** anyone not in MINTER (newcomers and former members who left or were kicked) can press "Show you're ready to mint" on Home. A short self-check comes first: three boxes (own node synced and online, a minting key once in, the request can't be withdrawn), the 0.01 QORT fee against the confirmed balance, and an optional registered name. Then it sends the same JOIN_GROUP as Accept. Nominators find them on Nominations → Ready to mint, and an approved nomination makes them a member at once. The self-check's answers are not published or saved.
  - Rows of people who were in MINTER before say so under their level: "Former member: left MINTER on …", "Former member: removed from MINTER on …" (a kick), "Former member: banned, ban ended on …" (a timed ban, counted from its proposal as Core records it), "Former member: banned on …, ban ended" (a ban no longer in force with no end date shown) or "Former member: ban lifted on …" (only when the lift came before a timed ban ran out). A declined join request is never a removal. The person page and the former member's Home say the same.
  - **Decline a join request** (Simon, 2026-10-13): a join request can't be withdrawn, so a Minter Admin can propose declining one: Ready to mint → Decline (on a row with no open nomination), or Decisions → Propose → Decline a join request. On chain it is a kick of someone who asked to join and isn't a member, with the proposer's own signature (two Hub steps, 0.02 QORT) and a reason everyone sees. Once enough Minter Admins sign it, Core deletes the join request and they leave Ready to mint for everyone; they can send a new one later. While it waits it is titled "Decline a join request", and their row says "A decline is waiting for Minter Admins' signatures"; once approved it reads "Join request declined", never a removal from MINTER. Proven on the testnet (`decline`).
  - The Nominations search box searches this view too: a typed address (or 4+ characters of one) matches directly; a typed name is looked up on the node and matches its owner.
- **One wording for an open join request,** however it was sent (Accept nomination, or Show you're ready to mint): the check before joining says "Your join request is already in: you're ready. Nothing more to send."; the nominee's Home and own card say "You're ready ✓: when the admins approve, you're in at once."; others see "Ready to mint" on the nomination card and in Decisions. "You've accepted ✓" is gone.
- **"Propose nomination"** is the main action's name everywhere (Home, Nominations and its floating button, which is a round icon button with that name on phones, the page title and submit button, Ready to mint, person pages, empty states). It is one constant, `PROPOSE_NOMINATION` in `src/constants/words.ts`, in sentence case; changing it there to "Propose Nomination" changes every label, and the tests read it too.
- **Before the first admin signature**, a nomination waits on the open list for at most **10,080 blocks** (an app rule, the length of MINTER's own window), then moves to History.
- **One open nomination per candidate.** Other eligible members add their **support** ("Nominated by X, also supported by Y and Z").
- **Reject, Withdraw and Considering (Simon, 2026-10-13).** On chain, Reject and Withdraw are both a GROUP_APPROVAL with approval false:
  - only each admin's latest confirmed answer counts;
  - rejections are measured against the same target as signatures (8 of 20 admin rows today), and enough of them end the decision as REJECTED;
  - approvals are checked first, so they win a tie;
  - one rejection cancels nobody else's signature;
  - each costs 0.01 QORT.

  Considering changes nothing on chain: it is a small public QDN record under the admin's name, visible to everyone, nominee included. An admin whose latest answer is a rejection in a block can mark it again ("Reconsidering"; the dialog says their rejection still counts until they sign): it shows until their next answer. It is never offered on a double.
- **Re-nominations are normal:** 37 of the 48 people whose invites expired were approved on a later nomination.
- **Comments:** every decision and every nomination has public comments behind a "Comments (n)" toggle, so lists stay light; a decision's and a nomination's own page show them open. Anyone with a registered name can comment, reply, edit or delete their own, each a small QDN record under their name (0.01 QORT, explained before Hub opens). Without a name, the section says what a name is and links to the Names app; signed out, it offers Sign in. Text is plain (no HTML or markdown), and `qortal://` links become buttons. Comments show newest first, 20 at a time, with replies one level deep. A nomination keeps the comments from before its first signature.
  - **Moderation:** anyone can mute a name on their own device. A Minter Admin can hide a comment for everyone ("Hidden by a Minter Admin", with Show anyway), and any Minter Admin can show it again.
- **Minter Admin Activity:** participation is answered ÷ eligible: a signature and a rejection (Reject, or a withdrawn signature) are both answers, and only each admin's latest confirmed answer counts. Missed means a decision expired while they were an admin and they never answered it: only doing nothing is a miss. A double that expired is never a miss (see Doubles), worked out from the admin tenure Activity already reads (`expiredDoubles`). Cards and the table show Answered, Signed, Rejected and Missed apart, and "How this is counted" says the same (`src/rules/activity.ts`).
- **Shareable links:** `qortal://APP/Q-Mintership+/decisions/<signature>` opens one decision: the queue's own card while it waits (Sign for Minter Admins), and once decided how it ended, its decision block and date, and which Minter Admins' answers counted. `…/nominations/<address>` (or a name) opens one person's nomination in full, then every round ("Round 1", "Round 2"…) with how it ended and a link to its decision. **Copy link** is on every decision and nomination card and in each page's header; the app reports each path to Hub, so Hub's own copy link gives the same link. Old `/decisions?d=<signature>` links open the decision page. The link a nominator is given after Propose nomination opens the nomination's own page, where the nominee finds Accept; History's decided changes each have "Open the decision".
- **Since your last visit** (Home, per device, per account): Minter Admins see new decisions and new nominations in one row each, and what was decided since (approved, rejected, expired, at most 3, then a link to History); nominees see their nomination's progress (nominated, first signature, new signatures, supporters, approved, expired, rejected); nominators (level 5+ members and Minter Admins) see how the nominations they made ended ("<name> joined MINTER", "Your nomination of <name> was approved", "… was rejected", "… expired", "… closed"), the good news first, at most 3, each opening its nomination, any more one link away on Nominations; new members see "You're in". A nominee's rejection reads "Your nomination didn't go through this time", as on their Home. "Mark as seen" clears it; Settings → Notifications turns it off.
- **Hub alerts (opt-in, off by default):** Settings → Notifications → Hub alerts. Hub asks once; there is no fee, and Hub keeps the rules for the account and alerts even when the app is closed. Minter Admins are alerted to new nominations; people not in MINTER when someone nominates or supports them; nominators when someone adds their support to an open nomination they made (up to 20; opening Settings while alerts are on adds rules for new ones and drops closed ones; the last one stays until a new one replaces it, so alerts stay on until you turn them off; while the nominations can't be read, Settings says so, with Try again). Hub can only alert about published QDN records, so signatures, approvals, expiry and joining show in the Home panel instead. Hub doesn't check who published a record, so an alert only says one was published; the app checks it when opened.

**Who may propose admin changes** (app rules; Core allows more):

- **Adding a Minter Admin:** any MINTER member may propose themselves ("Become a Minter Admin", on their own Home and their own person page; suggested from level 5, and below it still offered with "Level 5+ is suggested for Minter Admins, and you're level 2. You can still propose yourself."), with an optional statement (up to 500 characters, for members with a registered name) posted as the proposal's first comment; if that step doesn't go through, the proposal stands. A Minter Admin may also propose another MINTER member (Decisions → Propose → Make a Minter Admin).
- **Removing a Minter Admin:** only Minter Admins may propose removing another admin. Any admin may "Step down as Minter Admin" on their own person page (with the same guards, impact panel and "I've checked these"); picking themselves in Propose → Remove a Minter Admin says "That's you. To step down, use Step down as Minter Admin on your own page." with a link there. It is worded as giving up the role (they stay a MINTER member), and it still needs the Minter Admins' signatures. MINTER's owner account can never be proposed for removal.
- **The proposer's own signature** follows a proposal only when the proposer is a Minter Admin (read fresh before Hub opens). A member who isn't one can't sign, so Become a Minter Admin is one Hub step with one fee (0.01 QORT; the statement is one more step and fee), and the dialog says the Minter Admins decide from there. Step down is two steps like any admin proposal (0.02 QORT in total).
- **Admin changes proposed in other apps** are listed and signed like any decision. One proposed about oneself is titled "Become a Minter Admin" or "Step down as Minter Admin", and the card says "Their own proposal". When such a proposal is waiting, Home and the person page say so and link to the decision.
- The rules are pure (`src/rules/adminChange.ts`); the guards feed them fresh reads.

**Doubles** (Simon, 2026-10-13, from a real case: a member's second "Become a Minter Admin" kept collecting signatures after the first one had made them a Minter Admin):

- A waiting admin change is a double in exactly three cases: (a) it adds someone who is already a Minter Admin; (b) it removes someone who isn't one; (c) the same kind of change about the same person is waiting more than once, and the newer one is the double of the oldest one that can still pass. Invites, kicks, bans, their cancellations and lifts are never doubles; nor is anything on the Unusual approval route, nor a decision that has expired or been decided. The rule is pure (`src/rules/double.ts`, with exhaustive tests); the Decisions loader marks `Decision.double` from the admin rows it already reads, with no new read.
- The card, the decision's own page and Sign several show a "Double" chip with an icon and words; screen readers hear "Double: changes nothing", "Double: nothing to remove" or "Double: the same change is already waiting". A note says why: (a) "<Name> is already a Minter Admin, from an earlier proposal. As things stand, if this one passes, nothing changes, so there's no need to sign it. It runs out by itself at block X (about date)."; (b) "<Name> isn't a Minter Admin, so there's nothing to remove. There's no need to sign it: reject it, or let it run out."; (c) "The same change is already waiting in an earlier proposal: answer that one instead.", with "The earlier proposal about <name>" linking to its page. For (a), the earlier approved addition is linked when that person's history is already in this session's cache. Members, who can't answer, read only why it is a double and when it runs out, with no advice.
- Sign stays on an addition that is a double, as a secondary button; a removal that is a double offers Reject only, and the Sign guard refuses it too. Considering isn't offered on a double.
- Doubles don't count towards "Waiting for your signature" (Decisions, and Home including Since your last visit), the Decisions badge, Home's "Open decisions you've signed" or Sign several, which lists them under "Not in this run:" with the reason. Decisions adds "Plus N doubles, marked on their cards: no need to sign them." They sort after the real decisions and stay in the queue.
- The projection: no impact panel, no "Target may drop/rise" chip and no "I've checked these" on a double that changes nothing ((a) and (b)). A repeat of a waiting change (c) shows the same panel, chip and check as the earlier one, since either can pass first and the one that does moves the seat; the two count once together. In a projection that removes their subject (Step down, or a waiting removal), an (a) addition can apply at the lower target, and the panel lists it as applying too.
- Activity never counts an expired double as a miss, and doesn't count it at all for an admin who left it alone; an answer on it counts like any other. An approved addition of someone already a Minter Admin moves no seat in History or Activity's pulse.
- On the testnet (`doubles`): a member's second proposal, sent the way another app would, was marked as the double of the first; once the first passed it read as "already a Minter Admin", and signed anyway it was approved with the admin rows unchanged.

**Minter Admin polls** (Simon, 2026-10-13): advisory questions for the Minter Admins, such as "Should only level 5+ minters become Minter Admins?". Nothing on chain follows from a result.

- **Ask:** Decisions → Propose → Ask the Minter Admins: a question (10–200 characters), optional details (up to 2,000) and a duration of 1–30 days (7 by default; the end date and block come from the measured block time). One Hub step, "Publish, encrypted to the N Minter Admins", 0.01 QORT, explained before Hub opens and checked against the confirmed balance. Asking needs a registered name.
- **Who can read:** each poll, vote, comment and share is a QDN record encrypted (Hub's own encryption, `PUBLISH_QDN_RESOURCE` with `encrypt: true`) to every current Minter Admin who can sign, plus the writer. Anyone can see that a record exists; only those Minter Admins can read it. An admin added later can't read older polls until any admin who can read one shares it with them ("Share with N Minter Admins added since", one more publish): a share carries the poll, every voter's latest vote and the comments as that admin read them, shown as "Shared by <name>".
- **Voting:** Yes, No or Neutral, one Hub step each (0.01 QORT); changing a vote republishes it. Each admin's latest vote counts if it was published by the poll's end; after the end, voting isn't offered. The card shows the counts, who voted what, how many haven't voted, and "Advisory: nothing changes on chain from the result."; no pass or fail.
- **Where:** a "Minter Admin polls" section on Decisions (Minter Admins only; open polls first, then those closed in the last 31 days), each poll's own page `/decisions/polls/<id>` (others read "This is for Minter Admins only"), encrypted comments in the same thread as public comments, and a line on an admin's Home once the polls have been read in the session.
- **Trust:** the publisher comes from the QDN row, never the body, and a record counts only when its name belongs to a current Minter Admin at the time of reading. A share's copy only fills in what the reader can't read themselves.
- On the testnet (`admin-polls`): a poll, three votes (1 Yes, 1 No, 1 Neutral), a member who can't read it, a comment, a new Minter Admin who can't read it until a share, then reads it and votes (2/1/1), and a vote refused after the end.

**Core facts the app follows** (each pinned by a test in `src/rules/`, and each write proven on the testnet):

- **Signatures needed:** `approvals × 100 ≥ adminCount × 40` for MINTER's PCT40, where `adminCount` includes the null owner (it counts, but can't sign). With 20 admin rows that is **8**. The count is re-read every refresh, because Core re-reads it every block. Rejections are measured against the same target.
- **Only confirmed answers count, and only each admin's latest one.** A later rejection replaces a signature (Withdraw); a later signature replaces a rejection.
- **Admin changes move the target for everything waiting.** Core recounts MINTER's admin rows (the null owner included) each time it checks a waiting decision, in every block, and an approved admin change applies within that same pass. So a new count reaches every waiting decision in the same block or the next, including decisions that already have signatures. When the target drops to what a decision already has, Core applies it with no new signature. Core gives no order for decisions checked in the same block, so the app says "in the same block or the next" and never promises which goes first (on the testnet, the one confirmed after the admin change applied in the same block, the one confirmed before it in the next).
- **The window,** for a decision confirmed at block h: earliest decision h+6, last signature that counts h+10,079, expired at h+10,081. Times come from the measured block time (72.9 s on 2026-10-12, so about 8.5 days), never an assumed 60 s.
- **Joining:** with a join request, the approved invite makes the nominee a member at once; otherwise they press Join. JOIN_GROUP needs 0.01 QORT of confirmed balance.
- **Kicks and bans** go through the same signatures. An admin must lose the admin role before a kick or ban. A ban is permanent or up to 24 days. Kicked members keep their level.
- **Proposals** (kick, ban, admin changes, lifting a ban, cancelling an approved invite) are made from Decisions → Propose, as one guided step of two Hub confirmations: the proposal, then the proposer's own signature on it, because a proposal doesn't count as its proposer's signature. "Propose cancelling all" (Clean up stale invites) does the same for each older stale invite, one after another; a cancel in Hub at either step stops the run.
- **Fees:** 0.01 QORT for every group transaction and for every QDN record; the first signature and every proposal cost two, and the fees (of a whole cancel-all run, too) are checked against the confirmed balance before Hub is asked. The check stays quiet: nothing is said about the balance unless it can't pay.

**The admin-count safeguards:**

- **Before Hub opens on an admin change**, its card, Sign, Propose, Sign several and Step down (on Home and the person page too) show what it would do: the new admin seats and target; each decision that would apply at once, end as rejected at once, or fall short of a target that rises; and any admin change that would then apply too and move the target again. Effects are worked out at the lowest and the highest admin count reachable on the way, not only where the count ends up. If anything would change, Hub opens only once "I've checked these" is ticked.
- **Affected decisions** carry a chip, "Target may drop to 8" (or "may rise to 9"), with the reason one tap away. Doubles that change nothing never do.
- **Waiting admin changes are projected** one by one, all removals together, all additions together, and all together. "Admin changes and the target" above the queue appears when an admin change with enough signatures would tip others over, or only a combination would. A waiting addition for someone no longer in MINTER doesn't count as a new seat.
- **Ordering:** before an admin change passes, settle the decisions it would flip (or let them expire), or agree the order with the other Minter Admins. An admin who signed a decision at risk can withdraw their signature while it can still count; the advice names the block it must be in, and appears only where a withdrawal can still land in time.
- **After the fact:** when the target has changed since this device last looked, Decisions says from what to what and why (who was added or removed), and lists the decisions that now have enough signatures, the soonest to apply first, and those that now end as rejected.
- **History** gives each approved admin change the target before and after ("Target 9 → 8 signatures (21 → 20 admin seats)"), counting admins' own leaves from MINTER too. **Activity's pulse** lists the target's changes in the window.

## The Explorer (Simon, 2026-10-15)

A tab to look up any Qortal account, name or transaction and follow how accounts are linked: for Minter Admins weighing a nomination, and for anyone. It merges the two pages of the old Dodgers app (`qortal://APP/Dodgers`, an account explorer and a transaction search; its published bundle carried source maps, so its whole source was read) and goes further: every name an account owns (not only `names[0]`), the nomination process, name suggestions while typing, connections with the transactions behind them, rabbit holes from account to account, and Compare.

**What it is for, in its own words:** "See what an account did on Qortal and how it is linked to other accounts." Connections and Compare open with: "Public chain and QDN facts. Accounts are linked for many ordinary reasons (trades, gifts, help for newcomers, shared groups). Nothing here shows who runs an account."

**Rules it follows** (pinned by tests):
- **Evidence, never verdicts.** Each link is a sentence with numbers, a date and a block ("Paid Bob 120 QORT in 4 payments (Mar–May 2025)"), and opens to its transactions. No scores, likelihoods or verdict words; a count comes with its denominator ("Hal Helper has sent 500+ payments"); partial data says how far it got ("in its latest 100 payments each way"); what was checked and found nothing says so ("Also checked, nothing found: level moves, name sales"); a read that failed is never shown as "nothing found".
- **Read-only.** No Hub dialogs, no fees: an ESLint rule keeps every write module out of the Explorer's folders, and its page tests assert no POST and no write request.
- **Private by design.** No `/chat/` reads; a message's content never shows (not even an unencrypted one); encrypted QDN resources (any `*_PRIVATE` service and MAIL) are counted, never listed; admin approvals and invites are MINTER process facts on the Mintership tab, never "connections"; recent explorations stay on the device, addresses only, behind a Settings switch.
- **Cheap.** Each tab and each section below the fold reads only when opened or near the screen; every list is paged (100 a read) with a ceiling it states; searches by address (Core groups every row of the account for each one, about 0.5 s on a busy account whatever the page size) go through one limiter, two at a time, the open view first, and a closed view's queued ones are dropped; nothing polls; Refresh re-reads only the open account.

**Where:** Explorer is in the rail after Activity and in the phone bar, where it takes Settings' place (the last slot); on phones Settings is the gear at the top of Home, and shows Back (open question 1).

| Path | Page |
|---|---|
| `/explorer` | the search field, recent explorations, Compare picks, quick starts (your account, nominated now, Minter Admins, recently joined MINTER), Transactions on Qortal, "How to read the Explorer" |
| `/explorer/account/<address>` (`/connections`, `/transactions`, `/mintership`, `/names`) | one account; a name in the path is looked up and replaced by its owner's address (names change hands, so links carry addresses) |
| `/explorer/sponsees/<address>`, `/explorer/funded/<address>` | the accounts a sponsor sponsored; the accounts whose first QORT payment came from this one |
| `/explorer/compare/<a>/<b>[/<c>/<d>]` | 2 to 4 accounts |
| `/explorer/tx/<signature>` | one transaction |
| `/explorer/transactions` (`?type=`, `?blocks=`) | Transactions on Qortal |

"transactions", "account" and "explorer" are registered names, so accounts live under `account/`. Fixed on the way: the original app's nav hrefs (MINTERS, TOOLS, STATS…) redirected from the last segment of any path, so `/people/Tools` opened Decisions; only a one-segment path counts now.

**The search field:** a name, a Q-address, an AT address or a transaction signature. From 2 letters, names starting with the text (one cached `/names/search` per pause, shared with Propose nomination's picker), one row per account; a name that isn't its owner's primary name reads "Q-Maps · a name of Simon James". Enter never picks a suggestion: it looks up exactly what was typed (Core matches the reduced name, so "T00LS" finds "Tools", and the page says "Core matched “Tools” (same letters, ignoring case and look-alikes)"); a name nobody has says so and lists names containing it. Never another account silently (Dodgers opened the first search result).

**An account:** a compact header on every tab (avatar, primary name, level, MINTER status in the app's own words, minting now, a minting penalty; Copy link, add to Compare, Compare with…, Refresh), the trail of accounts opened one from another (Back and a crumb cut it; a search starts a new one), then five tabs:
- **Overview:** a summary sentence (level, in MINTER since, names, first seen, last sent a transaction), Direct links, facts (level and progress, blocks minted, balance, first seen, groups), MINTER (the status sentence and the MINTER profile link, where nominating, supporting and deciding stay), minting now and the last block signed, the latest transactions, notes (a minting penalty: "Core recorded a minting penalty of −5,000,000 blocks on this account. The chain doesn't record why."; a name written like an address, starting or ending like its owner's address, or holding invisible characters).
- **Connections:** Recorded between them (a minting level moved, with the recipient read from the raw bytes since Core's JSON leaves it out; sponsored by and sponsored, with %, how long and removals; minting with another account now; names bought or sold; payments sent and received grouped by account, with MINTER marks, a MINTER-only filter, busy payers marked and collapsed, AT addresses apart); In common (where the first QORT came from, worded by what it was; also sponsored by; whose first QORT payment came from this account); In Q-Mintership (nominated, supported, voted on, from records, one account counted once across its names); Core's own sponsorship report on request; Copy findings.
- **Transactions:** the account's transactions as sentences ("Sent 15 QORT to Bob", "Got its minting level from Olga Old"), filtered by family (Payments, Names, Minting, Groups, QDN data, Trading, Messages, Other), 100 a read, the waiting ones it sent on top; each row opens to its fields and people.
- **Mintership:** the MINTER profile link, status, rounds, the MINTER timeline, what it published in Q-Mintership+ under any of its names (nominations, supports, community votes, comments, Considering), as a Minter Admin (proposals, Activity's figures when already read, every answer on request, joined to MINTER's decisions), and the original app (cards about them, cards and comments they posted, poll votes on request).
- **Names:** every name (primary first), each with its registration, sale and notes, the name history, and what was published on QDN under each name (the primary and 9 newest names at once, the rest on request; encrypted ones counted only).

**Compare:** each account lettered A–D; Recorded between them (payments both ways per pair, transfers, reward shares, level moves, name sales, trade-portal sales, Q-Mintership records), a timeline together ("Block 1,364,165 · A: first QORT payment from Hal Helper … 5 blocks later · B: …"), In common (same sponsor, same first payer, shared counterparties with direction: "A → K → B", "both paid K", "K paid both"; shared groups smallest first; raw time differences), side by side (a table from 900 px, rows on phones; "Same for all" when equal), Copy findings.

**Transactions on Qortal:** any type over the latest 1,000 or 10,000 blocks, or 10,000 from a block (Core needs a range for a chain-wide type search), 20 a page. Messages aren't offered there: an account's own tab lists the ones it took part in, but a feed of who messages whom is more than an explorer of accounts needs.

**One transaction:** the type as its title, the sentence, block and time (or waiting), the people, the fields in words, a minting-level move's recipient, an approval's transaction (and its decision page for MINTER), the raw data (a message's content and an encrypted resource's identifier stay out of it too), Copy link.

**Entry points:** the person page ("Explore links and transactions"), a decision's and a nomination's page ("Explore" the person, "Compare nominee and nominator").

## Statuses (the status-tailored Home)

The status engine (`src/rules/status.ts`, loaded by `src/data/me.ts`) resolves the signed-in account, first match wins:

| Status | From | Home shows |
|---|---|---|
| Outside Hub / signed out | no `qortalRequest` / Hub declined the account request | what Mintership is, live MINTER numbers, Sign in |
| Minter Admin | `/groups/member/{a}` admin flag | since your last visit; decisions waiting for you (doubles left out); "The target changed from 9 to 8 signatures since you last looked at Decisions. See what changed" when it moved; your activity; stale invites; then the member view (Step down is on their own person page) |
| Member, level 5+ | membership + `/addresses/{a}` level | you can propose nominations; your nominations; open ones to support; Become a Minter Admin |
| Member, level 0–4 | same | progress to level 5 (618,400 blocks), what level 5 unlocks, minting tips; Become a Minter Admin, with "Level 5+ is suggested" |
| Banned | `/groups/bans/694` (in force) | when; that admins must lift the ban first |
| Approved, not joined | `/groups/invites/{a}` | one step left: Join now |
| Nominated | the person's open nomination (record or pending invite) | since your last visit; who nominated, k of n or "waiting for a Minter Admin", rejections and Considering so far; Accept, or "You're ready ✓" once the join request is in |
| Former member: kicked / left | the address's MINTER history (approved kick, own LEAVE_GROUP) | when; that a new nomination is possible; level kept; Show you're ready to mint |
| Not in MINTER yet | none of the above (with or without a name) | how minting and nomination work; that nominators reach out; Show you're ready to mint; optional name |
| … ready to mint | not in MINTER (new or former), with a join request (`/groups/joinrequests/address/{a}`) | "you've shown you're ready to mint", that it can't be withdrawn, what happens next; their name to share. Once a nomination makes them a member, the welcome |

## Data contract

### New records (QDN, additive, own prefixes)

| Service | Identifier | Published by | Body |
|---|---|---|---|
| JSON | `qmp-nomination-<nomineeAddress>` | the nominator, under their name | `{ v: 1, nomineeAddress, nomineeName?, reason (20–600 chars), links: qortal:// only (≤ 5), createdHeight?, created? }` |
| JSON | `qmp-support-<nomineeAddress>` | a supporter | `{ v: 1, nomineeAddress, note? (≤ 280) }` |
| JSON | `qmp-considering-<key>` | a Minter Admin, under their name | `{ v: 1, pendingSignature?, nomineeAddress?, note? (≤ 280), cleared?: true }` |
| JSON | `qmp-comment-<key>-<id>` | anyone with a registered name, under that name | `{ v: 1, key, text (1–1000 chars, plain text; empty when deleted), replyTo?: identifier, edited?: true, deleted?: true }` |
| JSON | `qmp-hide-<key>-<id>` | a Minter Admin, under their name | `{ v: 1, commentName, commentIdentifier, hidden: true \| false }` |
| JSON | `qmp-vote-<nomineeAddress>-<yes\|no>-<id>` | anyone with a registered name who isn't a Minter Admin, under that name (a community vote) | `{ v: 1, nomineeAddress, vote: 'yes' \| 'no' }` |
| DOCUMENT_PRIVATE | `qmp-adminpoll-<id>` (id: 8 letters or digits) | a Minter Admin, encrypted to the Minter Admins | `{ v: 1, id, question (10–200), details? (≤ 2000), durationDays (1–30), createdAt, endsAt, endHeight, readers: [addresses] }` |
| DOCUMENT_PRIVATE | `qmp-adminvote-<pollId>` | each Minter Admin (republished to change) | `{ v: 1, pollId, vote: 'yes' \| 'no' \| 'neutral' }` |
| DOCUMENT_PRIVATE | `qmp-admincomment-<pollId>-<cid>` | a Minter Admin | `{ v: 1, pollId, text, replyTo?, edited?, deleted? }` |
| DOCUMENT_PRIVATE | `qmp-adminshare-<pollId>` | a Minter Admin who shares it | `{ v: 1, pollId, poll, pollPublisher, votes: [{ name, vote, updated }], comments, readers, sharedAt }` |

- **JSON** is Core's validated service for small JSON (valid JSON, at most 25 KB).
- One identifier per nominee: a publisher has at most one nomination and one support per person; publishing again replaces it (and restarts that nomination's waiting window).
- **`key`** is what a Considering record or a comment is about: the first 40 characters of the pending transaction's signature for a decision, or the nominee's address for a nomination still waiting for its first signature. `id` is 6 letters or digits. Identifiers stay within QDN's 64 characters (at most 59).
- **Nothing in a record is trusted on its own.** The publisher comes from the QDN search row, and is re-checked on every read: a MINTER member at level 5+, or a Minter Admin, at the time of reading. Records that fail (an ineligible publisher, a self-nomination, a malformed body, an identifier that doesn't match the body) are ignored. Builders and parsers: `src/data/records.ts` and `src/data/commentRecords.ts`, pinned by tests.
- **Considering** counts only from a current Minter Admin who can sign (the null owner left out). A decision's record must carry the whole pending signature, whose first 40 characters are the key; a waiting nomination's must carry the nominee address that is the key. Each admin's latest publish wins; "No longer considering" publishes the record again with `cleared: true`, because QDN can't delete; a later Sign, Reject or Withdraw on chain by the same admin hides it, and a record published after the admin's latest answer shows until their next one (Reconsidering). A nomination's record carries over to its invite once the first signature lands, if it was published in this round. Selection: `src/rules/considering.ts`.
- **Comments:** an edit or a deletion republishes the same identifier, and the newest version wins. A deleted comment keeps its place and shows "Deleted", so its replies still make sense. A reply's `replyTo` is the identifier it answers; threads are one level deep, and a reply to a reply shows under the first comment, saying whom it answers.
- **Hides:** one admin's hide identifier is the same for one comment each time, so hiding and showing again republish one record. Per comment, the newest hide counts, and only when the name that published it belongs to a Minter Admin at the time of reading.
- **Community votes** (Simon, 2026-10-15): a Yes or No on an open nomination from anyone who isn't a Minter Admin, so the admins can weigh the community's view. Advisory: nothing on chain follows from it. The vote is in the identifier (`yes` or `no`), so the app reads it from the search row and never reads the body, which repeats it for other readers. Each vote is a new record with a new `id` (6 letters or digits): Core lists and limits a search by when a resource was first published, so a republished identifier would sort under its first date. Per account, its newest vote counts (the row's `created`; a name is looked up to the account that owns it, so one account's names count once). A vote counts in the round it was cast in: from the nomination's start (its first record, or its invite for one proposed on chain). Votes from a current Minter Admin (their answer is on chain) and from the nominee are left out, re-checked on every read. Builders and parsers: `src/data/voteRecords.ts`; the read: `src/data/communityVotes.ts`; who counts: `src/rules/communityVotes.ts`; each pinned by tests.

### Chain writes (all through Hub; the app never POSTs to the node)

| Action | Hub request (`src/writes/hubActions.ts`, pinned by tests) |
|---|---|
| First signature | `INVITE_TO_GROUP { groupId: 694, inviteeAddress, inviteTime: 864000, txGroupId: 694 }`, then the admin's own approval (below) |
| Sign | `SIGN_TRANSACTION { unsignedBytes, process: true }` with GROUP_APPROVAL bytes built in the app (`src/qortal/approvalBytes.ts`, `groupApprovalBytes`: type 33, txGroupId 0, approval byte 176 = 1) |
| Reject / Withdraw my signature | `SIGN_TRANSACTION { unsignedBytes, process: true }` with GROUP_APPROVAL bytes from `groupRejectionBytes`: the same 185 bytes as Sign with byte 176 = 0, from its own builder typed to approval false (pinned against the three mainnet fixtures) |
| Accept nomination / Join now / Show you're ready to mint | `JOIN_GROUP { groupId: 694 }` |
| Kick | `KICK_FROM_GROUP { groupId: 694, qortalAddress, reason, txGroupId: 694 }` |
| Decline a join request | the same `KICK_FROM_GROUP` for someone who asked to join and isn't a member (`guardDecline`), then the admin's own `SIGN_TRANSACTION` on it |
| Ban | `BAN_FROM_GROUP { groupId: 694, qortalAddress, reason, banTime: 0 or ≤ 2,073,600 s, txGroupId: 694 }` |
| Lift a ban | `CANCEL_GROUP_BAN { groupId: 694, qortalAddress, txGroupId: 694 }` |
| Cancel an approved invite | `CANCEL_GROUP_INVITE { groupId: 694, qortalAddress, txGroupId: 694 }` |
| Add / remove a Minter Admin | `ADD_GROUP_ADMIN` / `REMOVE_GROUP_ADMIN { groupId: 694, qortalAddress, txGroupId: 694 }` |
| Become a Minter Admin (a member) | `ADD_GROUP_ADMIN { groupId: 694, qortalAddress: <own address>, txGroupId: 694 }`, one step; then, if written, the statement as the proposal's first comment (below) |
| Step down as Minter Admin | `REMOVE_GROUP_ADMIN { groupId: 694, qortalAddress: <own address>, txGroupId: 694 }`, then the admin's own `SIGN_TRANSACTION` on it |
| Nominate / support | `PUBLISH_QDN_RESOURCE { name, service: 'JSON', identifier, data64 }` |
| Considering / No longer considering | `PUBLISH_QDN_RESOURCE { name, service: 'JSON', identifier: 'qmp-considering-<key>', data64 }` |
| Ask, vote, comment or share (Minter Admin polls) | `PUBLISH_QDN_RESOURCE { name, service: 'DOCUMENT_PRIVATE', identifier: qmp-adminpoll-…, qmp-adminvote-…, qmp-admincomment-… or qmp-adminshare-…, data64, encrypt: true, publicKeys: [every current Minter Admin who can sign, and the writer] }` |
| Comment, reply, edit, delete; hide or show again (Minter Admins) | `PUBLISH_QDN_RESOURCE { name, service: 'JSON', identifier: qmp-comment-… or qmp-hide-…, data64 }` (`publishCommentRequest`) |
| Community vote: Yes or No (not Minter Admins) | `PUBLISH_QDN_RESOURCE { name, service: 'JSON', identifier: 'qmp-vote-<nominee>-<yes\|no>-<id>', data64 }`; changing it publishes a new one |

- **A proposal and its proposer's signature** (`proposeAndSign` in `src/writes/flows.ts`): the kick, ban, admin change, lift or cancellation above, then, once the node knows it and only when the proposer is a Minter Admin, `SIGN_TRANSACTION` on it as for Sign. If the proposal goes through and the signature doesn't, the proposal waits in the queue like any other.
- **Ready to mint adds no QDN data:** it is MINTER's join request on chain.
- `inviteTime` 864000 is what the original app sends; Hub refuses 0.
- Hub has no GROUP_APPROVAL action, so the bytes are built here. Tests rebuild three mainnet approvals byte for byte (and the rejections with only byte 176 changed), and `npm run test:decode` sends built approval and rejection bytes to a node's read-only `POST /transactions/decode?ignoreValidityChecks=true` (it only parses; nothing is stored or broadcast).
- **Before every write** the app re-reads the chain (`src/writes/guards.ts`): still pending, still an admin, not already signed, not too late to count, no duplicate waiting, no stored invite, the fee balance, and Core's limit of 25 unconfirmed transactions per account. Hub hides Core's reason when SIGN_TRANSACTION fails validation, so these checks come first.
  - Reject and Withdraw make the same checks as Sign, then check the admin's own answers: Reject goes only to an admin with no answer yet (one who signed is pointed to Withdraw); Withdraw only to an admin whose signature is in a block, while a withdrawal can still count. Nothing new is sent while one of the admin's answers is still on its way.
  - Admin changes: the rules above (`guardAddAdmin`, `guardRemoveAdmin`), and the owner account can't be proposed for removal.
  - Decline (`guardDecline`): only for an account with a MINTER join request that isn't a member; refused for Minter Admins and the owner, for an account that never asked, for a member ("To remove them, use Remove a member."), and while a kick, a decline or a nomination's signatures about them are waiting.
  - Considering: the publisher must be a Minter Admin with a registered name, and the decision still pending and in time (or the nomination still waiting). Clearing is always allowed.
  - Community vote: signed in with a registered name, not a current Minter Admin ("Minter Admins answer on chain: Approve or Reject."), not the nominee, and the nomination still waiting for its first approval or collecting approvals.
- **After Hub's 30-second timeout** the app does not offer Retry at once: Hub keeps its dialog up for 60 s and still applies a late Accept, so the app looks for the transaction for about a minute first (`src/writes/runner.ts`). The lookup matches an answer's approval flag, so a rejection is never taken for a signature or the other way round.
- **After a write** the answer shows at once ("Signed ✓ (confirming…)"); the live views (queue, nominations, chain tip, own status) refresh every 15 s, still paused while the app is hidden, until the transaction is in a block, then reload once and settle. A Considering publish re-reads only who is considering.

### Hub requests that aren't writes (no fee)

| Request | When |
|---|---|
| `SHOW_ACTIONS` | once a session, on Settings, to check whether Hub offers alerts |
| `NOTIFICATION_GET` | on Settings, to read whether alerts are on |
| `NOTIFICATION_PERMISSION`, then `NOTIFICATION_ADD { notifications }`, then `NOTIFICATION_REMOVE { notificationIds }` | only when you turn alerts on (the last drops rules that no longer fit your role) |
| `DECRYPT_DATA { encryptedData }` (no dialog) | to read a Minter Admin poll's records, once per version for the session; only for Minter Admins, only on Decisions or a poll's page |
| `NOTIFICATION_HAS_PERMISSION` (no dialog), then, only if Hub says yes, `NOTIFICATION_PERMISSION` (silent: Hub already has it), `NOTIFICATION_ADD` and `NOTIFICATION_REMOVE` | on Settings, only while alerts are on and only for a nominator whose open nominations changed: rules for new ones are added, closed ones dropped; a remove never goes out with an empty list |
| `NOTIFICATION_REMOVE` | only when you turn alerts off |

The rules registered with Hub (all `service: 'JSON'`, `prefix: true`, `excludeBlocked: true`, link `qortal://APP/Q-Mintership+/…`):

| Rule id | For | Identifier |
|---|---|---|
| `qmp-new-nomination` | Minter Admins | `qmp-nomination-` |
| `qmp-nominated-you` | not in MINTER | `qmp-nomination-<address>` |
| `qmp-supported-you` | not in MINTER | `qmp-support-<address>` |
| `qmp-supported-yours-<nomineeAddress>` | nominators (level 5+ members and Minter Admins), one per open nomination they made, at most 20 | `qmp-support-<nomineeAddress>`, link `…/nominations/<nomineeAddress>` |

### Reads (all GET, paged at 100 with a ceiling, deduped, cached)

| Need | Endpoint |
|---|---|
| Settings | `/groups/694` |
| Admins (the threshold's denominator) | `/groups/members/694?onlyAdmins=true` (the paged member list's `isAdmin` is wrong after page one) |
| Members with names | `/groups/members/694?limit=100&offset=…` (7 pages today, only where the whole group is needed) |
| Membership, join request, stored invite | `/groups/member/{a}`, `/groups/joinrequests/address/{a}`, `/groups/invites/{a}` |
| Join requests, stored invites, bans | `/groups/joinrequests/694`, `/groups/invites/group/694`, `/groups/bans/694` |
| Ready to mint (Nominations) | the join requests above less members, admins and bans in force (reads the nominations already make), 20 rows at a time, sorted (`?sort=`): newest or oldest request (each person's MINTER history), level or blocks minted (each account), name (each primary name), one read per person, 6 at a time, kept 10 minutes, or Core's order (by address) with no reads; each row's account, name and MINTER history otherwise only once it is shown, 6 at a time, kept 10 minutes |
| Ready to mint search | a typed address needs no read; a typed name, once typing pauses: `/names/search?query=…&prefix=true&limit=10`, plus `/names/{name}` only when that page is full without the exact name; cached per query |
| Decisions | `/transactions/pending?txGroupId=694` (also "your proposal is waiting" on Home and one's own page, from the same cached read) |
| A pending or decided invite cancellation's group and invitee (Core's JSON leaves them out) | `/transactions/signature/{sig}/raw`, decoded in `src/qortal/groupTxBytes.ts`, read once per transaction |
| Signatures and rejections | `/transactions/search?txType=GROUP_APPROVAL&confirmationStatus=CONFIRMED&startBlock=…&blockLimit=…` over the blocks the pending ones can have answers in, plus `/transactions/unconfirmed?txType=GROUP_APPROVAL`; joined on `pendingSignature` |
| A decision by its link | `/transactions/signature/{sig}`; while it waits, the Decisions reads above |
| Whose answers counted on a decided decision | the GROUP_APPROVAL search above over that decision's own blocks only, ending before its decision block (at most one window), kept 30 minutes |
| A nomination's rounds | the person's MINTER history (below), reduced to MINTER invites for them |
| Approved admin changes since the target this device saw (Decisions, only when the target changed) | `/transactions/search?txGroupId=694&txType=ADD_GROUP_ADMIN&txType=REMOVE_GROUP_ADMIN&confirmationStatus=CONFIRMED&startBlock=…&blockLimit=…&limit=100`, one search, cached 5 minutes (`src/data/targetChanges.ts`); it starts one window before the last-seen block and never reaches back more than 5 windows (about 6 weeks) |
| The target's past changes (History, Activity) | the cached admins read, the decided and later admin-change reads they already make, and admins' own leaves from MINTER |
| History by type (a decision type chosen) | one `/transactions/search?txGroupId=694&txType=<that type>&confirmationStatus=CONFIRMED&startBlock=…&blockLimit=…&reverse=true` (100 a page) from a signing window before the period's start, kept 5 minutes; for Removals and Declined requests, each kicked person's MINTER history, 20 kicks at a time and only as far as the list needs, kept for the session (`src/data/historySearch.ts`) |
| History over a period (All, joins, join requests, leaves) | the 30-day windows the period covers (the windows above), three at a time, never before MINTER's creation |
| What's new in History (Minter Admins only, the History tab's count) | one `/transactions/search?txGroupId=694&txType=<the approval-gated types>&confirmationStatus=CONFIRMED&startBlock=…&blockLimit=…` (100 a page) from a signing window before the height last seen, never more than History's first 30 days plus a window back; every 5 minutes while visible, nothing once History was seen up to the tip (`src/data/historyNews.ts`) |
| Since your last visit: how decisions that left the queue ended | `/transactions/signature/{sig}`, at most 12, once a session, only when there is an earlier visit; each final outcome kept for the session |
| Tip and block time | `/blocks/last`, `/blocks/byheight/{h}` (1,000 blocks back) |
| Accounts, names, fees | `/addresses/{a}`, `/names/primary/{a}`, `/names/{name}`, `/addresses/balance/{a}`, `/addresses/lastreference/{a}`, `/transactions/unitfee` |
| A person's MINTER history | `/transactions/search?address=…&txType=JOIN_GROUP&…&confirmationStatus=CONFIRMED`, reduced to group 694 |
| Avatars (and a link's app or website icon) | `/arbitrary/THUMBNAIL/{name}/qortal_avatar?async=true` as an `<img>` once it nears the screen, one per name however often it shows; after a 404 (Core answers that while it fetches the avatar), one `/arbitrary/resource/status/THUMBNAIL/{name}/qortal_avatar` per name: `NOT_PUBLISHED` keeps the letter for the session, anything else is tried again (`&retry=n`) at 2, 4, 8, 15 and 30 s, then each minute, 8 tries at most, paused while the tab is hidden (`src/data/avatars.ts`) |
| Records | `/arbitrary/resources/searchsimple?service=JSON&identifier=qmp-…&prefix=true`, bodies `/arbitrary/JSON/{name}/{identifier}` cached per version; a body that isn't on the node is tried again after 2, 4 and 8 minutes, then every 15 |
| Minter Admin polls (Minter Admins only, on Decisions or a poll's page) | four `searchsimple?service=DOCUMENT_PRIVATE&identifier=qmp-adminpoll-` (`-adminvote-`, `-admincomment-`, `-adminshare-`) `&prefix=true&reverse=true&after=<62 days ago>`, 100 a page, at most 3 pages; bodies only from current Minter Admins' names, `/arbitrary/DOCUMENT_PRIVATE/{name}/{identifier}?encoding=base64`, then `DECRYPT_DATA`; comment bodies only once a thread opens; public keys only when writing, `/addresses/publickey/{a}`, once a session |
| Considering | `searchsimple?service=JSON&identifier=qmp-considering-&prefix=true&reverse=true`, pages of 100, at most 3, one read shared by every card (cached 60 s, refreshed while visible). Bodies only for rows published within the last two signing windows, keyed by a decision still pending or by an address, under a current Minter Admin's name |
| Community votes | `searchsimple?service=JSON&identifier=qmp-vote-&prefix=true&reverse=true&after=<two signing windows ago, to the hour>`, 100 a page, at most 3 pages, one read shared by every card (cached 60 s, refreshed every minute while visible); no bodies. When that list is full, a card on screen searches its own nominee instead (`identifier=qmp-vote-<nominee>-&after=<the round's start>`, at most 3 pages). Each voter's name is looked up once to its owner (`/names/{name}`, cached) |
| Comment counts | `searchsimple?service=JSON&identifier=qmp-comment-&prefix=true&after=<45 days ago>` (100 a page, at most 3 pages), one search shared by every card, read again every 3 minutes while a count shows and the tab is visible, and by Refresh on Home, Decisions and Nominations; what an item's own search finds is added to it. An item that can be older, or a full list, searches `identifier=qmp-comment-<key>-` itself, only once its card is on screen |
| A thread, once opened | `identifier=qmp-comment-<key>-` and `identifier=qmp-hide-<key>-` searches, the bodies of the newest 20 comments (20 more per Show more) and the comments their replies answer, `/names/{name}` per author and per hide publisher; refreshed every minute while open |

The Decisions queue costs about 8 GETs, however many decisions there are (plus one raw read the first time a cancellation is seen, and the shared Considering and comment-count searches). Doubles need no read of their own (they use the admin rows the queue already has). It lists MINTER group changes (groupId 694) as decisions; other pending transactions that wait for MINTER's admins are shown apart, to Minter Admins only, as "Other transactions waiting for Minter Admins", without Sign.

### Explorer reads (all GET, read-only)

Keys start with `x` and are cached for the session; heavy reads (searches by address) go through the limiter (`data/explorer/heavy.ts`: two at a time, the open view first).

| Need | Endpoint |
|---|---|
| The account, never used or not | `/addresses/{a}` (Core's 404 code 124 means never used) |
| Every name it owns | `/names/address/{a}?limit=100&offset=…`, at most 5 pages; `/names/primary/{a}`; `/names/{name}` per name on screen (Core matches the reduced name) |
| Groups | `/groups/member/{a}` (also gives MINTER membership); `/groups/{id}` for a group's name, once each |
| Minting now, last block signed | `/addresses/online` (once, kept 5 minutes, never polled); `/blocks/signer/{a}?limit=1&reverse=true` (only with a public key) |
| First seen, where its first QORT came from | `/transactions/creator/{pk}?confirmationStatus=CONFIRMED&limit=1`, then `/transactions/signature/{its reference}` (skipped when that first transaction was a PUBLICIZE or ARBITRARY); fallback `/transactions/payments/between?recipientAddress={a}&limit=1` |
| Last sent a transaction | `/transactions/creator/{pk}?confirmationStatus=CONFIRMED&limit=1&reverse=true` |
| Links (heavy) | `/transactions/search?address={a}&txType=REWARD_SHARE&txType=TRANSFER_PRIVS&txType=BUY_NAME&txType=ACCOUNT_FLAGS&txType=ACCOUNT_LEVEL&confirmationStatus=CONFIRMED&limit=100&reverse=true`, pages until short, at most 5, then one TRANSFER_PRIVS-only search when capped; a level move's recipient from `/transactions/signature/{sig}/raw` (bytes 112–136) |
| Payments | `/transactions/payments/between?senderAddress=` and `?recipientAddress={a}` (PAYMENT only, fast, 100 a read, newest first); TRANSFER_ASSET and MULTI_PAYMENT by one heavy search, 100 newest |
| How busy a payer is | `/transactions/payments/between?senderAddress={x}&limit=1&offset=99` (then 499, 999): "has sent 100+ / 500+ / 1,000+ payments" |
| Transactions tab (heavy) | `/transactions/search?address={a}[&txType=…]&confirmationStatus=CONFIRMED&limit=100&offset=…&reverse=true`; waiting ones it sent: `/transactions/unconfirmed?creator={pk}` |
| Mintership tab | the app's own status, MINTER history, nominations and original-app reads (shared keys); records under every name: `searchsimple?service=JSON&identifier=qmp-…&prefix=true&name=…` (names in chunks of 40, rows kept only for exact names); answers on request: GROUP_APPROVAL by address joined to `/transactions/search?txGroupId=694&txType=<decision types>` pages; poll votes on request |
| Names tab | name history (one heavy search of the name types); QDN per name: `searchsimple?name={n}&limit=100&reverse=true` (one name per read, 4 at a time; the primary and 9 newest at once, the rest on request) |
| Sets | a sponsor's sponsees from its links, with the member list, `/addresses/online` and each visible row's account; checks across the set on request, 2 at a time, with Stop |
| Compare | each account's reads above, `/transactions/payments/between?senderAddress={a}&recipientAddress={b}` both ways per pair, `/crosschain/trades?sellerPublicKey={pk}&limit=100` |
| Transactions on Qortal | `/transactions/search?txType=…&startBlock=…&blockLimit=1000\|10000&confirmationStatus=CONFIRMED&limit=20&offset=…&reverse=true` (always a block range); waiting ones from `/transactions/unconfirmed?txType=…` |
| Core's sponsorship report | `/addresses/sponsorship/{a}`, on request only (1–5 s) |

Never read: `/chat/*`, `/transactions/address/{a}` (no limit by default), `/blocks/signers` (13 s), a type search without a block range.

### Device storage (localStorage, per browser)

Every key starts with `qmintershipplus-`. Nothing here is published; a later Settings sync could carry it across devices.

| Key | What |
|---|---|
| `ui-theme` | the theme |
| `motion`, `time-display`, `celebrate`, `activity-window`, `decisions-hide-signed`, `decisions-order` | Settings: animations, countdowns as time or blocks, the celebration, Activity's window, Hide already voted on (approved, rejected or voted; the key kept its old name, so a device's choice carries over), Decisions by type (the default) or most urgent first |
| `since-last-visit` | Home's "Since your last visit" on or off (default on) |
| `last-visit-<address>-<groupId>` | the last visit's snapshot `{ v: 1, at, height, decisions?: [{ signature, kind, subject, height }] (Minter Admins, ≤ 100), nomination?: { decision, state, signed, needed, supporters, publishedAt } \| null (accounts not in MINTER), made?: [{ nominee, decision, state, publishedAt }] (nominators, ≤ 20, added on night 3; older snapshots without it still read) }`, saved whenever the app has new data; the one from before the session is the baseline |
| `seen-target-<groupId>` | the target this device saw last, `{ adminCount, needed, height }`, for "The target changed" on Decisions |
| `history-seen-<address>` | how far this account's History list reached when last open, `{ v: 1, height }`, for a Minter Admin's count on the History tab; set to the tip the first time, so counting starts then |
| `muted-names` | names muted in comments, listed in Settings → Muted names with Unmute |
| `last-status:<address>` | the last status Home showed, so the welcome plays once |
| `explorer-recent` | the Explorer's recent explorations: addresses only, newest first, at most 8; written only while Settings → Explorer → "Remember accounts I explore on this device" is on |
| `explorer-remember` | that switch (on by default; turning it off also forgets the list) |

Hub alerts are not on the device: Hub keeps the rules for the account.

### Legacy reads (History, read-only)

The original app's data stays readable: nomination cards (`BLOG_POST` `Minter-board-card-*`), their polls (`<card>-poll`) and comments (`comment-<card>-*`), and AR cards (`QM-AR-card-*`). The admin board (`MAIL_PRIVATE` `card-MAC-*`) is encrypted to admins: History links to the original app for it. Old deep links (`#/minter/<card>/<section>`) open the card in History.

## Testnet (dev-only)

Every write is proven on a private, one-node Qortal testnet before anyone publishes the app. None of it is in the app's build. Keys and chain data live in `~/.qmp-testnet/` (mode 700, key files 600), never in the repo; nothing prints a key.

**What it is**

- **Core:** the 6.1.9 jar already on this machine (`~/qortal/qortal.jar`, `qortal-6.1.9-c68fc4a`), copied into the testnet home. It is a Reticulum test build whose Reticulum and wallet clients try to reach outside hosts; the network namespace below stops them.
- **Home:** `~/.qmp-testnet/`: the jar, `settings.json`, `testchain.json` (built from that jar's own `blockchain.json`: today's mainnet rules from block 1, a fresh genesis, 60-second blocks), the database, QDN data, logs, results, and `keys.json` with fresh keys.
- **Accounts:** a minter, a faucet and 108 test accounts made in the genesis block with levels (7, 5, 4, 2 and 0), plus fresh level-0 accounts the scenarios make and fund. 68 of them have registered names, some with spaces and `+`.
- **Groups:** five standard MINTER-like groups (`testnet/lib/groups.mjs`), made the way MINTER was: created closed with PCT40 and delays of 5 and 60 blocks, members invited and joined, admins added, then the owner handed to the null account by `UPDATE_GROUP` (the old owner stays an admin, as on MINTER). Scenarios that kick, ban or change admins make a fresh copy of their group for each run, so every scenario can run again; the bulk scenario makes its own.

| Key | Admin rows | Needed | Used for |
|---|---|---|---|
| main | 9 | 4 | nominations, signatures, joins, guards, Hub timeouts and declines, expiry, signing through the screens |
| ops | 6 | 3 | kicks, bans, lifting bans, admin changes, cancelling an approved invite |
| shift | 13 | 6 | the admin-count trap, on chain and in the app |
| reject | 7 | 3 | Reject, Withdraw, Considering |
| rules | 5 | 2 | who may propose admin changes, comments, links; doubles, declining a join request, Minter Admin polls (each on its own fresh copy) |
| bulk (its own) | 5 | 2 | bulk sign and Core's 25-unconfirmed limit |

**How it stays private** (in layers)

1. The node runs under `unshare -rn`: a Linux network namespace with nothing but loopback. It can't reach any peer, mainnet or otherwise. A Unix socket in the testnet home is the only way in.
2. Its settings: `isTestNet`, its own chain config and genesis, its own repository and data folders, ports 24391–24394 bound to 127.0.0.1, a fixed network of one address nobody listens on, Reticulum off, no archive, no auto-update. `GET /peers` shows 0 connected peers.
3. Every write the tools make (`/transactions/process`, QDN uploads) first checks that `GET /admin/info` says `"isTestNet": true`, and refuses otherwise. The tools have no TCP address for a node at all: only the socket.

**The test signer**

`testnet/lib/hub.mjs` answers `qortalRequest` the way Hub does: the same actions with the same payloads (`GET_USER_ACCOUNT`, `INVITE_TO_GROUP`, `KICK_FROM_GROUP`, `BAN_FROM_GROUP`, `CANCEL_GROUP_BAN`, `CANCEL_GROUP_INVITE`, `ADD_GROUP_ADMIN`, `REMOVE_GROUP_ADMIN`, `JOIN_GROUP`, `LEAVE_GROUP`, `SIGN_TRANSACTION` with Core's validity-checked decode first, `PUBLISH_QDN_RESOURCE` with the fee, encrypted to `publicKeys` when asked, `ENCRYPT_DATA` and `DECRYPT_DATA`, with Hub's own group encryption ported into `testnet/lib/encryption.mjs` using the dev-only packages `tweetnacl` and `ed2curve`), the same reference, fee and process steps, and Hub's error texts. On demand it behaves like Hub's worst moments: a decline, the 30-second timeout with a late accept, and the generic "Failed to decode transaction"; these are queued per account and group, so scenarios running side by side never take each other's. The signer and its controls take same-origin JSON on a loopback host only, so no other page open in the browser can drive them.

**The app in testnet mode**

`npm run dev:testnet` serves the app with `vite.testnet.config.ts`: the test signer as `qortalRequest` (each tab picks its account with `?as=admin01`), Core reads through a GET-only proxy to the testnet, and the group to treat as MINTER from `?group=main`. `__QMP_TESTNET__` is false in every build and test run, and the testnet config refuses to build: the production bundle was byte-for-byte unchanged by the switch, and `grep` finds none of the testnet names in `dist/` or the zip.

**Commands** (from `apps/Q-Mintership+`)

```bash
node testnet/testnet.mjs init     # fresh keys, chain config and settings in ~/.qmp-testnet (once)
node testnet/testnet.mjs start    # the node, isolated; adds its minting key
node testnet/setup.mjs            # names and the groups above (about 6 blocks)
npm run test:testnet              # every scenario; -- --only shift,ops   -- --list
npm run dev:testnet               # the app against the testnet: http://127.0.0.1:5176/?as=admin01&group=main
node testnet/testnet.mjs status   # height, peers, isTestNet
node testnet/testnet.mjs stop     # data and keys stay
```

Each run prints its block heights and outcomes and saves them in `~/.qmp-testnet/results/`. `npm test` never runs the scenarios: they take minutes of real 60-second blocks.

**A Core 6.1.9 quirk:** a brand-new chain can't start on its own. With no QDN resources yet, its "latest signatures" start-up step runs an empty database batch and stops the node before its API starts. `testnet/lib/PrimeChain.java` makes the database and the genesis block offline with Core's own classes and marks that step done; `start` runs it once.

## Dropped, and why (CLAUDE.md rule 6)

Agreed with Simon (2026-10-12):

| Feature of the original | Why |
|---|---|
| Forum (rooms, replies, attachments) | Not part of deciding mintership; Q-Chat and Q-Mail cover discussion, and every decision and nomination now has its own comments. Old forum links open Home. |
| Polls and voting on cards | Replaced by the process above: only Minter Admins' signatures decide on chain, and polls duplicated them. |
| The notification broadcast modal after every action | Friction after every vote, comment and approval; in-app state and "Since your last visit" replace it, with opt-in Hub alerts. |
| Stats snapshot publishing | The Activity page computes everything live from the chain. |
| The encrypted Admin Board discussion | Admin discussion moves to admins' own channels; old admin cards are linked to in the original app. |
| The account explorer modal | Becomes the person page (MINTER profile and actions) and the Explorer tab (everything an account did on Qortal, read-only). |

## Done

### Night 1 (2026-10-12): foundation, data, writes behind mocks, and the screens

_Done on the branch; Simon reviews in the morning._

- **Scaffold fixes:** the 8 failing tests (one a real bug: `searchsimple` dropped the offset, so paging returned page one again), the lint warning, the theme kit copy re-synced.
- **Stack and look:** React 19.3, MUI 9.4, the theme kit with four themes (Hub 2.0 = Q-Mintership Classic), a Hub 3.0 shell (rail; a bottom bar of five on phones; a compact rail in landscape), Back from the app's own history, a header that hides while scrolling on phones, the app sized to Hub's frame, Settings.
- **One module for every + specific:** `src/constants/plus.ts`.
- **Core rules, data layer, write layer:** as described above, with the mock MINTER world (`e2e/world.mjs`) that tests and the screenshot check share.
- **Finishing pass (2026-10-13):**
  - **Read store:** `invalidate()` notified with the same state object, so `useSyncExternalStore` skipped the render and mounted views kept pre-write data. Each invalidation now hands the key a new state and a version; views reload once per invalidation, a load that started before it can't mark the key fresh, and a failed reload doesn't loop. Home's re-render workaround is gone.
  - **Readable colours:** one helper (`src/utils/readable.ts`) gives any theme colour as text at 4.5:1 on every surface, keeping its hue; countdowns keep the urgency colour on the icon. Q-Mintership Classic's light accents are deeper shades of the original (teal `#186d64`, gold `#8b6016`, green `#27764b`, red `#b34444`), its fills pick black or white text at 4.5:1, and its buttons are bold sentence case like the original's.
  - **Accessible names:** decision rows are named by their visible text; avatar lists put list semantics on wrappers; chain-only nominees show their name.
  - **One of each:** one Accept / Join dialog (Home and Nominations), one countdown, one inline person, one avatar row; the same words for the same things (Minter Admin, signatures, admin seats, Join now).
  - **Behaviour:** countdowns show the blocks still to go when the time estimate runs out first; Settings → Motion → Full now overrides the system's reduced motion; Home welcomes a nominee who became a member ("Welcome to MINTER", with the small celebration, once); Back wherever a page isn't in the navigation on screen.
  - **Cleanup:** the scaffold's `src/qortal/constants.ts`, `cache.ts` and `util.ts` are gone; `usePersonStatus` and `useBalance` are shared hooks.
- **Review fixes (2026-10-13):** the 30 confirmed findings of the adversarial review, one commit each.
  - **Rules:** the Decisions queue lists only MINTER group changes (groupId 694); other pending transactions that wait for MINTER's admins are shown apart, to Minter Admins, without Sign, and the Sign guard refuses them. A pending cancellation names its invitee (from its raw bytes), and the same invite can't be proposed for cancellation twice. Activity's past ranges read the admin changes made after them. A timed ban says it counts from its proposal. "Applies in the next block" only when Core can apply it then.
  - **Writes:** after a Hub timeout, a cancellation is matched by its invitee, only among transactions made after the write started, never one an earlier write returned. A write dialog reopened quickly starts fresh.
  - **Efficiency:** one poll per key however many views watch it; members' and admins' status stops at membership, and a status refresh no longer forces the queue; range reads that move with the tip keep one store entry; nominations skip admins' levels and keep members' for 30 minutes.
  - **Phones and words:** the link a nominator sends opens a page with Accept / Join now; invite cards wait for the nominations before saying "without a nomination record"; `Q-Mintership%2B` deep links open; a failed name lookup is never "no such name"; signers' names show under 44 px avatars; the bottom bar steps aside for the keyboard and Nominate stays in view; Propose keeps the form after "Not now" or a cancel in Hub; never-members are told "join", not "rejoin"; a lifted ban isn't one that "ran out"; picking yourself on Nominate reads "That's your own account".
  - **Accessibility:** focus returns after a dialog even when its button is gone; write dialogs and bulk runs speak each stage and result through one live region; a Nominate that can't go yet says why and moves to the fix; scroll padding keeps focus clear of sticky bars; the level read is announced at quarters; a deadline's block and date are visible or spoken; Propose's Reason is marked required and Review says what's missing; a new page takes focus on its title and names the document.
- **Screenshot check** (`scripts/screens.mjs`, 26 screens × 5 sizes × 4 themes = 520 captures per mode, the page clock pinned to the mock world's time): dark and light both 0 console errors, 0 sideways overflow, 0 unlabelled buttons, 0 axe violations (rerun after the review fixes; the mock world now also has transactions that aren't MINTER group changes, a named pending cancellation and a third stale invite). The `small-text` counts that remain are the 12 px section titles and bottom-bar labels, badge counts and the avatars' decorative letters.
- **Tests:** 418 passed, 7 skipped (the node decode and live-node tests), in 46 files.

- **Night 1 by the numbers:**
  - 116 commits on the branch (one logical change each), built as a foundation (stack, kit, shell, data and write layers) and then five screens in parallel worktrees (Home, Nominations, Decisions, people and History, Activity), merged one at a time with build, lint and tests after each.
  - Tests: 418 passing (from 94 in the scaffold, 8 of them failing). Every write is a mocked Hub call; the test harness fails any POST to Core.
  - `npm run test:decode`: GROUP_APPROVAL bytes built by the app decode on a mainnet node (read-only endpoint) to the same fields.
  - `npm run test:live` (GET only, mainnet, 2026-10-13): PCT40, 629 members, 20 admin rows so 8 signatures needed, 91 join requests, the one pending decision (an add-admin at 5 of 8, expiring at block 2,760,156, as the research measured), real accounts resolving to their statuses, and 30 days of Minter Admin Activity, in 48 GETs.
  - Bundle: dist 1.5 MB (fonts included); biggest chunks `mui-core` 369 KB, `react-vendor` 322 KB, app entry 85 KB; every screen but Home loads on demand.
  - First load in the screenshot check (390×844, GETs including lazily loaded avatars; Hub requests): a learner's Home 7 GETs; a newcomer's 21; an admin's 36; Decisions 62; Activity 38; Nominations 38. The original app downloads every GROUP_APPROVAL since block 1,990,000 (about 13,400 rows, 7.9 MB) every 15 s while its board is open, and makes about 21 unlimited searches.
  - Review: 6 dimensions (Core rules, write safety, efficiency, phones and UX, accessibility, wording), 38 findings, each checked by a second reviewer trying to refute it: 37 confirmed and fixed, 1 refuted.

### Simon's answers built (2026-10-13)

Three branches built side by side, merged one at a time with every check after each.

- **Proposals with the proposer's signature:** Propose → kick, ban, admin change, lifting a ban or cancelling an approved invite is one guided step of two Hub confirmations (propose it, sign it), both fees stated and checked against the confirmed balance first. If the proposal goes through and the signature doesn't, the dialog says so plainly, and the proposal can be signed from the queue.
- **Cancel an approved invite** is in Propose: pick one of the invites nobody used, the same chain checks as the write (one already waiting for signatures can't be proposed again), then the two steps.
- **Show you're ready to mint** on Home, for newcomers and former members who left or were kicked: the self-check, then the join request. Home then says they've shown they're ready, that it can't be withdrawn and what happens next; the welcome plays once a nomination makes them a member. How it works says nominators reach out and that being ready counts as accepting. The "find a nominator" help is replaced.
- **Nominations → Ready to mint:** everyone who asked to join, less members and bans in force, 20 at a time in Core's order, with Nominate or Add your support for level 5+ members and Minter Admins, and what you already did ("You nominated them").
- **Tests:** 462 passed, 7 skipped, in 49 files (two clean runs after each merge). The page tests now have 15 s each, as some passed vitest's 5 s on a busy machine.
- **Screenshot check:** 32 screens × 5 sizes × 4 themes = 640 captures per mode, dark and light: 0 console errors, 0 sideways overflow, 0 unlabelled buttons, 0 axe violations. New screens: `home-ready` (the mock world's Rae Ready has a join request), `home-ready-dialog`, `nominations-ready` and `nominations-ready-admin`, `decisions-propose` (the menu or the phone sheet) and `decisions-cancel-invite` (up to the two Hub steps). First load at 390×844: a ready newcomer's Home 21 GETs; Ready to mint 44.

### Night 2 (2026-10-13): every write on a private testnet, and Simon's additions

_Done on the branch; Simon reviews in the morning._ Six branches built side by side in their own worktrees (the admin-count safeguards, Reject/Withdraw/Considering, admin rules and links, comments, Simon's answers and wording, notifications), merged one at a time with build, lint and tests after each; then the accessibility pass and the review, each on its own branch.

**Every write on the testnet** (`npm run test:testnet`; 60-second blocks; h is the block a decision was confirmed in; every outcome is Core's own, read back from the node):

| Proven | Scenario | Blocks | Outcome |
|---|---|---|---|
| Propose nomination → Accept → first signature, signing the invite while it was still unconfirmed → signatures → member at once | `nominate-join` | join request 16; invite and its first approval both in 17; approved at 23 (h+6) | 9 admin rows, 4 needed, the same in the app and Core. The app's window: earliest 23, last useful signature 76, expiry 78. A member at once; the join request used up. |
| Approved without a join request, then Join now | `join-now` | invite 22; approved 28; Join now 29 | Home said "approved, Join now"; a member in block 29; joining again refused before Hub ("You're already in MINTER.") |
| Show you're ready to mint, then a nomination and a support, approved | `ready` | join request 22; invite 23; approved 29 | A second join request refused before Hub; listed in Ready to mint; a member at once |
| Expiry, the too-late guard, Propose nomination again | `expiry` | invite 19; the app's window: earliest 25, last useful 78, expiry 80; Core expired it at 80 (h+max+1) | A late signature refused before Hub; the nomination shown as expired; a new record and a new invite after it |
| Hub's worst moments | `hub-behaviours` | 20–24 | A decline is a cancel and sends nothing; "Failed to decode transaction" is reported and sends nothing; after the 30 s timeout the lookup found the late transaction at 50 s, signing again was refused, and there is exactly one signature; a proposal whose signature step was declined waits, and was signed from the queue |
| Sign several, 26 decisions | `bulk` | 21–26 | 25 sent; the 26th stopped before Hub with Core's 25-unconfirmed limit in plain words |
| Kick, permanent and one-day bans, lift, add and remove admin, the remove-admin-first path, cancel an approved invite | `ops` | proposals 21, each approved at 27; lift, cancellation and add admin approved at 34; remove admin 41; the kick after it 48 | 6 admin rows, 3 needed. Each proposal is two Hub steps. A duplicate proposal, a second signature from the same admin, inviting a banned account or a member, and kicking an admin are each refused before Hub; the kick went through once the admin role was removed |
| The admin-count trap, on chain | `shift` | D1 (a kick) 19, R (an admin removal) 20, D2 (a kick) 21, all at 5 of 6; R's 6th signature at 29; R approved at 30 | Admin rows 13 → 12, so 5 needed: D2 (confirmed after R) approved in the same block, 30; D1 (confirmed before R) in the next, 31; no new signatures on either |
| The safeguards, in the app | `shift-app` | D1 confirmed 141; R approved 148 | Before: D1 carries "Target may drop to 5", R's card says the target would drop from 6 to 5, and Continue to Hub waits for "I've checked these". A withdrawal on D1 (4 signatures, 1 rejection) defuses it: D1 stays PENDING at 4 of 5 after R. After: the returning device reads "The target changed from 6 to 5 signatures", and why |
| Reject, Withdraw, Considering, rejections reaching the target, a tie | `reject` | D 114, approved at 120; E 121, REJECTED at 127 (h+6); F 128, approved at 134 | 7 admin rows, 3 needed. On D, signatures/rejections went 2/1 → 1/2 (Withdraw) → 2/1 (signed again); a second Reject and a Withdraw without a signature refused before Hub. Considering shown with its note, cleared, then superseded by the same admin's signature. E: three rejections end it as REJECTED, and the nomination reads as rejected. F: 3 signatures and 3 rejections, approved (signatures win a tie) |
| Who may propose admin changes, comments, links | `rules` | Become a Minter Admin approved 119; an admin's proposal of another member 126; Step down 133 | Become is one Hub step, with the statement posted as its first comment; admin rows 5 → 6 → 7 → 6. A member proposing someone else, a member proposing to remove an admin, and removing the owner account are refused before Hub. A thread of 5 comments (a reply, an edit, a deletion) and 1 hide by a Minter Admin. A decided decision, an old `?d=` link and a nomination open on their own pages, with no console errors |
| Sign through the screens on real blocks | `ui-sign` | approved at 121 | See "Optimistic states and animations" below |

- **What went wrong first, honestly:** `ui-sign` and `reject` first "passed with notes", each from a mistake in the scenario's own check, not in the app. The reduced-motion check counted animations the app already cuts to 0.01 ms (it now counts real ones), and the rejected-state check read a cached queue (it now reads fresh; a separate check at block 131 read the nomination as rejected). Both were fixed and rerun clean. The first `shift-app` attempts failed on two scenario mistakes: they opened Sign as the proposer, who had already signed, and reloaded a page that had already recorded the new target, so its banner had nothing new to say. Both were fixed, and a fresh run passed (blocks 136–150).
- **Full run:** `npm run test:testnet`, all 12 scenarios at once on the final code, on blocks 307–370 (68 minutes, set by expiry's 62 blocks): **12 of 12 passed**, 222 checks, none failed. Every scenario that changes a group ran on its own fresh copy. It reproduced the admin-count trap the same way: the admin removal and the decision confirmed after it applied in block 333, the one confirmed before it in 334. "(confirming…)" settled 76 s after Sign, and nothing animated with reduced motion.
- `npm run test:decode` now decodes a rejection too: approval and rejection bytes decode on a mainnet node's read-only endpoint to the same fields. `npm run test:live` (6 tests, GET only) passes.

**The admin-count safeguards:** as described under The new process.

- The projection rules (`src/rules/targetShift.ts`) are pure, with tests of every threshold from NONE to PCT100 against a reference formula, the real case where 21 admin rows became 17 and 9 needed became 7, ties, rejections, rises, duplicates, the owner, cascades and combinations.
- The impact panel with "I've checked these" on the admin change's card, Sign, Propose, Sign several and Step down; the "Target may drop to …" chip; "Admin changes and the target" above the queue; "The target changed from 10 to 9 signatures" on Decisions, kept per device; the target's changes in History and Activity; two new points in How signing works.

**Reject, Withdraw and Considering (B2):**

- Reject sits next to Sign; Withdraw my signature replaces Sign once the signature is in a block, and stays while a withdrawal can still count, also on a decision with enough signatures that Core applies two or more blocks from now. Each opens a dialog first that says what it does on chain, the target, that signatures are counted first, that it cancels nobody else's signature, the fee, and what to check in Hub (`"approval": false` and the start of the pendingSignature).
- Cards show who rejected, how many of them withdrew a signature, rejections on their way, and "Rejections: r of the 8 that would end it (signatures are counted first)". "Enough rejections" is a decision state, with when Core ends it; Sign stays on a just-proposed one, since signatures that land before its first decision block still win.
- Nomination cards and the nominee's Home show the rejections so far; once enough have rejected, the nominee is no longer offered Accept or told they're in when the admins approve. History says a rejected nomination can come again; Activity counts a rejection as an answer, never a miss, and its pulse lists rejected invites.
- Considering on decisions and on nominations waiting for a first signature, with an optional note (up to 280 characters): "Considering: A ("note"), B" next to the signers, and "N Minter Admins are considering" on nomination cards, person pages and the nominee's Home.

**Admin roles, links and comments (B3):**

- Become a Minter Admin and Step down as Minter Admin on one's own Home and person page, with the rules above; the statement is optional, up to 500 characters, posted as the proposal's first comment (one more Hub step).
- A page for every decision (waiting or decided) and every nomination (with its rounds), Copy link on every card and page header, old `?d=` links redirected, paths reported to Hub. A decision decided while its page is open says how it ended and keeps focus and any open dialog. A decided decision lists only the answers Core counted (those in a block before its decision block).
- Comments on every decision card, nomination card and person page, open on the decision's and the nomination's own page: posting, replying, editing and deleting each one Hub step, shown at once; mute per device; hide for everyone by Minter Admins. With comments closed a page costs one shared count search; opening a thread on a person page in the mock world cost 20 GETs (2 searches, 10 small bodies, 8 names), and the thread's code loads on demand.

**Simon's answers and wording (B4, C):** the eight open questions of 2026-10-13, each answered and built (see Follow-ups). "Propose nomination" replaces "Nominate someone" everywhere, from one constant.

**Optimistic states and animations on real blocks (D):** measured by `ui-sign` on the testnet's 60-second blocks.

- "Signed ✓ (confirming…)" showed 1 s after the click (Hub answered in 1 s).
- It settled 120 s after the click with the old once-a-minute refresh. Since then the live views refresh every 15 s while a write waits for its block, and it settled in 76 s, one block later. After the review, the faster refresh also ends once the transaction is in a block, and the views reload once then.
- The ring moved from 1 of 4 to 2 of 4 as the signature landed; the celebration for the new member had 24 pieces; with reduced motion, 0 real animations (the app cuts every one to 0.01 ms). No console errors on the Decisions page.

**Notifications (E):** "Since your last visit" on Home and opt-in Hub alerts, as described above. On a first visit the panel shows nothing and reads nothing extra; after an earlier visit an admin's costs at most 12 extra GETs per session (3 in the mock world). The Decisions item in the navigation already shows the number of decisions waiting for your signature, so no second badge was added.

- **Hub's alert API** (read-only, the Qortal GO checkout of Qortal-Hub, branch `feature/hub-3.0.3-go`):
  - `NOTIFICATION_PERMISSION` (`src/qortal/qortal-requests.ts:618` → `src/qortal/get.ts:665`; Hub asks "Allow this app to send you GO notifications?" at `get.ts:698`), `NOTIFICATION_HAS_PERMISSION` (`qortal-requests.ts:647`), `NOTIFICATION_ADD` (`qortal-requests.ts:2048` → `get.ts:5723`; it needs the permission first, `get.ts:5734`, forces every rule to `event: 'RESOURCE_PUBLISHED'`, `get.ts:5770`, and accepts only the filter keys at `get.ts:5667`), `NOTIFICATION_GET` (`qortal-requests.ts:2077` → `get.ts:6090`), `NOTIFICATION_MARK_SEEN` (`qortal-requests.ts:2106`) and `NOTIFICATION_REMOVE` (`qortal-requests.ts:2132` → `get.ts:5829`). All are allowed from Q-Apps (`src/hooks/useQortalMessageListener.tsx:274–279` and `:360–365`); `SHOW_ACTIONS` returns that list (`qortal-requests.ts:2023`).
  - **`SET_TAB_NOTIFICATIONS` is not implemented:** the only mention is a comment at `qortal-requests.ts:572`.
  - **Only QDN publishes can alert:** Core's notifications socket sends only RESOURCE_PUBLISHED (`ArbitraryTransaction.java:542`, `:551`) and PAYMENT_RECEIVED (`PaymentTransaction.java:98–99`); Hub turns a matching RESOURCE_PUBLISHED into an OS alert that opens the app (`src/components/Group/WebsocketNotifications.tsx:1111–1145`). Signatures, approvals, expiry and membership changes can't trigger one.
  - **No name, no alerts:** Hub starts its alert listener only for accounts with a registered name (`WebsocketNotifications.tsx:867`); Settings says so.
  - **Alerts can't pile up:** Hub skips records published by your own names (`:1113`) and keeps one alert per identifier for 3 days (`:1119`); Core sends a resource at most once per 5 minutes per connection (`NotificationManager.java:47`).

**Accessibility (F):** keyboard and screen-reader pass of every write dialog and the new panels.

- **How it was checked:** every write dialog opened from its button with Enter in the test harness (Testing Library, jsdom, axe-core): focus goes in and stays in under Tab and Shift+Tab, every control has a name, axe finds nothing, and Escape puts focus back (`src/test/writeDialogs.a11y.test.tsx`, 23 tests). Then in Chromium: visible focus at every Tab stop of Decisions, Home and Settings and inside the dialogs and the Propose menu, in all four themes; tap targets at 390 px; the heading outline of every screen (one h1, no level skipped).
- **Focus never falls to the page:** Propose's form and Hub step give focus back to Propose; while a write runs, focus waits on the dialog's title, so the first stage is heard; a dialog whose button is gone or disabled hands focus to its card; Propose nomination's focus follows the pick, the result and the links; comments' Edit, Reply, Cancel and Show more keep focus where it belongs; Got it, Mark as seen and "Show the ones I signed" keep focus on the page.
- **Heard once, never twice, never missed:** Sign several and cancel-all read each new stage once; the "target changed" note is a region with its own heading, said once; Propose's check on the person picked and Propose nomination's candidate check are read out; Ready to mint's search says "None of N match"; Copy link says "Link copied" once.
- **Names, structure and touch:** buttons repeated on every card say whose card they are on; Decisions' summary and How signing works are h2; a person's chip is a 44 px tap target; Settings' switches turn with a tap anywhere on their row; the Become a Minter Admin statement shows how much is left.
- **Screenshot check** (on the accessibility branch's last commit, and again on the branch tip after the review fixes): 49 screens × 5 sizes × 4 themes = 980 captures per mode, dark and light both 0 console errors, 0 sideways overflow, 0 unlabelled buttons, 0 axe violations, 0 small button targets. The small text that remains is the avatars' decorative letters, the 12 px section titles, bottom-bar labels and badge counts, the signature ring's "of 8", 12 px captions on Activity's tiles and Home's stale-invite tile, and the kit's 12 px field helper text.

**Review:** tonight's diff in 6 dimensions (Core rules, write safety, efficiency, phones and UX, accessibility, wording): 37 findings, each checked by a second reviewer trying to refute it; 34 confirmed and fixed (33 commits, as two shared a cause), 3 refuted.

- **Core rules (6, all fixed):** an admin change's impact is worked out at the lowest and highest reachable counts, so a removal that triggers a waiting addition no longer shows "no impact"; Withdraw stays offered while it can still count, and the withdraw advice appears only where it can, with the block it must be in; a decided page counts only answers in a block before its decision block; Sign stays on a just-proposed decision with enough rejections; History and Activity count admins who left MINTER themselves; a waiting addition only counts as a new seat for someone still in MINTER.
- **Write safety (2 of 3):** Step down on Home and the person page shows the impact panel and needs "I've checked these", as Propose does; the test signer takes same-origin JSON on a loopback host only. Refuted: a cancelled publish reported as sent (the only publish the app sends rejects on a cancel in Hub, and the runner reads that as declined).
- **Efficiency (5 of 7):** Considering re-reads only who is considering; the faster refresh ends once the write is in a block; Home's first paint no longer loads the write code; a QDN body that isn't on the node is retried after 2, 4 and 8 minutes, then every 15, not on every refresh; Since your last visit reads each decided outcome once a session. Refuted: an N+1 on comment authors (the same cached read the author's chip already makes) and an unbounded Considering search (it is bounded at 3 pages, and a time filter would drop records republished in a new round).
- **Phones and UX (11, all fixed):** a Considering note no longer shows up pre-filled on the next decision; a decision's own page offers Considering; the nominee's Home stops offering Accept once enough have rejected; no "left to sign" countdown next to "ends as rejected"; Reject, Withdraw and Since your last visit name own admin changes as their cards do; the Considering dialog mentions a nominee only where there is one; Rounds mention rejection; the stale-alerts hint fits the role; "latest answer" everywhere; the withdraw line only for an admin who signed.
- **Accessibility (10, all fixed):** the focus and announcement fixes listed above for comments, the target-changed banner, a decision decided while open, Ready to mint's search, the Hub alerts switch and Copy link.
- **Wording:** no findings.

**Tests and checks:**

- **Tests:** 960 passed, 8 skipped (the node decode and live-node tests), in 87 files (85 + 2 skipped), from 462 at the end of night 1. `npm run build`, `npm run lint` and `scripts/sync-theme.sh --check` pass.
- **Bundle:** dist 1.6 MB (426 KB of fonts included); biggest chunks `mui-core` 374 KB (116 KB gzip), `react-vendor` 322 KB (102 KB), app entry 103 KB (31 KB), Decisions 51 KB; the comment thread (17 KB), the Considering dialog (18 KB) and every write dialog load on demand. The production build is byte-identical to before the testnet switch was added, and contains none of the testnet names.
- **First load in the screenshot check** (390×844, GETs including lazily loaded avatars): a learner's Home 8 (was 7: "your proposal is waiting" reads the pending list); a newcomer's 21; an admin's 44 (was 36); Decisions 69 (was 62); Activity 38; Nominations 46 (was 38); Ready to mint 57 for 9 rows (was 44: one history read per row); a waiting decision's page 32 and a decided one's 21 (comments open); a nomination's page 46; an admin's Home with Since your last visit 55.

**Night 2 by the numbers:**

- 122 commits on the branch since night 1 (one logical change each) and 8 merges: the testnet and its scenarios, six feature branches, the accessibility pass (22 commits) and the review fixes.
- 12 testnet scenarios, every write proven with Core's own outcome and block heights; no transaction on mainnet, 0 QORT spent.
- Tests: 960 passing (from 462). Screenshot check: 49 screens, 980 captures per mode, 0 findings.
- Review: 37 findings, 34 confirmed and fixed, 3 refuted.

### Night 3 (2026-10-13 to 14): doubles, Simon's answers, Decline a join request, Minter Admin polls, motion, Hub and a real phone

_Done on the branch; Simon reviews in the morning._ Four branches were built side by side in their own worktrees (doubles with answers 5 and 6; Home and admin roles; links and look; Activity and alerts) and merged one at a time with build, lint and tests after each. Then came the review's fixes (four branches, Decline a join request among them; the last two merges were checked together), and the motion and Minter Admin polls branches, each with its own review and fixes before it was merged. Polls went into 1.0.0 only after passing everything, as Simon asked.

**Doubles:** as described under The new process. The real case on mainnet (a member's second "Become a Minter Admin", 5 of 8, running out at block 2,760,156) reads as a double in Hub and in GO.

**Simon's answers to the night 2 questions, built:**
- 3: an admin's Home says when the target changed since Decisions last showed it, with "See what changed"; only Decisions writes the seen target.
- 4: Activity counts any answer as taking part; Missed stays the decisions that expired with no answer, and an expired double is never a miss.
- 5: rejected decisions stay out of every waiting list; "Hide what I answered".
- 6: Reconsidering after a rejection, shown until the admin's next answer.
- 7: the nominee's Home, own card and nomination page say rejections gently, with the same numbers.
- 8: Become a Minter Admin is suggested from level 5, with a note below it (not a block).
- 9: Step down only on the admin's own page; picking yourself in Remove a Minter Admin says where it is.
- 10: the link a nominator copies opens `/nominations/<address>`.
- 11: History's decided changes have "Open the decision".
- 12: Settings → Muted names, with Unmute.
- 17: the floating Propose nomination button is a round icon on phones, keeping its name.
- 21: a former member whose ban ended or was lifted says so ("banned, ban ended on …", "ban lifted on …").
- 25: nominators' Since your last visit items for the nominations they made, and an opt-in Hub alert rule for support on them.
- 27: names inside sentences are always underlined.
- 28: the ring's "of 8" is 14 px on 56 px rings (16 px on 64 px).

**Decline a join request** (Simon, during the night): as described under Ready to mint. On the testnet (`decline`, blocks 557–571): a fresh account's join request, Ready to mint listing it, an admin's decline proposal with their own signature, the guard refusing a second decline, a non-requester and a member, Core approving it at 570, the join request gone from Core and from Ready to mint, the account never marked a former member, and a new join request accepted after it.

**Minter Admin polls** (Simon, during the night): as described under The new process. On the testnet (`admin-polls`, blocks 705–722, 41 checks): one Hub step per poll and vote, encrypted; 1/1/1, then 2/1/1 after a share for an admin added since; a member locked out; comments; a vote refused after the end.

**Motion** (Simon, during the night): refresh icons turn while they read and come to rest on a whole turn; pages, sections and a list's first rows fade in as they arrive (once, not on every refresh); the navigation highlight glides; buttons give a little when pressed; ticks and answer chips pop in when an answer is given; dialogs ease in; Show and Hide chevrons turn over; one 200 ms timing for entrances. CSS only (opacity, translate, scale), no new library. Settings → Motion → Reduce, or the system's reduced motion, turns it all off, delays included.

**Every new write on the testnet** (60-second blocks; Core's own outcomes, read back):

| Scenario | Blocks | Outcome |
|---|---|---|
| `doubles` | 468–490 | A2 (the same addition sent again, as another app would) marked the double of A1; A1 approved at 479; A2 then "already a Minter Admin", signed anyway and approved at 481 with the admin rows unchanged; a duplicate removal R2 marked, R1 approved at 488, R2 then "nothing to remove", the app refused to sign it, rejected at 490. 26 checks |
| `rules`, `reject`, `shift-app`, `ui-sign` (touched tonight) | 491–517 | 4 of 4 passed, 87 checks |
| `decline` | 557–571 | see above, 24 checks |
| `admin-polls` | 705–722 | see above, 41 checks |
| **Full run**, all 15 scenarios at once on the final code | 722–785 | **15 of 15 passed**, 313 checks, none failed (63 minutes, set by expiry's 62 blocks). It reproduced the admin-count trap the same way: the admin removal and the decision confirmed after it applied in block 761, the one confirmed before it in 762. |

**Hub Dev Mode check (read-only, with real data).**

**How it was driven.** A second Hub (Simon's GO 3.0 build, `--remote-debugging-port=9223`) signed in to Simon's own account, a Minter Admin, with Dev Mode → Server → 127.0.0.1:5174 (the Vite dev server, through the node's dev proxy at 127.0.0.1:12393) on the local Core 6.1.9, mainnet. It was driven with `scripts/hub-cdp.mjs` (`size`, `requests`, `calls`) and small scratchpad helpers: the app's own router for navigation (never a click or a tap in the app), the DOM and resource timings for measurements, JPEG captures of the Hub window. **Nothing was signed, published or sent, and no QORT was spent**: no write button and no write dialog was opened, and no Hub dialog appeared. The only requests the app sent were `GET_USER_ACCOUNT` (Hub already trusted the dev app, so it asked nothing), `QDN_RESOURCE_DISPLAYED`, and on Settings `SHOW_ACTIONS` and `NOTIFICATION_GET`.

**Real data used:** the one MINTER decision waiting on mainnet (a member's second "Become a Minter Admin", 5 of 8, running out at block 2,760,156: a real double, and Simon has signed it), a nomination with past rounds, Simon's own page, a person with old cards from the original app, a banned former member, the 91 join requests on Ready to mint, History and Activity's 30-day window.

**Screens and sizes:** Home (as a Minter Admin), Decisions, the double's own page, Nominations, Ready to mint, a nomination's page, three person pages, History, Activity and Settings, at 1440, 700, 390×844 touch, 360×740 touch and 844×390 touch (60 captures): **0 sideways overflow, 0 console errors, 0 unlabelled controls** at every size. What the sweep flagged and is as intended: names inside sentences are links about 21 px tall (inline text, which the target-size rule exempts), search fields are 40 px tall, the compact landscape filter chips are 40 px, and the avatars' decorative letters are 8 px.

**Themes:** Hub's own Light/Dark switch: the app followed it without a reload (`THEME_CHANGED`), both ways. The four themes (Hub 3.0, Q-Mintership Classic, Black, White) on Decisions and Settings in Hub dark and light.

**The double, live:** the card reads "Double" (screen readers: "Double: changes nothing"), "<Name> is already a Minter Admin, from an earlier proposal. As things stand, if this one passes, nothing changes, so there's no need to sign it. It runs out by itself at block 2,760,156 (about 15 Oct 2026, 03:00).", with "The earlier proposal" linking to the approved addition once that person's history was in the session's cache. The impact panel stays quiet.

**Requests per screen** (390×844, signed in as a Minter Admin; Home cold, then each screen right after Home; Core GETs / Hub requests):

| Screen | Before night 3's fixes | After |
|---|---|---|
| Home, first load | 24 GETs / `GET_USER_ACCOUNT`, `QDN_RESOURCE_DISPLAYED` ×2 | 24 / same |
| Decisions | 10 / 1 | 10 / 1 |
| A waiting decision's page | 14 / 1 | 13 / 1 |
| Nominations | 0 / 1 (read with Home) | 0 / 1 |
| Ready to mint (91 join requests, 20 rows shown) | **60** / 1 | **12** / 1 (rows read once they come near the screen) |
| A nomination's page | 10 / 1 | 10 / 1 |
| A person page with old cards | 55 / 1 (the newest 40 old cards are scanned once the section is near the screen) | 55 / 1 on a short page |
| History | 38 / 1 | 38 / 1 |
| Activity (30 days) | 7 / 1 | 7 / 1 |
| Settings | 1 / `SHOW_ACTIONS`, `NOTIFICATION_GET` | same |

No request used `limit=0`.

**The original app side by side** (`qortal://APP/Q-Mintership`, v3.0.7 on QDN, in another Hub tab; read-only):
- Its landing page: 3 GETs (one `limit=0`: `/groups/members/694?onlyAdmins=true&limit=0`), 3.3 MB, and on every load it sends `GET_USER_ACCOUNT`, `GET_ACCOUNT_NAMES`, `SHOW_ACTIONS`, `NOTIFICATION_PERMISSION`, `NOTIFICATION_REMOVE` and `NOTIFICATION_ADD`.
- Its Minter Board: 20 GETs, 6 of them `limit=0` (among them the whole member list in one call), 4 `FETCH_QDN_RESOURCE`; it shows "0 displayed".
- Its MAM board: **483 GETs in 40 s, 89 with `limit=0`, 11.8 MB**, 125 `FETCH_QDN_RESOURCE`, and 46 reads of the pending list.
- The same data: it lists the same waiting proposal with "Existing ADD_GROUP_ADMIN Approvals: 5" by the same five Minter Admins, and offers "Approve Add-Admin Tx" without saying that it changes nothing.

**Hub's own Copy link:** a Dev Mode server tab has no app identity, so Hub hides its Copy link there (checked: the button is hidden). What the app reports is right: `QDN_RESOURCE_DISPLAYED` with `/decisions/<signature>`, `/nominations/<address>` and `/people/<address>` as each page opens; Hub keeps only that path and adds the tab's own app name, so in the published app Hub's link is `qortal://APP/Q-Mintership+/decisions/<signature>`. To confirm on the published app.

**Alerts (night 2 question 22), answered:** this Hub answers `SHOW_ACTIONS` with 104 actions, among them all six `NOTIFICATION_*` (`NOTIFICATION_ADD`, `_GET`, `_HAS_PERMISSION`, `_MARK_SEEN`, `_PERMISSION`, `_REMOVE`), and still no `GROUP_APPROVAL`. The desktop Hub people install has them too: they are in Qortal Hub's own releases since v2.0.1 (2026-06-14) through v3.0.3 (2026-08-23, `Qortal/Qortal-Hub` master) and develop, in `SHOW_ACTIONS`' list. Only `SHOW_ACTIONS` was sent tonight.

**Hub & GO pitfalls** (docs/QORTAL.md): theme switch ✓ (above); sticky headers and frame height ✓ (header and bottom bar held at every size, a compact rail in 844×390); bottom sheets mount on open ✓; avatars load in view ✓; overlaps: the floating Propose nomination button is a round icon on phones and clear of the list's end ✓; deep links with `+` ✓ (the app writes `Q-Mintership+`); Back uses the app's own history ✓; unusual names: names with spaces and with Greek letters load their avatars and pages ✓; declines and timeouts: unchanged since night 2 (pinned by tests, proven on the testnet); public nodes: the app reads nothing list-based; resources not on the node: retried at 2, 4 and 8 minutes, then every 15 ✓.

**Found and fixed:** Ready to mint read every row on its page at once (60 GETs for 20 rows): rows are now read once they come near the screen, and a person's old cards once their section does (12 GETs). The fixes were checked again in Hub: the double's new note, Ready to mint's Decline for a Minter Admin (not pressed), and the Minter Admin polls section (no polls on mainnet yet: an empty section and 4 searches more on Decisions, 15 GETs instead of 10, and no decrypting).

**Still needs a phone (GO), after publishing:** landscape on a real phone; the keyboard over Become's statement, comments and Propose nomination's reason; safe areas on a phone with a notch; Hub alerts' OS notifications; the published app on GO's default public node (Dev Mode used the ThinkPad's node); Hub's own Copy link on the published app.

**GO on a real phone** (night 3, after Simon set it up): Simon's phone (Android 16, System WebView 153) with GO on the ThinkPad's node through the USB cable (`adb reverse` of 12391 and 12393), GO's Dev Mode → Zip with `release/Q-Mintership+.zip` copied to the phone's Downloads (a preview on the node, not a publish), signed in to Simon's account. Driven over GO's WebView DevTools socket (read-only: the app's own navigation, measurements) and a few `adb` taps on GO's own buttons, the file picker and the search field. Nothing was signed, published or sent.
- The app ran at `/render/hash/<hash>/…` (Core's preview path) with real data: Home as a Minter Admin, Decisions with the real double and its note, Nominations, Ready to mint.
- **GO's own bars:** GO hides its top and bottom bars while the app scrolls: the app's frame grew from 717 to 832 px tall (top 93 → 38) and back. The app followed both ways: its header hid with GO's, its bottom bar stayed flush at the frame's new bottom, nothing jumped or left a gap.
- **Found and fixed:** a new page kept the previous page's scroll (Decisions opened at 300 px down after Home): a new page now opens at its top, and Back keeps where you were (checked on the phone: Decisions at 0 after Home at 400; Back to Home at 400).
- **Found and fixed:** with the keyboard up, GO shrank the frame to 505 px, just over the app's "under 500 px means the keyboard" rule, so the bottom bar and the round Propose nomination button stayed on screen above the keyboard. The keyboard is now detected as a text field with focus in a frame well under its tallest at that width; checked on the phone: frame 717 → 450 px, the bar and the button stepped aside.
- **Found and fixed:** Home's activity tile read "0 of 0 Open decisions you've signed" when the only open decision was a double; it now says "None, Open decisions right now".

**Review:** tonight's diff in six dimensions (Core rules, write safety, efficiency, phones and UX, accessibility, private wording): 28 findings, each checked by a second reviewer trying to refute it; 23 confirmed (16 distinct problems, all fixed, one commit each), 5 refuted.
- Core rules: a repeated admin addition now shows its target impact and asks for "I've checked these" (either copy can pass first); an expired double is never a miss; History and Activity's pulse don't count an approved addition of an existing Minter Admin as a seat; the projection keeps doubles that change nothing in scenarios that remove their subject; a timed ban that ran out before its lift reads as ended.
- Write safety and efficiency: a nominator's Hub alerts stay on when their open nominations close; Ready to mint retries a failed row once per refresh; the in-view look-ahead works inside Hub's frame.
- Phones, UX and accessibility: Since your last visit never says a double is waiting for you; the nominee's own nomination page says rejections gently; "And N more" opens Nominations; a double's note gives advice only to Minter Admins; "The earlier proposal about <name>"; focus after Sign or Reject with "Hide what I answered" on; Hub alerts say when a nominator's nominations can't be read, with Try again.
- Wording: no findings.
- The motion branch's own review: 6 findings, all fixed (rows fading in again on re-sort, no cap on staggered children, header icons turning for background polls, Home's Refresh ignoring presses, chips popping on every mount, two timings). The polls branch's own review: 9 findings, all fixed (a share's copy could stand in for votes the reader could read themselves; a failed decrypt was cached as locked for the session; device time decided the end; voters beyond the 10th were hidden; and five smaller ones).

**Tests and checks:**
- Tests: 1359 passed, 8 skipped (the node decode and live-node tests), in 111 files (109 + 2 skipped), from 960 at the end of night 2. `npm run build`, `npm run lint` and `scripts/sync-theme.sh --check` pass.
- Screenshot check: 61 screens × 5 sizes × 4 themes = 1220 captures per mode, dark and light both 0 console errors, 0 sideways overflow, 0 unlabelled buttons, 0 small button targets, 0 axe violations. New screens: decisions-double, decision-double, home-target-changed, person-own-admin, person-own-member, decisions-remove-self, settings-muted, home-since-nominator, settings-alerts-nominator, nominations-ready-decline, decisions-polls and poll-page.
- `npm run test:decode` (2) and `npm run test:live` (6, GET only on mainnet) pass.
- Bundle: dist 1.9 MB (1.6 MB on night 2); `mui-core` 368 KB (112 KB gzip), `react-vendor` 316 KB (98 KB), app entry 124 KB (36 KB); Decisions 40 KB; polls, decline, the write dialogs and the comment threads load on demand. The production bundle and the zip contain none of the testnet names, and neither the testnet's encryption packages.

**Night 3 by the numbers:** 108 commits on the branch since night 2 (one logical change each) and 10 merges: four feature branches, four review-fix branches, motion and polls. Five testnet scenarios run on their own plus one full run of all 15 (3 new: doubles, decline, admin-polls); no transaction on mainnet, 0 QORT spent. Tests 1359 (from 960). Screenshot check 61 screens, 1220 captures per mode, 0 findings. Review 28 findings (23 confirmed and fixed, 5 refuted), plus 6 and 9 in the motion and polls branches' own reviews, all fixed. The final zip, `release/Q-Mintership+.zip` (864 KB), was built from commit 15fda162.

### Feedback round 1 (from 2026-10-15): Simon's and the Minter Admins' fixes

On branch `q-mintership-plus/feedback-1`, merged into the rewrite branch. One commit per fix; build, lint, tests and the theme check pass before each.

1. **Links show at once, with the avatar of what they open** (Simon, on a real nomination in Hub). Decisions hid a nomination's links behind "Show the whole nomination". Now every `qortal://` link shows straight away, with the avatar of the app or website it opens (`qortal://APP/Torq/…` shows Torq's icon, loaded lazily like every avatar; a link that names no app or website, such as `use-group`, gets a link icon). The reason's own expander is now "Show the whole reason", and shows only when the reason really is cut off: measured, not guessed from its length, so a reason that fits on a wide screen no longer shows a button that expands nothing. Nominations, comments and History use the same component, and Home's compact nomination cards now show the links too.

2. **Avatars come in without a refresh** (Simon, on Decisions in Hub: a signer's and a nominee's avatar missing until he reloaded). Core answers `THUMBNAIL/<name>/qortal_avatar?async=true` with a 404 while it fetches or builds an avatar it doesn't have yet, and the app took that first 404 as "no avatar" for the whole session. Checked on Simon's node, read-only: a name whose avatar wasn't on the node gave 404 (`PUBLISHED`), 404 (`BUILDING`) two seconds later, then the image at four seconds. Now one status read per name tells a name that never published an avatar from one on its way, which is tried again with backoff for about 4 minutes, paused while the tab is hidden; every place showing the name shares one request and one timer. The letter shows until the image has loaded, instead of an empty circle. Everywhere avatars show (`NameAvatar`): people, signers, comments, Ready to mint, History, Settings and the new link icons.

3. **Replies read as replies** (Simon, on a Minter Admin poll's comments in Hub: a reply looked like one more comment). Replies sit in their own tinted block, indented past the parent's avatar (a little on phones), with an accent rail. Each reply starts with a quote: "Replying to <name>" and the first two lines of what it answers (only the name for a deleted, hidden or muted comment). Pressing the quote goes to that comment (scrolled into view, focused and briefly highlighted), which matters most for a reply to another reply in the same thread. Public comments and poll comments share it. The first try put the quote on its own tint as well; in the White theme the excerpt's grey then fell under 4.5:1 on the double tint (the screenshot check's axe pass caught it), so the quote has only its rail now.

4. **Approve and Reject, one vocabulary** (Simon and a Minter Admin: "reject and sign are confusing, should simply be reject and approve"; and Simon, on "Cancel an approved invite" creating a GROUP_APPROVAL). Every place that speaks of an admin's answer says approve, approval or reject: Approve and Reject buttons (Reject also after approving, the same rejection on chain), "You approved ✓", "You rejected", "Approved by", "Each needs 8 approvals", "Collecting approvals", "left to approve", "Approve several", "First approval", "How approving works", and the same in guards, Home, Activity, History and the changelog. "Signature" stays only for a transaction's own signature (pendingSignature), and Sign in stays. The GROUP_APPROVAL wasn't a bug: a cancellation (or any decision) is a proposal already on chain, and each admin's answer is a GROUP_APPROVAL pointing at it; Core applies it at the threshold. The approve dialog now says so, naming the proposal's transaction type. Tests, the screenshot script and the testnet's two screen-driven scenarios use the new names.

5. **Answers side by side, and easier cards** (a Minter Admin: approvals, rejections and Considering in three columns instead of on top of each other; cards easier to read). AnswerColumns shows Approved, Rejected and Considering, each with its count and people (avatar over name on phones so three fit at 360 px); an answer on its way is faded with "confirming…", a rejection after an approval says "had approved first", Considering notes sit under the name. Once anyone rejects, a line gives the rule, which another Minter Admin asked about: "Rejections: k of the n that would end it. If approvals and rejections both reach n, it passes: Core counts approvals first." (Core: `Transaction.getApprovalDecision` checks approvals first, and an answer counts from the block after its own; the testnet's reject scenario F proved a 3–3 tie is approved.) The card now reads top down: what and whom, who proposed it and when (the block in the time's tooltip), the reason or nomination, one clock line with the last block an approval counts in (the expiry line two blocks later shows once it is too late), the columns, then the admin's answer. A decided decision's page shows Approved and Rejected the same way.

6. **Comments show what each Minter Admin chose** (the same Minter Admin). Next to a Minter Admin's name in a decision's comments: Approved, Rejected or Considering (with "(confirming…)"; a Considering newer than their answer wins, as on the card). A nomination's comments use its current decision; a poll's comments show each admin's vote. A comment's name is matched to its owner with one cached lookup per name.

7. **A cancellation says which invite it cancels** (a Minter Admin read the approvals of a pending invite cancellation as a re-invite). Checked on mainnet, read-only: the only pending transaction about that person was a CANCEL_GROUP_INVITE of their unused invite from April 2025, proposed with two others in one stale-invite clean-up. A "Cancel an approved invite" card now says "Cancels the invite <inviter> sent, approved on <date> (<block>). They never pressed Join." (or that they are in MINTER already, or that no stored invite is left), from the cached stored-invite list and that invitee's history, read once the card nears the screen.

8. **Decisions by type** (Simon: sort the cards by type into their own sections, to make the queue easier to take in). Above the list: "Most urgent first" (one queue, as before, the default) or "By type", which shows the open decisions in a section per kind, named as their cards are, new minters first: Add to MINTER, Decline a join request, Remove or ban, Lift a ban, Cancel an approved invite, Minter Admin changes, Other group changes, each in the queue's order (`pages/decisions/decisionGroups.ts`). An overview section ("Collecting approvals · n") keeps a chip per type with its count; a press scrolls to that section and focuses its first card, and it stays where focus goes when an answered card is hidden. Hide what I answered and Approve several work in both orders. The choice is a per-device setting (`qmintershipplus-decisions-order`), also in Settings → Mintership. New screen in the screenshot check: decisions-by-type. Found along the way: `npx tsc -p .` checks nothing here (the root tsconfig only references the others); `tsc -b` in the build always did, and `npx tsc --noEmit -p tsconfig.app.json` is the quick check.

9. **Polls in the decisions' style** (Simon). A Minter Admin poll's votes are three columns, Yes, No and Neutral, with counts and voters, built on the same component as a decision's answers (`PeopleColumns`, which `AnswerColumns` now uses); "Asked by" sits under the question; the own vote reads "You voted Yes ✓".

10. **Nominated by, not Proposed by as well** (Simon). An invite from a nomination shows only "Nominated by" (its first approver is in Approved); an invite proposed directly on chain, and every other kind, keeps "Proposed by".

11. **The whole reason, in a frame** (Simon). A nomination's reason shows in full, with its links, in a lightly tinted bordered frame (`ReasonFrame`) on decision and nomination cards; Home's compact cards keep three lines. The measured clamp (`useClamped`) is gone.

12. **Hide already voted on** (Simon). The switch and its Settings row are renamed, and it now also leaves out the Minter Admin polls the admin voted on (counted, on its way, or after the end), with its own note and Show them.

13. **Wider Decisions and Nominations** (Simon). Decisions, Nominations, a decision's, a nomination's and a poll's page grow to 960 px, from 760: one constant, `WIDE_PAGE` in `components/layout/PageBody.tsx`, which Activity uses too. The nominate form stays at 680.

14. **Each comment in a frame** (Simon). Every comment, with its replies' block, sits in a thin bordered frame with space between comments. The first try also tinted the frame; that took a red "Voted No" badge below 4.5:1 in Hub 3.0 dark and White (axe caught it), so the frame has a border only.

15. **Full text on wide screens, Show more on phones** (Simon: no Show more / Show less on a poll's description, but keep a button on phones for long reasons and descriptions). On wider screens a nomination's reason and a poll's details show in full; under 600 px a long one shows four lines with "Show the whole reason" or "Show more", only when it is really cut off (`useClamped`, restored, measures it). Home's compact cards keep three lines.

16. **Distinct frames** (Simon: less subtle). The reason frame has an accent border (primary at 45%) on an 8% tint; each comment a neutral border at 24% of the text colour. Axe is clean in every theme.

17. **Poll details framed** (Simon). A poll's details sit in the same distinct frame as a nomination's reason: `ReasonFrame` became `FramedText` (components/common) for both, with "Show the whole reason" or "Show more" on phones.

18. **Open your nominations from Home** (Simon: buttons on Home's nominations, "Open in Decisions"). Each card in Your nominations has Details (the nomination's page) and Open in Decisions (its decision, or Decisions while it waits for a first approval; none once it closed with no approval), as on the Nominations list.

19. **Dark stays dark after a refresh** (Simon: after switching to Settings and refreshing, the app turned light in a dark Hub). Hub opens an app with `?theme=dark`; in-app navigation drops the query, and on a reload Core's renderer injects its default `_qdnTheme = "light"` (`ArbitraryDataRenderer.java`: `theme = "light"` unless the URL says). Fixed in the theme kit (its own `Repo:` commits, synced into Q-Mail+, Q-Mintership+ and Q-Share+, each built and tested): Hub's mode is remembered (`qplus-hub-mode`) and, without a `theme` in the URL, wins over the injected default; Hub's switch (THEME_CHANGED) wins over both while the app is open. This app's `index.html` boot snippet reads the same order. Checked in Chromium: open at `?theme=dark`, navigate to `/settings`, reload with `_qdnTheme = "light"` injected: still dark. Q-Mail+ and Q-Share+ have the same bug in their published versions; their `index.html` snippets need the same change in their next pass.

20. **A tab open across an update** (Simon: "This part of Q-Mintership+ could not be shown" on opening Settings, fixed by a reload). The app had been replaced (a new zip) while the tab was open, so the old build's Settings file was gone. A code-split file that fails to load now reloads once to the new build ("Q-Mintership+ was updated. Loading the new version…"), from the error boundary and Vite's `vite:preloadError`; a second failure within a minute shows the usual message (`utils/staleBuild.ts`).

21. **By type, by default** (Simon: By type can be the default and come first). A device with no choice yet opens Decisions by type, and the order chips and Settings list By type first; a device that chose Most urgent first keeps it (`qmintershipplus-decisions-order`).

22. **Community votes** (Simon: a simple Yes or No for people who aren't Minter Admins, to feel the community's sentiment so it can be weighed for nominations; who voted to the right of Copy link on the cards, their vote on their comments, and the buttons where Minter Admins have theirs). While a nomination waits for its first approval, or collects approvals that can still count, anyone signed in who isn't a Minter Admin or the nominee sees No and Yes: on the nomination's card (Nominations, Home, a person's page and the nomination's own page) after the screen's own buttons, and on the invite's decision page where a Minter Admin has Reject and Approve. Each vote is one Hub step (0.01 QORT), explained first: advisory, public under the voter's name, only the newest counts. Then "You voted Yes ✓" with "Change to No", and "(confirming…)" until QDN has it. Without a registered name the dialog says what a name is and where to get one, and nothing opens in Hub. Beside Copy link, "Community" with Yes and No, their counts and the first three voters' avatars each ("+n" for more), opens everyone who voted in two columns (`PeopleColumns`, with h3 headings in a dialog). It shows once someone has voted, on open nominations and their invites, to everyone, Minter Admins included. In comments, a voter's name carries "Voted Yes" or "Voted No"; a Minter Admin's own answer stays. Data: a new record, `qmp-vote-<nominee>-<yes|no>-<id>` (Data contract above), read from one shared search with no bodies. New screens in the screenshot check: nominations-community, nominations-community-voters and nominations-community-vote; axe is clean in every theme. Simon's answers (2026-10-15): everyone may vote, with no MINTER membership or level required, and a nomination's nominator and supporters may vote too; Minter Admins answer on chain, and the nominee doesn't vote on themselves. That is what was built.

23. **The Minter Admins' answers on nominations, for everyone** (Simon: people outside MINTER looking at nominations should see the statistics of the current Minter Admin votes). Decisions is only for Minter Admins, so a nomination's card shows the same columns as its decision: Approved, Rejected and Considering, with counts and names ("confirming…", "had approved first" and Considering notes too), while it collects approvals, or while it waits for its first approval with someone considering it. For everyone, on Nominations, Home, a person's page and the nomination's own page. On a phone each column shows three people, then "+n more" and one Show all (Show fewer); wider screens show everyone. The line "n Minter Admins are considering" went (the Considering column says it), and with it the unused `ConsideringCount` and `ConsideringLine`. Decision and nomination cards share the tally-to-columns code (`components/decision/answerPeople.ts`), and the admin list now seeds the name cache, so the chips need no name lookups where the member list isn't read. No new reads. Found along the way: asking for the screen size in every decision card's columns made Decisions' heaviest tests half as slow again (6.5 s to 9.5 s alone, past 15 s under the full suite), so only the capped columns ask.

24. **What's new in History, on its tab** (Simon: as Decisions has its count, for Minter Admins only, show on the History tab that there is something new). A Minter Admin's History tab counts MINTER's changes decided (approved, rejected or expired) since they last had History open on this device, counted as History counts its events; it clears once History's list is in. On a phone the bar has no History (Decisions takes its place), so Activity's History button carries the count; on wider screens only the rail does. The first time, counting starts from now, so nobody opens on weeks of old news. Joins, join requests and leaves don't count: finding them means searching every group's joins, so they stay in History itself (Home's Since your last visit also lists what was decided). Reads and storage: the two table rows above (`historyNews.ts`, `historySeen.ts`, `hooks/useHistoryNews.ts`). New screen in the screenshot check: activity-history-news.

25. **History filters by type** (Simon: filters for all the types History shows; first asked as "sorting", then: "it is sorted ok, I want filters"; the original app's cards stay as they are). Chips above On chain: All, then each type with events in the days read, with its count, in a fixed order, new minters first: Invites, Join requests, Joined MINTER, Declined requests, Removals and bans, Left MINTER, Bans lifted, Cancelled invites, Minter Admin changes, Other changes; one at a time, as Nominations' filters. Invites include the nominations that expired or were rejected, and Removals and bans the proposals of them that didn't pass (their rows say so). Each event's type comes from `buildTimeline`, which now says whether a kick declined a join request and whether a join only asked to join (`pages/history/historyFilters.ts`). The choice is `?type=<key>` in the URL, so Back from a decision's page and Hub's Copy link keep it, and it stays while older days load. A type with nothing in the days read (from a link) keeps its chip at 0 and says "Nothing under “Bans lifted” in the last 30 days." with Show all types. The footer reads "9 of 14 events since …". No new reads: it filters what History already has. New screen in the screenshot check: history-filter (0 overflow, 0 console errors, axe clean in both modes).

26. **History searches a type across MINTER's history, over a period** (Simon: "why I don't see banned in history, even in filters?"; then: choosing a type searches that type across all of MINTER's history, a date or 60, 120 days or a year can be set, and bans get their own chip). Checked read-only on mainnet first: the last MINTER bans were approved on 11 Aug 2026, outside the 30 days History reads first, and bans shared a chip with removals. Now a type of decision (Invites, Declined requests, Removals, Bans, Bans lifted, Cancelled invites, Minter Admin changes) is one search by type across MINTER's history, or from the period's start (a signing window earlier, so a proposal decided inside it is in), 20 shown at a time with Show more. On mainnet: 91 bans, 109 kicks, 259 invites, 36 admin changes, each answered in 3–10 ms. Removals and declined join requests are both kicks; kicks are told apart from each kicked person's own history 20 at a time, only as far as the list needs ("checked the newest 40 of 109 kicks"). Joins, join requests and leaves carry txGroupId 0, so Core only finds them by reading every group's joins (about 370 a month): they and All stay in 30-day windows; any time keeps "Load the 30 days before", now stopping at MINTER's creation (16 Sep 2024; the cap is 36 windows), and a period reads the windows it covers, three at a time. A year of MINTER is 889 events (5.5 s from a local node), so long lists show 50 more at a time instead of "Show all 889". When: Any time, Last 30, 60 or 120 days, Last year, or From a date (a date field with Show; not before MINTER began, not in the future), in the URL as `?period=` or `?from=` beside `?type=`. Every type always has its chip, now without counts (a count over the days read said nothing about a search across all of history); on phones the type is a native picker beside When, instead of eleven chips five rows deep. Checked read-only against a mainnet node in a browser: Bans 91, Removals, Declined requests (1 of 109 kicks), Minter Admin changes since 1 Jan 2026, All over the last year, the phone pickers at 375 px, no console errors. New screen in the screenshot check: history-period; history-filter now shows Bans (0 overflow, 0 console errors, axe clean in both modes).

27. **A comment count agrees with its thread** (Simon, on a decision in Hub: "Comments (2)" open, "Comments (1)" closed, the second being his reply: "a reply should also count"). Replies were counted. The closed toggle read the shared count list, which the page had read before the reply and never read again: posting counted the reply as on its way, opening the thread found it on QDN and dropped that, and closing fell back to the old list. Checked read-only on Simon's node: the reply was in the shared search by then. Now an item's own search (an open thread, or a card whose comments can be older than the list) adds what it finds to the shared list, so every count agrees with the thread at once; the shared list is read again every 3 minutes while a count shows (paused while the tab is hidden, backing off after errors, one read for the whole page), so other people's new comments and replies count without a reload; and Refresh on Home, Decisions and Nominations reads comments again. The new test fails without the fix.

28. **When starts at the last 30 days** (Simon: Any time should go from When; the first should be 30 days). When offers the last 30 days (the default; the URL then has no period), 60 or 120 days, the last year, or a date. A type of decision is now searched over the period chosen (one search by type from a signing window before its start), so the August bans show from "Last 120 days", and a date at MINTER's start reaches everything. "Load the 30 days before" went with Any time: the end of the list, and an empty type, offer the next longer period instead ("Show the last 60 days", then 120, then a year), keeping what is shown.

29. **Compact rows in the answer columns on phones** (Simon, on a decision in GO: make the Minter Admins' names and avatars smaller so they fit nicely one under another; with a long name such as "Counter Economy", centre the avatar to the left of the split name). Under 600 px each person in Approved, Rejected and Considering (and a poll's Yes, No and Neutral, and the community's voters) is a 20 px avatar centred beside a 14 px name that wraps onto two lines, with any note ("had approved first", "confirming…") under the name: about 44 px a person instead of avatar over name (item 5). Wider screens keep 28 px avatars. 14 px is the smallest text docs/DESIGN.md allows, and each row keeps its 44 px tap target. `NameAvatar` takes a `phoneSize` set by a CSS breakpoint, so the columns on every decision card add no screen-size listener (the lesson from item 23). Screenshot check of decisions, a decision's page, nominations, the community voters and Considering at every size, in all four themes and both modes: 0 overflow, axe clean.

30. **Decisions' sections in colours of their own** (Simon: each section, such as Add to MINTER, Cancel an approved invite and Minter Admin polls, more visibly differentiated, maybe with different background colours, still nicely themed; and clearer section titles). Each section is a panel lightly tinted in its colour (9 % in dark themes, 7 % in light), edged in it on the left, under a larger title (16–17 px, in the theme's text colour) with an icon in the colour and the count in a pill; screen readers still hear "Add to MINTER · 4". The colours come from the theme: Add to MINTER success green, Decline a join request warning orange, Remove or ban error red, Waiting for a Minter Admin info blue; the theme's info blue turned to teal (Lift a ban), amber (Cancel an approved invite, and Clean up stale invites), indigo (Minter Admin changes, and Admin changes and the target) and violet (Minter Admin polls), keeping its saturation and lightness (`pages/decisions/sectionAccents.ts`). The palettes alone couldn't do it: Black's secondary is a light grey and White's primary is black. Collecting approvals, Too late to approve, Other transactions and Unusual approval route share a neutral grey; By type's chips carry a dot in their section's colour. On phones a panel reaches 8 px into the page margin, so its cards keep their width. Tests: every coloured section has its own colour in all four themes and both modes, and text on every tint reads at 4.5:1.

31. **Comment threads open and close smoothly** (Simon: a nice smooth animation when opening and closing comment sections, without the window jumping so radically). `SmoothReveal` (components/common): the thread's height follows its content as it opens (260 ms), as it loads (the skeleton giving way to the thread) and as it closes, and the thread fades in; it never anchors the page's scroll, and is inert while it closes. Measured in Chromium on Decisions: 0 → 109 px (the skeleton) in about 250 ms, gliding on to 190 px as the comments arrived, 180 → 0 px in about 250 ms on closing, the toggle at the same place on screen throughout. Public comments and Minter Admin polls' comments use it (the polls' toggle turns its chevron like the others). Reduced motion makes it instant. It adds no screen-size or motion listener to the cards (CSS handles reduced motion).

32. **Ready to mint sorts** (Simon: sorting options such as newest and oldest). A Sort picker: Newest request first (the default), Oldest request first, Highest level (more blocks minted first within a level), Most blocks minted, Name (A–Z), Your node's order; `?sort=` in the URL. Core lists join requests by address (`ORDER BY joiner`, checked in its source) and without dates; when someone last asked to join is their newest MINTER JOIN_GROUP, from the MINTER history their former-member mark already reads, so each row now also says "asked 12 Sept 2026". Each order reads only what it needs, one read per person, six at a time, kept 10 minutes and shared with the rows (the reads table above). Checked read-only against a mainnet node (92 join requests): newest first The Empress and Eire (15 Oct 2026), oldest from 17 Oct 2024, Highest level from level 8; a further order took 110–200 ms. The mock first load is 60 GETs (57 before).

33. **Minter Admin Activity: every column sorts, "signed", a bar that fills** (Simon: press any header to sort, rename "answered" to something like signatures, a nicer percentage bar that fills with the score rising as it loads). Every column header sorts the table (Admin A to Z; Participation, Approved, Missed and Proposed most first; Median time to approve fastest first; Last active most recent first) and pressing it again reverses it; Sort by lists every column, with a button beside it that reverses the order on phones too; what isn't known stays last either way (`rules/activity.ts` → `sortActivity`). "7 of 10 answered" is "7 of 10 signed", the cards' Answered is Signatures, and How this is counted says approving and rejecting are both signatures (item 4 kept "sign" out of the buttons; here it names what an admin did, which covers both). `ProgressBar` (Home's level progress, the members' levels, Activity) is a rounded, primary-tinted track with a gradient fill that fills from empty and glides to new values; Participation's percentage counts up beside it in step (`hooks/useCountUp.ts`, 900 ms, easing out). Measured in Chromium: 0 % to 88 % in about 850 ms, bar and number together. Reduced motion shows both at once.

One test (TargetShift's "Approve several with an admin change") failed once under full-suite load and passed on its own and on a rerun: a long dialog flow close to its time limit.

34. **The Explorer** (Simon: a new tab to explore what users do on QDN and the chain, based on qortal://APP/Dodgers, Explorer and Transactions in one, for Minter Admins and anyone, especially to find the secondary accounts of people with several minting accounts; secondary names and nominations understood, name suggestions while typing, compare accounts, rabbit holes, and Core investigated for what is missing). Built overnight 2026-10-15/16 as described under The Explorer above. How:
    - **Research first** (five readers in parallel): Dodgers dissected from its published source maps (40 files, 6,522 lines: every card, call and computation, its bugs, such as opening the first search result when a name has no exact match, and its `limit=0` reads); the app's infrastructure; Core's API (source 6.1.4, every endpoint checked live on mainnet 6.1.9 with GETs, timed); how secondary accounts show in public data (sponsorship and reward shares, level moves, name sales, payments, first funding, Core's own 2022–24 self-sponsorship checks); and what Mintership data the app already loads.
    - **A plan, reviewed before building** by four critics (phone UX, Core cost, a Minter Admin's investigations, safety and wording). Their changes: the trail in a session store, tabs that switch in place, "Transactions" (not a second "Activity"), set views of a sponsor's sponsees and of the accounts a funder paid first, a payer test on `payments/between` (3–30 ms instead of 0.4 s), first funding that skips a PUBLICIZE or ARBITRARY first transaction, one QDN search per name (several names in one search without a service is a slow scan), keys that can't collide with the app's, admin approvals as process facts only, no chat reads.
    - **Built in waves** in parallel worktrees, merged one at a time with build, lint and tests: the data core and the redirect fix; transaction words for every type and the mock world; the route, nav, landing page and account shell; then Overview and Names, Connections and the set views, Transactions with the transaction page and Transactions on Qortal, and Mintership with the entry points; then Compare.
    - **Reviewed:** the Explorer in six dimensions (Core and data, wording and privacy, phones and accessibility, the rules, efficiency, tests): 50 findings, each checked by a second reviewer trying to refute it; 35 confirmed, 34 fixed (one commit each) and 1 deferred (see Follow-ups), 15 refuted. Compare in three dimensions: 36 findings, 30 confirmed (21 distinct problems, 19 fixed; the 2 left are in Follow-ups), 6 refuted. The main catches: a failed read shown as "nothing found" (everywhere now a compact error with Retry, and kept out of "Also checked, nothing found"); a QDN summary carrying the previous account's results after Back; the limiter bypassed by Refresh; Compare stuck on "Reading…" under React's StrictMode; a bought name dated by its first registration; a genesis allocation of QORA called QORT.
    - **Checked with real data** (the dev server outside Hub reads the local mainnet node, signed out, read-only): Simon's account (88 names, 45 groups, a sponsor and 9 sponsees, 80 connections) on every tab, Compare with another account, a busy Minter Admin's answers (1,000+), an account with a penalty, a sponsee with no public key, an account with 205 names.
    - **Reads per screen with real data** (a fresh load each, the mainnet node on a busy machine, sections that wait for the screen not all started): a light account 21–28 Core reads per tab, every answer in 1.2–1.8 s (Mintership 78, with the original-app card scan the person page already makes); Simon's account (88 names, thousands of transactions) answered in 2.7–10 s, the slowest being one 100-row transaction search on its Transactions tab (4.7 s under load); the landing page 2; Compare of the two 70 reads, all answered in 4.6 s. Every list read in the Explorer's code passes a limit of 1 to 100 (checked in the code, read by read), and the mock world fails any `limit=0`.
    - Data and words are pinned by tests (transaction sentences for all 41 types from every side; connections, money sums in exact 8-decimal arithmetic, first funding, payer bands, Compare's pairs, timeline and overlaps). Every Explorer page test runs on a strict mock world (a read it can't answer fails the test) and asserts no POST and no write request, with axe.
    - **Tests:** 2,021 passed, 1 expected fail, 8 skipped, in 188 files (from 1,462 in 128 before the Explorer); `npm run build`, `npm run lint` and `scripts/sync-theme.sh --check` pass. Under full-suite load a few of the heaviest Decisions page tests can pass their 15–30 s limit; each passes alone (the two heaviest files now have 30 s).
    - **Screenshot check:** 16 new screens (explorer, -outside, -search, -account, -connections, -transactions, -mintership, -names, -sponsees, -funded, -compare, -tx, -txs, -unused, -at) with Home and Settings for the gear: 640 captures in dark and light, 0 console errors (the never-used address's own 404 listed as expected), 0 sideways overflow, 0 unlabelled buttons, 0 small targets, 0 axe violations.
    - **Bundle:** dist 2.3 MB (1.9 MB before); every Explorer page loads on demand (Compare 52 KB, the account page 29 KB, Mintership 27 KB, Connections 21 KB); first load gains 5 KB in the app entry and 31 KB in the shared MUI chunk (Tabs, Snackbar).

## Follow-ups

### Readiness

**Ready to publish as the testground, after the morning's guided actions.** Every write is proven on the private testnet (the full run, 15 of 15, on the final code); the app ran read-only in Hub with real data and in GO on a real phone with no errors; the tests, the screenshot check and the review are clean; the zip holds no testnet code. Nothing known blocks it. What only the morning can show: that Hub's dialogs for the real writes (a comment, a nomination, Considering, a first signature) say what the steps say. Publish once they match, then check Hub's own Copy link and the app in GO on its default node with the published app.

**The Explorer (2026-10-16)** only reads, so it adds nothing to check in Hub's dialogs. It was checked with real data in a browser (the dev server reading the local node, signed out) and in the screenshot check, but not yet in a test Hub or in GO: worth one look in Hub Dev Mode before publishing (Next-pass ideas).

### The morning: Simon's guided real actions, before publishing

Real writes on mainnet, one at a time, by Simon, in a test Hub on his own account with Dev Mode → **Zip** → `release/Q-Mintership+.zip` (the exact bundle; it previews without publishing). Before each step, read what the app's dialog says; in Hub's dialog, check the action, the fee and the fields named below; after Hub, check the result before the next step. Decline in Hub if anything differs. Never Reject unless you mean it.

Today (block ≈ 2,758,700) the only MINTER decision waiting is a member's second "Become a Minter Admin": a double you have already signed; it runs out at block 2,760,156. There are no Q-Mintership+ records on mainnet yet.

1. **A comment (harmless).** Decisions → the double's card → Comments (0) → write a short note → Post.
   - App: "Public, under your name Simon James", 0.01 QORT, one Hub step.
   - Hub: `PUBLISH_QDN_RESOURCE`, service `JSON`, name `Simon James`, identifier `qmp-comment-<the first 40 characters of 5YiHUjTE…>-<6 letters or digits>`, fee 0.01.
   - After: "Publishing…", then the comment with its menu once QDN lists it (a minute or two); Comments (1); the same on the decision's own page.
   - Undo: the comment's menu → Delete (0.01 more; it then reads "Deleted").
2. **Propose nomination (only for someone you would nominate anyway).** If another nomination is already open for someone you'd back, Add your support instead (the same Hub step, identifier `qmp-support-<their address>`). Nominations → Ready to mint (or Propose nomination) → pick them → reason (20–600 characters) → Propose.
   - Hub: `PUBLISH_QDN_RESOURCE`, `JSON`, identifier `qmp-nomination-<their address>`, fee 0.01.
   - After: the card under "Waiting for a Minter Admin"; the link the app gives you opens `/nominations/<address>`; in the original app nothing changes (it has no such cards).
   - Undo: none on QDN; it leaves the open list after 10,080 blocks, and nobody is invited until an admin signs.
3. **Considering, then No longer considering (harmless), on the nomination from step 2** (or any nomination waiting for its first signature). Nominations → the card → Considering → optional note → Mark as considering.
   - Hub: `PUBLISH_QDN_RESOURCE`, `JSON`, identifier `qmp-considering-<their address>`, body with `nomineeAddress`, fee 0.01.
   - After: "1 Minter Admin is considering" on the card, the nomination's page and the nominee's Home.
   - Undo: No longer considering publishes the same identifier again with `cleared: true` (0.01).
   - Considering isn't offered on a double, so the waiting double can't be used for this.
4. **A signature (only on a decision you would sign anyway).** The first signature on your nomination from step 2: its card → Sign.
   - App: two Hub steps, 0.02 QORT: the invite, then your own signature.
   - Hub, step 1: `INVITE_TO_GROUP`, `groupId: 694`, `inviteeAddress` theirs, `inviteTime: 864000`, `txGroupId: 694`, fee 0.01.
   - Hub, step 2: `SIGN_TRANSACTION` with the raw approval: `"approval": true`, `pendingSignature` starting with the invite's signature, fee 0.01.
   - After: "Signed ✓ (confirming…)", then 1 of 8 once it is in a block; the same decision in the original app's view of pending approvals; Home's counts.
   - Undo: none. Withdraw my signature is a rejection on chain; the invite simply runs out after about 8.5 days if nobody else signs.
5. **Optional, a Minter Admin poll (only for a question you want to ask the admins).** Decisions → Propose → Ask the Minter Admins → question, duration → Review → Publish.
   - Hub: `PUBLISH_QDN_RESOURCE`, service `DOCUMENT_PRIVATE`, identifier `qmp-adminpoll-<8 letters or digits>`, encrypted (Hub shows it is encrypted), fee 0.01.
   - After: the poll on Decisions under Minter Admin polls, readable by the other Minter Admins in their own Hub; Vote (one more step, `qmp-adminvote-<id>`).
   - Undo: none; it runs out at its end.
6. **Reject and Decline a join request:** only if you mean them. A rejection counts against a decision exactly as a signature counts for it; a decline removes someone from Ready to mint once enough Minter Admins sign.

Report anything that differs from these words before going on; the app is ready to publish once these match.

### Open questions for Simon (night 3)

From building tonight's work; the app works either way.

1. **Removal doubles:** a removal that is a double offers Reject only (there's nothing to remove), while an addition that is a double keeps a secondary Sign. Keep?
2. **Rule (a) while a removal of the same admin waits:** an addition of someone who is a Minter Admin is still marked a double, even if a waiting removal of them could pass first. Keep, or don't mark it then?
3. **Rule (c):** the newer copy is the double even when it has more signatures than the older one. Keep, or call the one with more signatures the real one?
4. **Activity and decided doubles:** a double that was signed anyway and approved, or rejected, still counts as eligible (never as a miss) for admins who left it alone. Leave those out too?
5. **Decline a join request:** offered on Ready to mint rows without an open nomination, and in Propose. Also on rows with an open nomination, or on the person page? And should Home tell someone whose join request was declined (their person page says so)? Activity's pulse still counts declines among "removed".
6. **Nominators' alerts:** to keep alerts on between nominations, the last support rule stays until a new nomination's rule replaces it, so a later support for that person still alerts. OK, or a per-device "alerts wanted" flag instead?
7. **Supporters:** Since your last visit outcomes and support alerts are for nominators only. Supporters too?
8. **Home's target line** shows when the signatures needed moved, not when only the admin seats moved (Decisions says both). OK?
9. **Wording to check:** "Your nomination won't go through this time", "Your account and your level stay as they are", "Level 5+ is suggested for Minter Admins, and you're level 2. You can still propose yourself.", "As things stand, if this one passes, nothing changes".
10. **Minter Admin polls:** closing a poll early or correcting its question isn't offered (republishing would replace it for everyone). Wanted? And an opt-in Hub alert when a poll is published (it could only say one was published)?
11. **Refresh buttons** stay enabled while they read (a press during a read is ignored), so focus stays on them. OK?

### Simon's answers (2026-10-13)

1. **Bottom bar:** "Nominees" stays.
2. **Classic light colours:** keep the darker shades (teal `#186d64`, gold `#8b6016`).
3. **Stale invites:** stale means approved more than 30 days ago, as built. Home's tile counts every approved invite not used, and says so.
4. **Proposals chain the proposer's signature,** as the first signature does. Built (see Done).
5. **Reasons** for kicks and bans stay required.
6. **Sign on unconfirmed decisions:** proven on the testnet (night 2): an invite and its first approval were confirmed in the same block (17).
7. **Cancel an approved invite** is added to Propose. Built.
8. **"Other transactions waiting for Minter Admins":** the wording stays.
9. **Activity counting:** each rule agreed.
10. **Activity's tail cache:** later, if the 180-day refresh is slow in Hub.
11. **History:** as built.
12. **Ready to mint:** nominators find quality users and reach out; newcomers can show they're ready with a join request, after a readiness checklist. Built, in place of the generic "find a nominator" help.
13. **The welcome per device:** fine.
14. **History clean-up:** done, and the old `q-mintership-plus/rewrite-phase-1` branch is deleted from GitHub.

### Open questions of 2026-10-13: answered and built (night 2)

1. **"Propose cancelling all" adds your signature to each cancellation:** yes. Two Hub steps per invite; the whole run's fees are checked first.
2. **The two-fee check before a proposal:** right, and it stays quiet unless the balance can't pay.
3. **Cancel an approved invite** also lists invites of people already in MINTER, after the unused ones, marked "already a member".
4. **Accept's check** now reads "Your join request is already in: you're ready. Nothing more to send.", however the request was sent.
5. **"You've accepted ✓"** is replaced by "You're ready ✓: when the admins approve, you're in at once."
6. **"Find a nominator"** is gone; tests pin that nothing offers it.
7. **Ready to mint marks former members:** one history read per row on screen, kept 10 minutes.
8. **Search on Ready to mint:** by address, or by name through one cached name search.

### Open questions for Simon (night 2)

From building tonight's work; each is a choice, the app works either way.

**Signing and the target**

1. "I've checked these" is also required when an admin change only raises the target. Keep it, or ask only when the target drops?
2. In Sign several, an admin change with an impact needs the same tick. Keep it, or leave such changes out of a bulk run with a reason?
3. Only Decisions says "The target changed". Should Home's admin section show a short line linking to it?
4. Activity counts participation as signatures ÷ eligible, so a deliberate rejection lowers it. Count any answer as taking part?
5. "Waiting for your signature", the Decisions badge and Sign several leave out decisions you rejected (each can still be signed from its card). Right? And should "Hide what I signed" become "Hide what I answered"?
6. Considering is offered only to admins who haven't answered. Should one who rejected be able to say they're reconsidering?
7. The nominee's Home shows how many Minter Admins have rejected so far and how many are considering. Is the wording gentle enough?

**Admin roles and links**

8. Become a Minter Admin is offered to every member, level 0 included. Should it need a level, such as 5+?
9. Step down is on an admin's Home, their own page and in Propose. Right, or only the person page?
10. The link a nominator copies after Propose nomination opens the nominee's person page. Open `/nominations/<address>` instead?
11. Should History's decided events link to their decision page too?

**Comments**

12. Add a "Muted names" list with Unmute to Settings? Today you unmute from a muted comment's own menu.
13. Comment counts include deleted and hidden comments. Count only readable ones? Every body would have to be read, so counts would no longer be one shared search.
14. A just-posted comment shows "Publishing…" with no menu until QDN lists it, so it can't be edited at once. OK?
15. The shared count search covers 45 days and up to 300 comments; older items search per card once on screen. Are those the right numbers?

**Nominations and wording**

16. "Propose nomination" (sentence case), or "Propose Nomination"? It is one constant. And should descriptive uses ("You can nominate new minters") change too?
17. The floating "Propose nomination" button is about 200 px wide on phones. Make it icon-only, with a label for screen readers, on narrow screens?
18. Others' nomination cards say "Ready to mint" for an open join request; Decisions keeps "Hasn't accepted yet: after approval they still need to press Join now." when there is none. OK?
19. Propose cancelling all stops before it starts if the balance can't pay every fee. OK, or run as many as it can pay?
20. The Nominations search text is kept when switching between open nominations and Ready to mint. Clear it instead?
21. A former member whose ban ended or was lifted reads "removed from MINTER". Should a ban get its own word?

**Notifications**

22. The Hub evidence comes from GO's source. Please confirm the desktop Hub people use also has the NOTIFICATION_* requests (the app checks with SHOW_ACTIONS either way, and says "Your Hub doesn't offer app alerts" without them).
23. Alerts for signatures, approvals or a new decision would need Core's notifications socket to send group-approval events. Raise it as a Core track?
24. Nominees without a registered name get no Hub alert, as Hub only listens for named accounts. Accept it, or ask the Hub team?
25. Should nominators get "Since your last visit" items for the nominations they made (approved, expired), and an alert when someone supports one?
26. The "Since your last visit" panel sits above Home's status hero. Keep it there, or put it under?

**Look**

27. People named inside sentences ("Proposed by Admin B") are links in the sentence's own colour, underlined only on hover. Underline them, or use primary?
28. The signature ring's "of 8" is 11–13 px; the ring has a full label for screen readers. Keep it, or enlarge it on 56 px rings?

### Simon's answers to the night 2 questions (2026-10-13)

Answered in the evening of 2026-10-13. To build in night 3, before the Hub check:

1. Keep "I've checked these" for rises too. *(as built)*
2. Sign several keeps the same tick. *(as built)*
3. **Build:** a short line on an admin's Home when the target changed, linking to Decisions.
4. **Build:** Activity counts any answer (signed or rejected) as taking part; only doing nothing is a miss.
5. **Build:** rejected decisions stay out of the waiting lists, and "Hide what I signed" becomes "Hide what I answered".
6. **Build:** an admin who rejected can mark Considering again (it shows until their next answer).
7. **Build:** the nominee's Home keeps the numbers but says rejections more gently.
8. **Build:** Become a Minter Admin is suggested from level 5; below that it is still possible, with a note saying level 5+ is suggested.
9. **Build:** Step down only on the admin's own person page (not Home, not Propose).
10. **Build:** the link a nominator copies opens `/nominations/<address>`.
11. **Build:** History's decided events link to their decision's own page.
12. **Build:** Settings gets a "Muted names" list with Unmute.
13. Comment counts include deleted and hidden ones. *(as built)*
14. "Publishing…" with no menu until QDN lists it. *(as built)*
15. 45 days / 300 comments for the shared count. *(as built)*
16. "Propose nomination", sentence case; descriptive "nominate" stays. *(as built)*
17. **Build:** the floating "Propose nomination" button is icon-only on narrow screens, with its label for screen readers.
18. "Ready to mint" / "Hasn't accepted yet" wording. *(as built)*
19. Propose cancelling all stops before it starts when the balance is short. *(as built)*
20. The Nominations search text is kept across views. *(as built)*
21. **Build:** a former member whose ban ended or was lifted says so ("banned, ban ended" / "ban lifted"), not "removed from MINTER".
22. Check in night 3 whether the desktop Hub has the `NOTIFICATION_*` requests.
23. No Core track for group-approval alerts for now.
24. Nominees without a name get no Hub alerts: accepted for now.
25. **Build:** nominators get "Since your last visit" items for their nominations (approved, expired), and an opt-in Hub alert when someone supports one.
26. The "Since your last visit" panel stays above the status. *(as built)*
27. **Build:** people named inside sentences are always underlined.
28. **Build:** the ring's "of 8" is larger on 56 px rings.

### Open questions for Simon (the Explorer, 2026-10-16)

The Explorer works either way; each is a choice.

1. **Settings on phones.** Explorer took Settings' place in the phone bar (the last slot, so the other items keep theirs), and Settings is now the gear at the top of Home, with Back on its page. DESIGN.md says Settings is reached from the nav. Keep, or put Explorer in the header as a search button instead, or in History's place?
2. **The account header on a phone** has four icon buttons (Copy link, add to Compare, Compare with…, Refresh), so the title is cut short; the full name shows under the avatar. Move Compare with… under the trail as a text button?
3. **Payments in Connections** read the newest 100 payments each way (plus "Check older"). Enough, or read more at once for Minter Admins?
4. **Several sponsors:** an account sponsored by more than one account lists each "Sponsored by …", oldest first, and the oldest is treated as its sponsor for "Also sponsored by". Right?
5. **Tags** under a payment counterparty: "its sponsor", and what its first funding was ("its first QORT payment came from them"). Wording OK?
6. **Original-app cards** about a person are still found by their primary name only (the person page's existing scan); the Explorer adds the cards they posted under any name. Match cards about them by every name too? It changes what the person page's shared read means.
7. **Community votes** in "In Q-Mintership" include Minter Admins' votes, which the nomination's tally leaves out. Keep them there as plain facts?
8. **Compare nominee and nominator** shows on a waiting invite's decision page and on the nomination page; for a decided invite the nominator would need one more read. Add it?
9. **Transactions on Qortal** leaves messages out (an account's own tab lists the ones it took part in, never their content). OK?
10. **"Applied"** is the app's word for a MINTER change that needed no approvals when it was made (before MINTER required them); the Explorer's round line repeats it ("One round … Applied."). Keep, or say "Applied at once (no approvals needed then)"?
11. **A graph view** of an account's connections (the old payment tree, redone): the lists cover it on phones; worth a lazily loaded map on wide screens?

### Core: what an explorer needs that Core doesn't give (proposals)

Found while building the Explorer; none blocks it. Each would be a read-only endpoint the app can feature-detect (a 404 means it falls back to what it does today).

1. **TRANSFER_PRIVS JSON has no `recipient`.** `TransferPrivsTransactionData` isn't in `TransactionData`'s `@XmlSeeAlso`, so its own fields aren't written; the app reads the recipient from `/transactions/signature/{sig}/raw` (bytes 112–136).
2. **No name history.** `getTransactionsInvolvingName` exists inside Core; a `GET /names/{name}/history` would show every owner of a name, not only one account's side.
3. **No counterparty summary.** `GET /addresses/{a}/counterparties?txType=…` (sent and received counts and amounts per account, first and last block) would replace paging through payments, make overlaps exact, and mark busy accounts for free.
4. **No counts.** A count for `/transactions/search` (as `/chat/messages/count` has) would turn the 100+/500+/1,000+ payer test into one read.
5. **Sponsor and sponsees.** `/addresses/sponsorship/{a}/sponsor` takes an arbitrary row (no ORDER BY) and the report lists sponsees' names, not addresses; its `nonRegisteredCount` is sponsees minus names, which goes negative with several names. A sponsees list with addresses, dates and removals would serve explorers directly.
6. **First funding.** Following an account's first reference works for most accounts but not after a fee-less first transaction; `GET /addresses/{a}/origin`, and the reverse ("accounts first funded by X"), would make the funder views exact.
7. **No minting history per account.** Core keeps no record of which reward batches an account was online for, and `/blocks/onlineaccounts/{h}` answers an empty list on mainnet today; a per-account history would allow "minted in the same periods" comparisons.
8. **Primary names in bulk:** `getPrimaryNamesByOwners` exists inside Core; one endpoint for many addresses would save a read per row.
9. **Searches that cost more than they should:** `searchsimple` with several `name=` and no service scans everything (0.5 s for 2 names; one name is 1–10 ms); `/transactions/address/{a}` has no limit by default; `/addresses/rewardshares?involving=` takes 0.4–1.2 s where `recipients=` takes 40 ms.

### Next-pass ideas

- Settings sync to QDN (like Q-Share+'s `settingsQdn.ts`); the settings, the last-visit snapshot, the seen target and muted names stay in the browser for now.
- Hub's `SHOW_ACTIONS` feature detection, to switch to a GROUP_APPROVAL action if Hub adds one.
- The level spread on Activity reads each member's account on request; a Core endpoint for levels of a group's members would make it one call.
- A Core issue for the fresh-chain start-up (the empty "latest signatures" batch on a chain with no QDN resources), with `testnet/lib/PrimeChain.java` as the workaround it would retire.
- Opt-in Hub alerts for comments and Considering ("someone commented on your nomination"), as both are QDN records.
- Theme kit, for every app: the light themes' off-state switch track is about 2.7:1 (a control's boundary needs 3:1); captions and field helper text are 12 px where docs/DESIGN.md asks 14 px on phones; Hub 3.0 light's success, warning and info colours are 2.4–3.5:1 on paper (this app only uses them beside words); a kit-level focus ring, as docs/DESIGN.md describes.
- The page tests are sensitive to a heavily loaded machine: a vitest `maxWorkers` limit, or longer timeouts on the heaviest page files, for overnight runs.
- Cleanup: DecisionCard's `highlighted` prop and `decisionCardId` anchor are unused now that `?d=` links redirect.
- Explorer: a Hub Dev Mode check (round 4) with real data at the five sizes, counting reads per screen in Hub; and in GO on a phone.
- Explorer: the same `/groups/member/{a}` is read twice when an account opens (the MINTER membership and the Explorer's groups use separate keys); one shared loader would save a read.
- Explorer: "Published on QDN" keeps what it found while the tab is open, so Refresh doesn't re-read it until the tab is opened again.
- Explorer: a few list buttons (the landing page's short lists, a transaction's fields) still drop keyboard focus when pressed; the funded page's checks aren't stopped when the page closes (at most 50 small reads).
- Explorer: History's "Find a person" could use the Explorer's field (suggestions, exact lookup), still opening the person page.
- Explorer: the screenshot check flags buttons under 40 px; DESIGN.md asks 44.
