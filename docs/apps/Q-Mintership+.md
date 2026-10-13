# Q-Mintership+

Who joins the MINTER group (694), and therefore who mints QORT: propose a nomination, then Minter Admins sign, reject or let it expire.

**Published:** not yet.

**Version on the branch:** `1.0.0` (not published), Q-Mintership+ 2.0, a rewrite on React 19.3 + MUI 9.4. Nights 1 and 2 are done on the branch: [SJQortal/Q-Apps-Plus#23](https://github.com/SJQortal/Q-Apps-Plus/pull/23). Night 2 added Simon's answers and proved every write on a private testnet. Night 3 marked "double" decisions, built Simon's answers to the night 2 questions and checked the app read-only in Hub with real data; Simon's guided real actions come next.

## Baseline at import

- **Upstream:** [Qortal/Q-Mintership-Alpha](https://github.com/Qortal/Q-Mintership-Alpha) branch `Nominations` at `cb6fcef` (2026-06-04, 95 commits), version label `v3.0.5b`.
- **Stack:** plain HTML/JS (Mobirise + Bootstrap), no build step, ~28.7k lines in 7 files. Kept in `apps/Q-Mintership+/legacy/` for reference (`git mv`, history kept).
- **Original theme (Hub 2.0, "Q-Mintership Classic"):** the `--qm-*` palette of `legacy/assets/css/forum-styles.css`, in `src/theme/classic.ts`.
- **i18n:** no. **Tests:** none. **Build:** none (static files).
- **QDN services:** BLOG_POST, MAIL_PRIVATE, FILE_PRIVATE, FILE, DOCUMENT.

## Notes

- **Decided (Simon, 2026-10-12): a new, simpler process**, in `src/` from scratch, replacing the scaffold's port of the old boards. The plan that decided it is Simon's; the facts it rests on were checked against Qortal Core 6.1.4–6.1.9, Qortal Hub's source and a mainnet node, and are pinned by tests here.
- **No votes, no polls, no threshold feature.** Changing MINTER's approval percentage is not possible in today's Core (the group's owner is the null account, and its `UPDATE_GROUP` would need that owner). Simon decided the app offers nothing for it, not even an advisory vote, until Core can apply such a change. A Core change is a separate track.
- **A clean break from the old cards and polls.** What happens on chain (invite, approvals, join) works in every app; the old cards, polls, comments and AR cards stay readable in History.
- **Added by Simon (2026-10-13), built on night 2:** Reject, Withdraw my signature and Considering; safeguards for the admin-count trap; who may propose admin changes; comments; a shareable link for every decision and nomination; "Propose nomination"; notifications. Every write is proven on a private testnet (see Testnet).

## The new process

| Step | Who | What happens | On chain |
|---|---|---|---|
| 1. Propose nomination | any **MINTER member at level 5+**, or any Minter Admin | Nominators look for people who'd make good minters and reach out; Nominations → **Ready to mint** lists those who asked to join. **Propose nomination**: pick the candidate by name or address, write a short reason and optional `qortal://` links. Blocked: self-nomination, current members, banned accounts, anyone with an open nomination (support it instead). | A small QDN **nomination** record (see Data contract) |
| 2. Accept (nominee, recommended) | the candidate | "Accept your nomination" sends **JOIN_GROUP** (0.01 QORT), so approval later makes them a member at once. The app explains the fee, and what to do with a 0 balance. Already done if they showed they're ready to mint. | JOIN_GROUP → join request |
| 3. First signature | the first Minter Admin who signs | Creates the GROUP_INVITE (txGroupId 694) and their own GROUP_APPROVAL, two Hub confirmations shown as one guided step. **The clock starts here.** | GROUP_INVITE + GROUP_APPROVAL |
| 4. Signatures | other Minter Admins | **Sign**, **Reject**, or do nothing and let it expire. An admin who signed can **Withdraw my signature (counts as a rejection)**, and one who rejected can still sign later: only each admin's latest answer counts. An admin can also mark a decision, or a nomination waiting for its first signature, as **Considering** ("I've looked at this, not sure yet"); one whose latest answer is a rejection can mark it as **Reconsidering**. A ring shows `k of n` and a countdown. Answers show at once as "Signed ✓ (confirming…)", "Rejected (confirming…)" or "Withdrawn (confirming…)", and settle once they are in a block. | GROUP_APPROVAL (approval true for Sign, false for Reject and Withdraw); Considering is a QDN record |
| 5. Done | Core | At the threshold Core applies it by itself: the nominee is in (or, with no join request, gets "Join now"). With as many rejections Core ends it as REJECTED; signatures are counted first, so with enough of both it is approved. Otherwise it expires. Either way they can be nominated again. | automatic |

- **Ready to mint, before any nomination:** anyone not in MINTER (newcomers and former members who left or were kicked) can press "Show you're ready to mint" on Home. A short self-check comes first: three boxes (own node synced and online, a minting key once in, the request can't be withdrawn), the 0.01 QORT fee against the confirmed balance, and an optional registered name. Then it sends the same JOIN_GROUP as Accept. Nominators find them on Nominations → Ready to mint, and an approved nomination makes them a member at once. The self-check's answers are not published or saved.
  - Rows of people who were in MINTER before say so under their level: "Former member: left MINTER on …", "Former member: removed from MINTER on …" (a kick), "Former member: banned, ban ended on …" (a timed ban of up to 24 days, counted from its proposal as Core records it), "Former member: banned on …, ban ended" (a permanent ban, or one longer than 24 days, no longer in force) or "Former member: ban lifted on …" (only when the lift came before a timed ban ran out). A declined join request is never a removal. The person page and the former member's Home say the same.
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

- **JSON** is Core's validated service for small JSON (valid JSON, at most 25 KB).
- One identifier per nominee: a publisher has at most one nomination and one support per person; publishing again replaces it (and restarts that nomination's waiting window).
- **`key`** is what a Considering record or a comment is about: the first 40 characters of the pending transaction's signature for a decision, or the nominee's address for a nomination still waiting for its first signature. `id` is 6 letters or digits. Identifiers stay within QDN's 64 characters (at most 59).
- **Nothing in a record is trusted on its own.** The publisher comes from the QDN search row, and is re-checked on every read: a MINTER member at level 5+, or a Minter Admin, at the time of reading. Records that fail (an ineligible publisher, a self-nomination, a malformed body, an identifier that doesn't match the body) are ignored. Builders and parsers: `src/data/records.ts` and `src/data/commentRecords.ts`, pinned by tests.
- **Considering** counts only from a current Minter Admin who can sign (the null owner left out). A decision's record must carry the whole pending signature, whose first 40 characters are the key; a waiting nomination's must carry the nominee address that is the key. Each admin's latest publish wins; "No longer considering" publishes the record again with `cleared: true`, because QDN can't delete; a later Sign, Reject or Withdraw on chain by the same admin hides it, and a record published after the admin's latest answer shows until their next one (Reconsidering). A nomination's record carries over to its invite once the first signature lands, if it was published in this round. Selection: `src/rules/considering.ts`.
- **Comments:** an edit or a deletion republishes the same identifier, and the newest version wins. A deleted comment keeps its place and shows "Deleted", so its replies still make sense. A reply's `replyTo` is the identifier it answers; threads are one level deep, and a reply to a reply shows under the first comment, saying whom it answers.
- **Hides:** one admin's hide identifier is the same for one comment each time, so hiding and showing again republish one record. Per comment, the newest hide counts, and only when the name that published it belongs to a Minter Admin at the time of reading.

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
| Comment, reply, edit, delete; hide or show again (Minter Admins) | `PUBLISH_QDN_RESOURCE { name, service: 'JSON', identifier: qmp-comment-… or qmp-hide-…, data64 }` (`publishCommentRequest`) |

- **A proposal and its proposer's signature** (`proposeAndSign` in `src/writes/flows.ts`): the kick, ban, admin change, lift or cancellation above, then, once the node knows it and only when the proposer is a Minter Admin, `SIGN_TRANSACTION` on it as for Sign. If the proposal goes through and the signature doesn't, the proposal waits in the queue like any other.
- **Ready to mint adds no QDN data:** it is MINTER's join request on chain.
- `inviteTime` 864000 is what the original app sends; Hub refuses 0.
- Hub has no GROUP_APPROVAL action, so the bytes are built here. Tests rebuild three mainnet approvals byte for byte (and the rejections with only byte 176 changed), and `npm run test:decode` sends built approval and rejection bytes to a node's read-only `POST /transactions/decode?ignoreValidityChecks=true` (it only parses; nothing is stored or broadcast).
- **Before every write** the app re-reads the chain (`src/writes/guards.ts`): still pending, still an admin, not already signed, not too late to count, no duplicate waiting, no stored invite, the fee balance, and Core's limit of 25 unconfirmed transactions per account. Hub hides Core's reason when SIGN_TRANSACTION fails validation, so these checks come first.
  - Reject and Withdraw make the same checks as Sign, then check the admin's own answers: Reject goes only to an admin with no answer yet (one who signed is pointed to Withdraw); Withdraw only to an admin whose signature is in a block, while a withdrawal can still count. Nothing new is sent while one of the admin's answers is still on its way.
  - Admin changes: the rules above (`guardAddAdmin`, `guardRemoveAdmin`), and the owner account can't be proposed for removal.
  - Decline (`guardDecline`): only for an account with a MINTER join request that isn't a member; refused for Minter Admins and the owner, for an account that never asked, for a member ("To remove them, use Remove a member."), and while a kick, a decline or a nomination's signatures about them are waiting.
  - Considering: the publisher must be a Minter Admin with a registered name, and the decision still pending and in time (or the nomination still waiting). Clearing is always allowed.
- **After Hub's 30-second timeout** the app does not offer Retry at once: Hub keeps its dialog up for 60 s and still applies a late Accept, so the app looks for the transaction for about a minute first (`src/writes/runner.ts`). The lookup matches an answer's approval flag, so a rejection is never taken for a signature or the other way round.
- **After a write** the answer shows at once ("Signed ✓ (confirming…)"); the live views (queue, nominations, chain tip, own status) refresh every 15 s, still paused while the app is hidden, until the transaction is in a block, then reload once and settle. A Considering publish re-reads only who is considering.

### Hub requests that aren't writes (no fee)

| Request | When |
|---|---|
| `SHOW_ACTIONS` | once a session, on Settings, to check whether Hub offers alerts |
| `NOTIFICATION_GET` | on Settings, to read whether alerts are on |
| `NOTIFICATION_PERMISSION`, then `NOTIFICATION_ADD { notifications }`, then `NOTIFICATION_REMOVE { notificationIds }` | only when you turn alerts on (the last drops rules that no longer fit your role) |
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
| Ready to mint (Nominations) | the join requests above less members, admins and bans in force (reads the nominations already make), in Core's order, 20 rows at a time; each row's account, name and MINTER history only once it is shown, 6 at a time, kept 10 minutes |
| Ready to mint search | a typed address needs no read; a typed name, once typing pauses: `/names/search?query=…&prefix=true&limit=10`, plus `/names/{name}` only when that page is full without the exact name; cached per query |
| Decisions | `/transactions/pending?txGroupId=694` (also "your proposal is waiting" on Home and one's own page, from the same cached read) |
| A pending or decided invite cancellation's group and invitee (Core's JSON leaves them out) | `/transactions/signature/{sig}/raw`, decoded in `src/qortal/groupTxBytes.ts`, read once per transaction |
| Signatures and rejections | `/transactions/search?txType=GROUP_APPROVAL&confirmationStatus=CONFIRMED&startBlock=…&blockLimit=…` over the blocks the pending ones can have answers in, plus `/transactions/unconfirmed?txType=GROUP_APPROVAL`; joined on `pendingSignature` |
| A decision by its link | `/transactions/signature/{sig}`; while it waits, the Decisions reads above |
| Whose answers counted on a decided decision | the GROUP_APPROVAL search above over that decision's own blocks only, ending before its decision block (at most one window), kept 30 minutes |
| A nomination's rounds | the person's MINTER history (below), reduced to MINTER invites for them |
| Approved admin changes since the target this device saw (Decisions, only when the target changed) | `/transactions/search?txGroupId=694&txType=ADD_GROUP_ADMIN&txType=REMOVE_GROUP_ADMIN&confirmationStatus=CONFIRMED&startBlock=…&blockLimit=…&limit=100`, one search, cached 5 minutes (`src/data/targetChanges.ts`); it starts one window before the last-seen block and never reaches back more than 5 windows (about 6 weeks) |
| The target's past changes (History, Activity) | the cached admins read, the decided and later admin-change reads they already make, and admins' own leaves from MINTER |
| Since your last visit: how decisions that left the queue ended | `/transactions/signature/{sig}`, at most 12, once a session, only when there is an earlier visit; each final outcome kept for the session |
| Tip and block time | `/blocks/last`, `/blocks/byheight/{h}` (1,000 blocks back) |
| Accounts, names, fees | `/addresses/{a}`, `/names/primary/{a}`, `/names/{name}`, `/addresses/balance/{a}`, `/addresses/lastreference/{a}`, `/transactions/unitfee` |
| A person's MINTER history | `/transactions/search?address=…&txType=JOIN_GROUP&…&confirmationStatus=CONFIRMED`, reduced to group 694 |
| Records | `/arbitrary/resources/searchsimple?service=JSON&identifier=qmp-…&prefix=true`, bodies `/arbitrary/JSON/{name}/{identifier}` cached per version; a body that isn't on the node is tried again after 2, 4 and 8 minutes, then every 15 |
| Considering | `searchsimple?service=JSON&identifier=qmp-considering-&prefix=true&reverse=true`, pages of 100, at most 3, one read shared by every card (cached 60 s, refreshed while visible). Bodies only for rows published within the last two signing windows, keyed by a decision still pending or by an address, under a current Minter Admin's name |
| Comment counts | `searchsimple?service=JSON&identifier=qmp-comment-&prefix=true&after=<45 days ago>` (100 a page, at most 3 pages), one search shared by every card. An item that can be older, or a full list, searches `identifier=qmp-comment-<key>-` itself, only once its card is on screen |
| A thread, once opened | `identifier=qmp-comment-<key>-` and `identifier=qmp-hide-<key>-` searches, the bodies of the newest 20 comments (20 more per Show more) and the comments their replies answer, `/names/{name}` per author and per hide publisher; refreshed every minute while open |

The Decisions queue costs about 8 GETs, however many decisions there are (plus one raw read the first time a cancellation is seen, and the shared Considering and comment-count searches). Doubles need no read of their own (they use the admin rows the queue already has). It lists MINTER group changes (groupId 694) as decisions; other pending transactions that wait for MINTER's admins are shown apart, to Minter Admins only, as "Other transactions waiting for Minter Admins", without Sign.

### Device storage (localStorage, per browser)

Every key starts with `qmintershipplus-`. Nothing here is published; a later Settings sync could carry it across devices.

| Key | What |
|---|---|
| `ui-theme` | the theme |
| `motion`, `time-display`, `celebrate`, `activity-window`, `decisions-hide-signed` | Settings: animations, countdowns as time or blocks, the celebration, Activity's window, Hide what I answered (signed or rejected; the key kept its old name, so a device's choice carries over) |
| `since-last-visit` | Home's "Since your last visit" on or off (default on) |
| `last-visit-<address>-<groupId>` | the last visit's snapshot `{ v: 1, at, height, decisions?: [{ signature, kind, subject, height }] (Minter Admins, ≤ 100), nomination?: { decision, state, signed, needed, supporters, publishedAt } \| null (accounts not in MINTER), made?: [{ nominee, decision, state, publishedAt }] (nominators, ≤ 20, added on night 3; older snapshots without it still read) }`, saved whenever the app has new data; the one from before the session is the baseline |
| `seen-target-<groupId>` | the target this device saw last, `{ adminCount, needed, height }`, for "The target changed" on Decisions |
| `muted-names` | names muted in comments, listed in Settings → Muted names with Unmute |
| `last-status:<address>` | the last status Home showed, so the welcome plays once |

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
| rules | 5 | 2 | who may propose admin changes, comments, links |
| bulk (its own) | 5 | 2 | bulk sign and Core's 25-unconfirmed limit |

**How it stays private** (in layers)

1. The node runs under `unshare -rn`: a Linux network namespace with nothing but loopback. It can't reach any peer, mainnet or otherwise. A Unix socket in the testnet home is the only way in.
2. Its settings: `isTestNet`, its own chain config and genesis, its own repository and data folders, ports 24391–24394 bound to 127.0.0.1, a fixed network of one address nobody listens on, Reticulum off, no archive, no auto-update. `GET /peers` shows 0 connected peers.
3. Every write the tools make (`/transactions/process`, QDN uploads) first checks that `GET /admin/info` says `"isTestNet": true`, and refuses otherwise. The tools have no TCP address for a node at all: only the socket.

**The test signer**

`testnet/lib/hub.mjs` answers `qortalRequest` the way Hub does: the same actions with the same payloads (`GET_USER_ACCOUNT`, `INVITE_TO_GROUP`, `KICK_FROM_GROUP`, `BAN_FROM_GROUP`, `CANCEL_GROUP_BAN`, `CANCEL_GROUP_INVITE`, `ADD_GROUP_ADMIN`, `REMOVE_GROUP_ADMIN`, `JOIN_GROUP`, `LEAVE_GROUP`, `SIGN_TRANSACTION` with Core's validity-checked decode first, `PUBLISH_QDN_RESOURCE` with the fee), the same reference, fee and process steps, and Hub's error texts. On demand it behaves like Hub's worst moments: a decline, the 30-second timeout with a late accept, and the generic "Failed to decode transaction"; these are queued per account and group, so scenarios running side by side never take each other's. The signer and its controls take same-origin JSON on a loopback host only, so no other page open in the browser can drive them.

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
| The account explorer modal | Becomes the person page. |

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

## Follow-ups

### Night 3

0. **Build Simon's answers to the night 2 questions** (below: items 3–12, 17, 21, 25, 27, 28), with tests and the screenshot check.
1. **Hub check, read-only, with real data** (docs/HUB-TESTING.md): every screen at the five sizes, touch on, against the original app side by side, with the request log per screen. Not done on night 2.
2. **Then Simon's guided real actions, one at a time:** Simon presses each write in Hub with real accounts; the app's step, Hub's dialog (action, fee, `"approval"`, identifier) and the outcome are checked together before the next one. A comment's publish dialog should match what the step says.
3. A real screen-reader pass: NVDA or JAWS on desktop Hub, TalkBack in GO. Night 2's pass used jsdom, axe and Chromium.

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

### Next-pass ideas

- Settings sync to QDN (like Q-Share+'s `settingsQdn.ts`); the settings, the last-visit snapshot, the seen target and muted names stay in the browser for now.
- Hub's `SHOW_ACTIONS` feature detection, to switch to a GROUP_APPROVAL action if Hub adds one.
- The level spread on Activity reads each member's account on request; a Core endpoint for levels of a group's members would make it one call.
- A Core issue for the fresh-chain start-up (the empty "latest signatures" batch on a chain with no QDN resources), with `testnet/lib/PrimeChain.java` as the workaround it would retire.
- Opt-in Hub alerts for comments and Considering ("someone commented on your nomination"), as both are QDN records.
- Theme kit, for every app: the light themes' off-state switch track is about 2.7:1 (a control's boundary needs 3:1); captions and field helper text are 12 px where docs/DESIGN.md asks 14 px on phones; Hub 3.0 light's success, warning and info colours are 2.4–3.5:1 on paper (this app only uses them beside words); a kit-level focus ring, as docs/DESIGN.md describes.
- The page tests are sensitive to a heavily loaded machine: a vitest `maxWorkers` limit, or longer timeouts on the heaviest page files, for overnight runs.
- Cleanup: DecisionCard's `highlighted` prop and `decisionCardId` anchor are unused now that `?d=` links redirect.
