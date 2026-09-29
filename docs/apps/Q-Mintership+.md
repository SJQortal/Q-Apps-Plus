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

**Phase 1, paused 2026-09-29 (branch `q-mintership-plus/rewrite-phase-1`, WIP commit, no PR yet).**

- `legacy/`: `index.html`, `assets/` and `BACKUP/` moved there with `git mv` (upstream history kept).
- React 19.3 + MUI 9.4 + Vite 8 + TypeScript 5.9 + vitest 5 app at the app root: `package.json`, lockfile, `vite.config.ts`, `tsconfig.*`, `eslint.config.js`, `index.html` with the theme boot snippet and the `/render/APP/<Name>` base handling.
- Theme kit copied in (`src/hub-theme`, `scripts/sync-theme.sh --check` passes); Hub 2.0 is "Q-Mintership Classic" from the legacy `--qm-*` palette (`src/theme/classic.ts`); the four themes switch live in Settings.
- Hub 3.0 shell: navigation rail (icons only below 900 px), bottom bar below 600 px, sticky page header, Home launcher tiles (admin tiles only for admins), Hub `THEME_CHANGED` / `NAVIGATE_TO_PATH` listener, `QDN_RESOURCE_DISPLAYED` reporting.
- Routes: `/`, `/forum[/:room]`, `/minters[/:card[/:section]]`, `/mam[/:card]`, `/stats[/:section]`, `/admin-board[/:card]`, `/tools`, `/account/:id`, `/settings`. Old `#/minter/<card>/<section>`, `#?board=…&card=…` and the old nav hrefs (`MINTERS`, `ADMINBOARD`, …) redirect to these (`src/routes/legacyRoutes.ts`, tested). Boards are placeholders until phase 2; they show which card a deep link points at.
- Settings page: Account (name, address, copy, admin role chips), Appearance (ThemePicker, compact cards), Boards (cards/list default), Forum (first room, NEW markers), About (version `3.0.5-plus.1`, changelog dialog, links to the original app, upstream and this repo).
- Data layer `src/qortal/` ported from `QortalApi.js` as typed modules: `client` (qortalRequest + Core fetch), `util`, `cache`, `account`, `groups`, `qdn` (searchSimple with the three exact legacy query forms, SEARCH_QDN_RESOURCES, fetch/decrypt/publish/files), `search` (Torq-style merge + 3 min TTL cache + paging ceiling, search counter), `polls`, `transactions` (all seven raw-tx builders with the exact payloads, sign + process), `session`. 94 unit tests; every write action is mocked and unregistered actions reject.
- Build: `npm run build` passes. dist 1.1 MB; biggest chunk `react-vendor` 321 KB (102 KB gzip), `mui-core` 278 KB, app 37 KB + Settings 11 KB lazy.

## Follow-ups

### Unfinished when the session was paused (do these first)

1. **8 failing tests in `src/qortal/transactions.test.ts`** (test-side only; the builders themselves post the right payloads). Two causes: (a) `mockFetchRoute('/addresses/convert/', …)` is registered before `mockFetchRoute('/addresses/', …)` in `beforeEach`, and routes are matched newest-first, so the convert call gets the JSON handler; register the `/addresses/convert/` route **after** the `/addresses/` one. (b) The `NOMINEE` constant is 35 characters, so `getAddressInfo` rejects it; use a valid 34-character `Q…` address. Then `npm test` should be 94/94.
2. **One eslint warning** in `src/Routes.tsx` (`react-refresh/only-export-components` because `router` is exported next to `Routes`). Stop exporting `router`, or move it to its own file.
3. **Vite 8 warns `advancedChunks` is deprecated**; switch `vite.config.ts` to `build.rollupOptions.output.codeSplitting` (same `groups` shape) once its typing is confirmed, or drop manual chunking.
4. **Finish the legacy audit.** Three of fourteen reader outputs exist in `apps/Q-Mintership+/audit/` (QortalApi.js, Q-Mintership.js, Shared.js 1–2350), unverified. Read the rest (Shared.js 2300–4546, MinterBoard.js ×4, StatsBoard.js ×2, AdminBoard.js, ARBoard.js, AdminTools.js + BACKUP, index.html + CSS), verify every identifier/JSON shape/transaction against the source, then write the **Audit** section (architecture map, data contract table, Qortal call inventory with the ~21 unlimited searches, performance, UX, bugs) and the **Parity checklist** into this brief. The workflow script from the paused session is reproducible from the prompt in this brief's Rewrite plan: one reader per chunk → skeptic verifiers → synthesis.
5. **`src/qortal/identifiers.ts` is not written yet.** Once the audit is verified, add the identifier builders (forum message/attachment, `Minter-board-card`, `card-MAC`, `QM-AR-card`, comments, polls, `grp-<id>-anc-`, `Q-Mintership-blockedNames`, stats snapshot) with tests, exactly as the legacy builds them.
6. **README `+` section** at the top of `apps/Q-Mintership+/README.md` (what the + version adds, link to upstream) is still to add.
7. **Zip:** `scripts/build-zip.sh Q-Mintership+` was not run yet; it should just work now that `package.json` exists (it builds and zips `dist/`). Check `unzip -l release/Q-Mintership+.zip | head` shows `index.html` at the root.
8. **Open the PR** once 1–2 are green: `gh pr create --base main --title "Q-Mintership+: React rewrite phases 1–2"`, and say in the body that it is not for publishing until the parity checklist is complete.
9. **Phase 2** (read-only boards with paging, old `#` deep links working) has not started. The data hooks belong in `src/data/` on top of `src/qortal/search.ts`; add the test that counts searches on first load (`qdnSearchCount()`).

### Decisions taken (revisit if wrong)

- `react-router-dom` 7 (new app, no v6 migration needed) with `createBrowserRouter` and `basename` from `_qdnBase`; legacy hash routes are redirected, not served. Whether Hub passes a `#` fragment through a `qortal://APP/Q-Mintership+/#/minter/…` link is unknown: test in Hub, and if not, keep generating path links (`/minters/<card>`) for sharing.
- Legacy `searchSimple` defaulted to `limit=1500`; the port defaults to 20 and never sends 0. `countSearchSimple` (the legacy fetch-all count loop) is ported with a page ceiling but should not be used by the new forum, which will page with "load more".
- Core REST reads of group member lists keep `limit=0` in the URL (they are bounded group lists, not QDN searches) but are cached for 60 s.
- `createRemoveGroupAdminTransaction` in the legacy app forgot to `await getAddressInfo` on the no-key path; the port awaits it. Behaviour change only on a path that never worked.
- `getAddressInfo` returns `null` for an invalid address instead of echoing the input string as the legacy did.
- Hub 2.0 fonts: the legacy DM Sans / Space Grotesk variable TTFs are 660 KB, so the Classic theme uses them only if installed and falls back to Inter from the kit. Convert to woff2 subsets later if the look matters.
- Version `3.0.5-plus.1` (legacy label `v3.0.5b`; the brief's `v3.0.2` was the branch's README version).

### Questions for Simon

- Should "Q-Mintership Classic" have a light variant at all? The original is dark only; a light palette was derived (`CLASSIC_LIGHT`).
- Bottom bar on phones holds Home, Forum, Minter Board, Stats, Settings; MAM Board and the admin pages are reached from Home. Fine, or should MAM replace Home?
