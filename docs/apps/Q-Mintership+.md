# Q-Mintership+

Who joins the MINTER group (694), and therefore who mints QORT: nominate, then Minter Admins sign or let it expire.

**Published:** not yet.

**Version on the branch:** `1.0.0` (not published), Q-Mintership+ 2.0, a rewrite on React 19.3 + MUI 9.4. Night 1 is [SJQortal/Q-Apps-Plus#23](https://github.com/SJQortal/Q-Apps-Plus/pull/23). Night 2 proves every write on a private testnet before anyone publishes it.

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

## The new process

| Step | Who | What happens | On chain |
|---|---|---|---|
| 1. Nominate | any **MINTER member at level 5+**, or any Minter Admin | Pick the candidate by name or address, write a short reason and optional `qortal://` links. Blocked: self-nomination, current members, banned accounts, anyone with an open nomination (support it instead). | A small QDN **nomination** record (see Data contract) |
| 2. Accept (nominee, recommended) | the candidate | "Accept your nomination" sends **JOIN_GROUP** (0.01 QORT), so approval later makes them a member at once. The app explains the fee, and what to do with a 0 balance. | JOIN_GROUP → join request |
| 3. First signature | the first Minter Admin who signs | Creates the GROUP_INVITE (txGroupId 694) and their own GROUP_APPROVAL, two Hub confirmations shown as one guided step. **The clock starts here.** | GROUP_INVITE + GROUP_APPROVAL |
| 4. Signatures | other Minter Admins | **Sign**, or do nothing and let it expire. A ring shows `k of n` and a countdown; it updates at once ("Signed ✓, confirming…"). | GROUP_APPROVAL |
| 5. Done | Core | At the threshold Core applies it by itself: the nominee is in (or, with no join request, gets "Join now"). Without enough signatures it expires and can be nominated again. | automatic |

- **Before the first admin signature**, a nomination waits on the open list for at most **10,080 blocks** (an app rule, the length of MINTER's own window), then moves to History.
- **One open nomination per candidate.** Other eligible members add their **support** ("Nominated by X, also supported by Y and Z").
- **No reject or withdraw button.** On chain, "withdrawing" a signature would be a rejection, and rejections count towards ending a nomination. Admins sign, or let it expire; the help text says so.
- **Re-nominations are normal:** 37 of the 48 people whose invites expired were approved on a later nomination.

**Core facts the app follows** (each pinned by a test in `src/rules/`):

- **Signatures needed:** `approvals × 100 ≥ adminCount × 40` for MINTER's PCT40, where `adminCount` includes the null owner (it counts, but can't sign). With 20 admin rows that is **8**. The count is re-read every refresh, because Core re-reads it every block.
- **Only confirmed signatures count**, and only each admin's latest one.
- **The window,** for a decision confirmed at block h: earliest decision h+6, last signature that counts h+10,079, expired at h+10,081. Times come from the measured block time (72.9 s on 2026-10-12, so about 8.5 days), never an assumed 60 s.
- **Joining:** with a join request, the approved invite makes the nominee a member at once; otherwise they press Join. JOIN_GROUP needs 0.01 QORT of confirmed balance.
- **Kicks and bans** go through the same signatures. An admin must lose the admin role before a kick or ban. A ban is permanent or up to 24 days. Kicked members keep their level.
- **Fees:** 0.01 QORT for every group transaction and for the QDN record; the first signature costs two.

## Statuses (the status-tailored Home)

The status engine (`src/rules/status.ts`, loaded by `src/data/me.ts`) resolves the signed-in account, first match wins:

| Status | From | Home shows |
|---|---|---|
| Outside Hub / signed out | no `qortalRequest` / Hub declined the account request | what Mintership is, live MINTER numbers, Sign in |
| Minter Admin | `/groups/member/{a}` admin flag | decisions waiting for you, your activity, stale invites; then the member view |
| Member, level 5+ | membership + `/addresses/{a}` level | you can nominate; your nominations; open ones to support |
| Member, level 0–4 | same | progress to level 5 (618,400 blocks), what level 5 unlocks, minting tips |
| Banned | `/groups/bans/694` (in force) | when; that admins must lift the ban first |
| Approved, not joined | `/groups/invites/{a}` | one step left: Join now |
| Nominated | the person's open nomination (record or pending invite) | who nominated, k of n or "waiting for a Minter Admin", Accept |
| Former member: kicked / left | the address's MINTER history (approved kick, own LEAVE_GROUP) | when; that a new nomination is possible; level kept |
| Not in MINTER yet | none of the above (with or without a name; with or without a join request) | how minting and nomination work; find a nominator; optional name |

## Data contract

### New records (QDN, additive, own prefixes)

| Service | Identifier | Published by | Body |
|---|---|---|---|
| JSON | `qmp-nomination-<nomineeAddress>` | the nominator, under their name | `{ v: 1, nomineeAddress, nomineeName?, reason (20–600 chars), links: qortal:// only (≤ 5), createdHeight?, created? }` |
| JSON | `qmp-support-<nomineeAddress>` | a supporter | `{ v: 1, nomineeAddress, note? (≤ 280) }` |

- **JSON** is Core's validated service for small JSON (valid JSON, at most 25 KB).
- One identifier per nominee: a publisher has at most one nomination and one support per person; publishing again replaces it (and restarts that nomination's waiting window).
- **Nothing in a record is trusted on its own.** The publisher comes from the QDN search row, and is re-checked on every read: a MINTER member at level 5+, or a Minter Admin, at the time of reading. Records that fail (an ineligible publisher, a self-nomination, a malformed body, an identifier that doesn't match the body) are ignored. Builders and parsers: `src/data/records.ts`, pinned by tests.

### Chain writes (all through Hub; the app never POSTs to the node)

| Action | Hub request (`src/writes/hubActions.ts`, pinned by tests) |
|---|---|
| First signature | `INVITE_TO_GROUP { groupId: 694, inviteeAddress, inviteTime: 864000, txGroupId: 694 }`, then the admin's own approval (below) |
| Sign | `SIGN_TRANSACTION { unsignedBytes, process: true }` with GROUP_APPROVAL bytes built in the app (`src/qortal/approvalBytes.ts`: type 33, txGroupId 0, approval 1) |
| Accept nomination / Join now | `JOIN_GROUP { groupId: 694 }` |
| Kick | `KICK_FROM_GROUP { groupId: 694, qortalAddress, reason, txGroupId: 694 }` |
| Ban | `BAN_FROM_GROUP { groupId: 694, qortalAddress, reason, banTime: 0 or ≤ 2,073,600 s, txGroupId: 694 }` |
| Lift a ban | `CANCEL_GROUP_BAN { groupId: 694, qortalAddress, txGroupId: 694 }` |
| Cancel an approved invite | `CANCEL_GROUP_INVITE { groupId: 694, qortalAddress, txGroupId: 694 }` |
| Add / remove a Minter Admin | `ADD_GROUP_ADMIN` / `REMOVE_GROUP_ADMIN { groupId: 694, qortalAddress, txGroupId: 694 }` |
| Nominate / support | `PUBLISH_QDN_RESOURCE { name, service: 'JSON', identifier, data64 }` |

- `inviteTime` 864000 is what the original app sends; Hub refuses 0.
- Hub has no GROUP_APPROVAL action, so the bytes are built here. Tests rebuild three mainnet approvals byte for byte, and `npm run test:decode` sends built bytes to a local node's read-only `POST /transactions/decode?ignoreValidityChecks=true` (it only parses; nothing is stored or broadcast).
- **Before every write** the app re-reads the chain (`src/writes/guards.ts`): still pending, still an admin, not already signed, not too late to count, no duplicate waiting, no stored invite, the fee balance, and Core's limit of 25 unconfirmed transactions per account. Hub hides Core's reason when SIGN_TRANSACTION fails validation, so these checks come first.
- **After Hub's 30-second timeout** the app does not offer Retry at once: Hub keeps its dialog up for 60 s and still applies a late Accept, so the app looks for the transaction for about a minute first (`src/writes/runner.ts`).

### Reads (all GET, paged at 100 with a ceiling, deduped, cached)

| Need | Endpoint |
|---|---|
| Settings | `/groups/694` |
| Admins (the threshold's denominator) | `/groups/members/694?onlyAdmins=true` (the paged member list's `isAdmin` is wrong after page one) |
| Members with names | `/groups/members/694?limit=100&offset=…` (7 pages today, only where the whole group is needed) |
| Membership, join request, stored invite | `/groups/member/{a}`, `/groups/joinrequests/address/{a}`, `/groups/invites/{a}` |
| Join requests, stored invites, bans | `/groups/joinrequests/694`, `/groups/invites/group/694`, `/groups/bans/694` |
| Decisions | `/transactions/pending?txGroupId=694` |
| A pending or decided invite cancellation's group and invitee (Core's JSON leaves them out) | `/transactions/signature/{sig}/raw`, decoded in `src/qortal/groupTxBytes.ts`, read once per transaction |
| Signatures | `/transactions/search?txType=GROUP_APPROVAL&confirmationStatus=CONFIRMED&startBlock=…&blockLimit=…` over the blocks the pending ones can have signatures in, plus `/transactions/unconfirmed?txType=GROUP_APPROVAL`; joined on `pendingSignature` |
| Tip and block time | `/blocks/last`, `/blocks/byheight/{h}` (1,000 blocks back) |
| Accounts, names, fees | `/addresses/{a}`, `/names/primary/{a}`, `/names/{name}`, `/addresses/balance/{a}`, `/addresses/lastreference/{a}`, `/transactions/unitfee` |
| A person's MINTER history | `/transactions/search?address=…&txType=JOIN_GROUP&…&confirmationStatus=CONFIRMED`, reduced to group 694 |
| Records | `/arbitrary/resources/searchsimple?service=JSON&identifier=qmp-…&prefix=true`, bodies `/arbitrary/JSON/{name}/{identifier}` cached per version |

The Decisions queue costs about 8 GETs, however many decisions there are (plus one raw read the first time a cancellation is seen). It lists MINTER group changes (groupId 694) as decisions; other pending transactions that wait for MINTER's admins are shown apart, to Minter Admins only, as "Other transactions waiting for Minter Admins", without Sign.

### Legacy reads (History, read-only)

The original app's data stays readable: nomination cards (`BLOG_POST` `Minter-board-card-*`), their polls (`<card>-poll`) and comments (`comment-<card>-*`), and AR cards (`QM-AR-card-*`). The admin board (`MAIL_PRIVATE` `card-MAC-*`) is encrypted to admins: History links to the original app for it. Old deep links (`#/minter/<card>/<section>`) open the card in History.

## Dropped, and why (CLAUDE.md rule 6)

Agreed with Simon (2026-10-12):

| Feature of the original | Why |
|---|---|
| Forum (rooms, replies, attachments) | Not part of deciding mintership; Q-Chat and Q-Mail cover discussion. Old forum links open Home. |
| Polls and voting on cards | Replaced by the process above: only Minter Admins' signatures decide on chain, and polls duplicated them. |
| The notification broadcast modal after every action | Friction after every vote, comment and approval; in-app state replaces it (Hub alerts are a night-2 idea). |
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

## Follow-ups

### Night 2 (must)

1. **Private testnet end to end** for every write: from Core's `testnet/` folder, on its own data directory, ports and keys, never peering with mainnet (its `testchain.json` has `nullGroupMembershipHeight 0` and short delays, so expiry can be watched in minutes). A dev-only test signer drives the app's real write paths. Never commit test keys; never load mainnet keys. Prove at least: nominate → accept → first signature (invite + own approval, including signing the invite while it is still unconfirmed) → signatures → approval → member; the same without a join request (Join now); expiry; kick (and the "remove admin first" path); ban and lift; add/remove admin; cancel a stale invite; bulk sign; a Hub timeout followed by the lookup.
2. **Hub check, read-only,** at the five sizes with real data, against the original app (docs/HUB-TESTING.md). Not done on night 1; `npm run test:live` covered the data layer against mainnet instead.
3. Notifications (in-app, optional Hub alerts), and the optimistic states and animations checked against real confirmations on the testnet.

### Questions for Simon

1. **Wording on the bottom bar:** "Nominees" (Nominations doesn't fit 72 px at 360). OK?
2. **Classic light colours:** the light accents are darker shades of the original (teal `#186d64`, gold `#8b6016`) so text and buttons pass 4.5:1. OK?
3. **Stale invites:** invites approved in the last 30 days are listed but left out of "Propose cancelling all", since those people may still press Join. Is 30 days right, and should Home count only those older invites?
4. **Proposals and their creator's signature:** proposing a kick, ban or admin change does not chain the proposer's own signature (the first signature of a nomination does); the dialog tells them to sign it in the queue. Chain it too?
5. **Reasons:** a reason is required for kicks and bans (Core doesn't need one; capped at Core's 128 bytes). Keep it required?
6. **Signing an unconfirmed decision:** Sign is offered only once a decision is in a block (the first signature signs its own invite while unconfirmed, which night 2 proves on the testnet). Offer Sign earlier too?
7. **Cancel one invite directly:** Propose offers kick, ban, admin changes and lifting a ban; cancelling an approved invite is only in the stale-invite clean-up. Add it to Propose?
8. **"Other transactions waiting for Minter Admins":** pending transactions with MINTER's approval that aren't MINTER group changes are listed apart, admins only, without Sign ("This isn't a MINTER group change, so it can't be signed here."). Wording OK?
9. **Activity counting:** open decisions count for an admin only once they sign them; the median time to sign leaves out decisions the admin proposed; "missed" = expired while they were an admin, neither signed nor rejected; a signature landing after the last useful block is not counted; confirmed cancellations count as MINTER's without decoding each one (one GET each). Agree with each?
10. **Activity's 180-day window** re-reads the whole range on each forced refresh; caching settled blocks and re-reading only the tail would save GETs. Worth it?
11. **History:** proposals still collecting signatures are left out of the group History (they're in Nominations and Decisions); a person's own timeline shows them. Old cards whose poll isn't the publisher's are listed (the original app hid them) and noted on the card page. A person page reads the newest 40 old cards plus that person's own, with "Search older cards". OK?
12. **Minting tips and where to find a nominator:** the copy is generic ("check in Hub that your minting key is active on your node"; "ask in Q-Chat or on open nominations"). Is there exact wording for Hub's and GO's minting screens, or an official MINTER chat group to point to?
13. **The welcome to new minters** is remembered per device; someone who never opened Home while nominated won't see it. Fine?
14. **History hygiene:** done on 2026-10-13. The branch history was rewritten once, with your OK, to drop a Claude attribution trailer from the old scaffold commit and to reword a few comments. The superseded branch `q-mintership-plus/rewrite-phase-1` on GitHub still has that scaffold commit with its trailer: delete it?

### Next-pass ideas

- Settings sync to QDN (like Q-Share+'s `settingsQdn.ts`); the settings stay in the browser for now.
- Hub's `SHOW_ACTIONS` feature detection, to switch to a GROUP_APPROVAL action if Hub adds one.
- The level spread on Activity reads each member's account on request; a Core endpoint for levels of a group's members would make it one call.
