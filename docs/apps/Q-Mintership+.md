# Q-Mintership+

Forum and admin boards for the Qortal minting group: minter cards, nominations, polls, admin approvals.

## Baseline at import

- **Upstream:** [Qortal/Q-Mintership-Alpha](https://github.com/Qortal/Q-Mintership-Alpha) branch `Nominations` at `cb6fcef` (2026-06-04, 95 commits)
- **Stack:** Plain HTML/JS (Mobirise + Bootstrap), no build step. `index.html` + `assets/`. Being rewritten in React (plan below)
- **Original theme (becomes Hub 2.0):** `assets/css/`, `assets/theme/css/style.css` (Mobirise)
- **i18n:** no
- **Tests:** none
- **Build:** none (static files)
- **QDN services:** BLOG_POST, MAIL_PRIVATE, FILE_PRIVATE, DOCUMENT
- **Identifiers seen (partial; complete this in the audit):** `mintership-forum-message`, `mintership-forum-attachment`, `card-MAC`, `QM-AR-card`, `grp-`, `Q-Mintership-blockedNames`, `_mail_qortal_qmail_`
- **Qortal calls (counts in source):** FETCH_QDN_RESOURCE ×15, SIGN_TRANSACTION ×8, PUBLISH_QDN_RESOURCE ×8, SEARCH_QDN_RESOURCES ×4, CREATE_POLL ×3, VOTE_ON_POLL ×2, JOIN_GROUP ×2, ENCRYPT_QORTAL_GROUP_DATA

## Notes

- This uses upstream branch **`Nominations`** (v3.0.2, 2026-06-04, crowetic), which is 14 commits ahead of `main` and has the new look and the nominations board.
- **Has ~21 `limit: 0` (unlimited) searches**, the heaviest in the repo and the biggest efficiency win.
- Group approvals use `SIGN_TRANSACTION` for group admin actions. Keep those exact.
- **Decided: rewrite in React** (Simon, 2026-09-29), on the same stack as every other app (React 19.3, MUI 9.4, Vite, TypeScript, vitest). Upstream's own README names a React + TypeScript + qapp-core rewrite as its long-term goal. See **Rewrite plan** below.
- `BACKUP/removedFromMinterBoard.js` is upstream's parked code; keep it with the legacy files for reference.

## Rewrite plan (React 19.3 + MUI 9.4)

The current app is ~28.7k lines of plain JS in 7 files (~650 functions):

| File | Functions | What it does |
|---|---|---|
| `MinterBoard.js` | ~200 | Nomination cards, comments, votes, optimistic publishing, invite status |
| `StatsBoard.js` | ~130 | Stats snapshots, leaderboards, compile/publish of stats |
| `Shared.js` | ~130 | Rich text, sanitising, comments, shared UI |
| `QortalApi.js` | ~65 | Every Qortal call, caches |
| `Q-Mintership.js` | ~55 | Forum rooms, routing (`#` hash routes), attachments |
| `AdminBoard.js` | ~45 | Encrypted admin cards and comments |
| `ARBoard.js` | ~20 | Add/remove Minter Admin proposals |
| `AdminTools.js` | ~6 | Block list, pending invites, manual invite |

**Ground rules for the rewrite**
- **Data first:** every identifier, service, JSON shape, encryption call and transaction stays byte-compatible, so the old app and the + app show the same boards. That covers `ENCRYPT_QORTAL_GROUP_DATA` for admin data, `SIGN_TRANSACTION` for `GROUP_INVITE`, `GROUP_APPROVAL` and `JOIN_GROUP`, and `CREATE_POLL` / `VOTE_ON_POLL`. Write the full data contract into the Audit section before any UI work.
- **Parity checklist:** before coding, list every user-facing feature of the old app (from the table above and by clicking through it). Tick each item off as the React version reaches it. Nothing is dropped silently.
- **Legacy stays for reference:** `git mv index.html assets BACKUP legacy/` in the first rewrite commit. The React app lives at the app root (`package.json`, `src/`, `index.html`), and `build-zip.sh` then uses the normal build path. Upstream updates land in `legacy/` through git's rename detection when merged with `scripts/sync-upstream.sh`; port behaviour changes into the React app by hand.
- **Routes:** keep the old `#` hash routes (e.g. deep links to a board card) working, or redirect them, so existing links in chat and forum posts still open the right card.
- **Efficiency:** the ~21 unlimited searches become paged, merged, cached queries (docs/QORTAL.md). Add a test that counts searches on first load.
- **qapp-core is optional:** a typed `qortalRequest` client plus the Torq-style search cache is enough. If you use qapp-core, apply the MUI 9 workaround in docs/PLATFORM.md.
- **Never call write actions from tests.** Mock every one of them: publish, sign, invite, approve, vote, join.

**Phases:** each phase is its own PR, and each ends with a working, zippable app.
1. **Scaffold + data layer:** Vite/React/MUI 9 app with the theme kit, the Settings page and a vitest harness. Port `QortalApi.js` to typed modules with unit tests, and write the data contract and parity checklist.
2. **Read-only boards:** Forum rooms, Minter Board (cards, comments, votes, invite status, list/card views), AR Board and Stats Board: viewing, paging, search and deep links.
3. **Write flows:** publish and edit cards, comments with attachments, voting, polls, nominations, and optimistic updates.
4. **Admin side:** encrypted Admin Board, AR proposals, Admin Tools (block list, pending and manual invites), invite and approval transactions, and the account details explorer.
5. **Redesign and features:** the Hub 3.0 layout polish plus the upstream roadmap items (nominator statistics / "best nominator"), then retire `legacy/` from the zip.

Once phase 1 lands, `scripts/build-zip.sh Q-Mintership+` builds the React app. **Don't publish Q-Mintership+ until the parity checklist is complete.** Until then, people keep using the original Q-Mintership, and phase zips are only for testing in Hub Dev Mode (preview).

## Feature ideas to weigh in the audit

- paged boards (no unlimited loads)
- card status at a glance
- nomination and vote progress
- search within boards

## Audit

_To fill in: architecture map, full list of QDN services and identifiers, every Qortal call and when it fires, performance hotspots, UX problems, bugs found. Rank each by impact._

## Plan

_To fill in: this pass's scope (theme kit and Settings, top efficiency fixes, top UX fixes, 2–4 features), plus anything deliberately deferred._

## Done

_To fill in: what changed, with before/after numbers (searches on first load, biggest chunk, dist size)._

## Follow-ups

_To fill in: open questions for Simon, and ideas for the next pass._
