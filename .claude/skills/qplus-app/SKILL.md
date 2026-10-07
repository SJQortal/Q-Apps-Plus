---
name: qplus-app
description: Build one Q-Apps+ app to the Q-Share+ standard, in rounds — platform upgrade to React 19.3 + MUI 9.4, audit, theme kit and Settings, efficiency, mobile-first redesign and features, screenshot check, quality, a Hub Dev Mode check with real data, Simon's requests, and release. For Q-Mintership+ it drives the phased React rewrite. Use when asked to redesign, upgrade, audit, test in Hub or "do" an app in apps/ (e.g. "do Q-Mail+", "run the next round on Names+").
---

# Building a + app to the Q-Share+ standard

**Q-Share+ is the reference.** It was published as 1.0.0 on 2026-09-30 after six rounds, and its brief, `docs/apps/Q-Share+.md`, shows what every section looks like when it's done. When in doubt, do what Q-Share+ did, and read its code before writing your own (its parts are listed under Round 2).

Work on one app per session. Write findings into `docs/apps/<App+>.md` as you go, so the brief is always current and the next session can pick up where you stopped. A session may cover several rounds. Record each round as its own subsection under **Done**.

## The rounds

| Round | Where | What it adds | Ends with |
|---|---|---|---|
| 1. Foundation | cloud or local | baseline, platform upgrade, test harness, theme kit + Settings, audit, efficiency, layout | checkpoint PR, then a working redesign |
| 2. Features and phone | cloud or local | data writes pinned by tests, the phone shell, the obvious missing features, screenshot config | the screenshot check passing at all five sizes |
| 3. Quality | cloud or local | accessibility (axe), contrast, Settings sync, changelog, README, a review of the whole diff | 0 axe violations, review findings fixed |
| 4. Hub check | **local only** | every screen with real data in a test Hub, the Hub & GO pitfalls, measured call counts, an audit against Hub's source | the Hub check section in the brief |
| 5. Simon's requests | local | what Simon asks for after trying the app | his requests done and checked in Hub |
| Release | Simon + local | version, Published line, README merge-back section, PR merged | the zip Simon publishes |

Cloud sessions can't reach Hub, so they do rounds 1–3 and leave round 4 for a local session. **Never call an app finished before its Hub check:** most of Q-Share+'s serious bugs only showed up there.

## Done means (the Q-Share+ bar)

An app is ready for Simon to publish when all of this is true, and the brief records it:

- [ ] **Stack:** React 19.3 + MUI 9.4 in their own commits. `npm run build`, `npm test` and `npm run lint` pass, and so does `scripts/sync-theme.sh --check`.
- [ ] **Data:** the data contract is in the brief, and every write (publish payloads, identifiers, JSON shapes) is pinned by tests to the original app's format. New data is additive only (CLAUDE.md rule 1).
- [ ] **Efficiency:** no `limit: 0`, every list paged, searches deduped and cached, media lazy, polling polite, heavy screens code-split. There's a table of measured calls on first load for each main screen, before and after.
- [ ] **Look:** four themes, Hub 2.0 = the original look, and a Settings page (Account, Appearance, the app's own sections, Sync, About with changelog), following docs/DESIGN.md.
- [ ] **Phone:**
  - every point in docs/DESIGN.md → Mobile: a bottom bar with 5 or fewer items, a floating main action (not in landscape), a header that hides on scroll, sheets and full-screen dialogs, forms that stay usable above the keyboard, 44 px targets, safe areas, the Hub frame's height, and a compact landscape layout;
  - plus pull-to-refresh where it feels natural.
- [ ] **Screenshot check:** `scripts/screens.mjs <App+>` in all four themes at all five sizes shows 0 console errors, 0 sideways overflow, 0 unlabelled buttons and 0 axe violations.
- [ ] **Hub check:**
  - every main screen with real data in a test Hub, at 1440, 700, 390×844 touch, 360×740 touch and 844×390 touch;
  - Hub's light/dark switch;
  - each Hub & GO pitfall in docs/QORTAL.md checked;
  - Qortal calls counted with `hub-cdp.mjs requests` and `calls`;
  - the same data showing as in the original app.
- [ ] **Review:** a final review of the whole diff, by dimension (correctness, data compatibility, efficiency, mobile/UX, accessibility, security), with each finding verified before it's fixed.
- [ ] **Paperwork:** the brief follows the template below; the README has its + section; there's a CHANGELOG and a version; Follow-ups lists numbered questions for Simon.

## Round 1: foundation

**Overnight mode** (the prompt says so, or Simon is asleep): reach a publishable checkpoint first, so there's a working app even if the session stops early. The checkpoint is: branch → baseline → platform upgrade → test harness → theme kit + Settings with four themes. `npm run build`, the tests and `scripts/build-zip.sh <App+>` must pass. Then push and open the PR, with "Checkpoint reached" in its body, and **push after every commit** from then on. Never leave the branch with a failing build, and revert anything you can't finish.

1. **Load context.** Read CLAUDE.md, docs/PLATFORM.md, docs/MIGRATION-NOTES.md, docs/DESIGN.md, docs/QORTAL.md (including the pitfalls), `shared/hub-theme/README.md`, the app's brief, and docs/apps/Q-Share+.md. Skim the matching Torq files in `shared/reference/torq/`.
2. **Baseline.** Work on the app's branch (CLAUDE.md → Git). Run `cd "apps/<App+>" && npm ci && npm run build`, then record the dist size and the biggest chunk. If the baseline fails, fix only what's needed to build, in its own commit.
3. **Platform upgrade.** Follow "How each app upgrades" in docs/PLATFORM.md: dependencies, codemods, `scripts/check-mui-icons.sh <App+>`, type errors. Commit it on its own (`<App+>: upgrade to React 19.3 and MUI 9.4`). **Then open the app in a browser or Hub before going on.** A green build isn't enough: React 19 has blanked apps at runtime (an audio player in Q-Shop+).
4. **Harness.** vitest + jsdom + a `qortalRequest` mock that answers by action (docs/QORTAL.md → Testing).
5. **One place for + specifics.** Keep the app's name, the name used in copied `qortal://APP/…` links, the storage prefix, the settings-sync identifier and the repo links in one module (e.g. `src/constants/plus.ts`), so the upstream "Ship as" commit stays small (docs/RELEASE.md).
6. **Theme kit + Settings.** Run `mkdir "apps/<App+>/src/hub-theme" && scripts/sync-theme.sh`, then follow the kit README. Never edit the copied files. Build Hub 2.0 from the app's old theme. If the kit needs a change, make it in `shared/hub-theme` and commit it as `Repo: …`.
7. **Audit.** Read the whole app, not a sample, and fill in the brief's Audit:
   - architecture map;
   - **data contract** (binding; finish it before any data change);
   - Qortal call inventory: every `limit: 0`, poll, N+1 and uncached repeat, plus the searches on first load;
   - performance: chunks and what's in them;
   - UX problems;
   - bugs, with file:line;
   - missing features.
   Rank each finding by user impact × effort.
8. **Plan.** Write the rounds you intend into the brief's Plan. Defer anything risky (money, names or encryption code; major rewrites) to Follow-ups with a reason. Don't stop for approval.
9. **Efficiency and layout.** Do the top efficiency fixes with measured numbers, then the Hub 3.0 layout of the main screens, mobile-first.

Q-Mintership+ is rewritten instead: follow the phased Rewrite plan in its brief instead of steps 3 and 9. Each session does one phase and ends with a working app and a PR.

## Round 2: features and the phone shell

- **Pin data writes first.** Before touching a publish flow, write a pure payload builder and tests that pin it to the original resource shapes (Q-Share+ `utils/publishPayload.ts`).
- **Reuse Q-Share+'s parts.** If `shared/qplus-kit/` exists, install it the way the theme kit is installed. Otherwise read the Q-Share+ file and adapt it; don't import across `apps/`.
  - phone shell: `components/common/mobile/BottomSheet.tsx` and `ResponsiveDialog.tsx`, `components/layout/BottomNav/`, `components/layout/Navbar/useHideOnScroll.ts`, and the hooks `usePhoneLayout`, `useVisualViewport`, `usePullToRefresh` and `useSafeBack`, plus `utils/hubFrame.ts`;
  - names: `NameSwitcher.tsx` (search above 15 names), `NameAvatar.tsx` (loads only in view), `NameSuggestField.tsx` with `utils/nameSearch.ts`;
  - Qortal: `utils/qdnSearch.ts` (paged, deduped, cached), `utils/hubErrors.ts` (declines in 12 languages), `utils/qortalLinks.ts` (deep links with `+`), `utils/settingsQdn.ts` (Settings sync), `hooks/useFileOnNode.ts`;
  - states and extras: `EmptyState.tsx`, `PageRetry.tsx`, `ErrorBoundary.tsx`, `ChangelogDialog.tsx`, `ClearFieldButton.tsx`, `ListViewToggle.tsx`, `utils/zip.ts`.
- **Features.** Build the obvious missing features from the audit, most valuable first. Use local-only state (localStorage/IndexedDB) where you can, and new QDN data only with its own prefix.
- **Screenshot config.** Copy `apps/Q-Share+/e2e/screens.config.mjs` to the app, with fixtures that cover the app's real cases (long titles, names with `+` and spaces, empty and error states). Run `scripts/screens.mjs <App+>` and fix what it reports. Record the matrix in the brief.

## Round 3: quality

- Get to 0 axe violations with `scripts/screens.mjs` (axe-core as a dev dependency), and 4.5:1 contrast in all four themes. Kit colour changes are `Repo:` commits.
- Add Settings sync (Torq's and Q-Share+'s `settingsQdn.ts`), a changelog dialog, and the README's + section.
- Review the whole diff by dimension, verify each finding before fixing it, and fix the confirmed ones one commit at a time.

## Round 4: the Hub check (local sessions only)

Follow docs/HUB-TESTING.md: a test Hub next to the normal one, the app's dev server through the node's dev proxy, and `scripts/hub-cdp.mjs`.

1. **Find real test data** with read-only GETs on the node (`/arbitrary/resources/search`, `/names/…`): items of every kind the app shows, odd names (spaces, `+`, `/`, non-ASCII), long threads, and deleted or unreachable items.
2. **Walk every screen** at the five sizes (`size` with `--touch` for the phones), in four themes and in Hub light and dark. Count calls with `requests` and `calls`, and compare with the original app in a second tab (`qortal://APP/<Original>`).
3. **Check every Hub & GO pitfall** in docs/QORTAL.md.
4. **Audit against Hub's source.** Read how Hub handles the requests the app uses: `/home/simon-james/Desktop/Qortal GO/Qortal-Hub`, read only. Look at timeouts, error texts, public-node behaviour and encoding. Verify each finding before fixing it.
5. **Fix, then re-test in Hub.** Finish with the review from round 3 over the new commits.
6. **Writes need Simon.** Ask before anything that publishes, sends, saves to QDN or spends QORT, even on Tester GO. Hub shows its own confirmation too. Saves to disk through Hub's prompt are fine.

Record it in the brief as Q-Share+ did (its "Hub Dev Mode check" section):

- how the app was driven;
- screens, sizes and calls measured;
- what was found and fixed, one line each;
- the exact result of any open question;
- what still "needs a phone (GO)".

## Round 5: Simon's requests

Simon tries the app in Hub and asks for changes. Build them, check them in Hub at the five sizes, and record them as their own round.

## Release

The full pipeline is in docs/RELEASE.md. An app is published as `<App>+` on QDN (the testground), tested with the community, and offered to its original Qortal repo as a PR once it has proven itself.

1. Simon publishes `release/<App+>.zip` (from `scripts/build-zip.sh <App+>`) as `APP` under the app's + name.
2. Check that the live bundle matches the commit: the files referenced from `index.html` on the node versus a fresh build. Then add the **Published** line to the top of the brief, e.g. `Published: 1.0.0 on 2026-10-02, built from commit abc1234`, and merge the PR (a merge commit).
3. Version rules:
   - Every + app has its own series: the first published release is `1.0.0`, and each later published update bumps the last number (`1.0.1`, …). Simon may pick `1.1.0`.
   - Never use suffixes like `-plus.1`.
   - Bump only after the current version is published; until then, add to its changelog entry.
   - Keep `package.json`, Settings → About and the changelog in step.
4. **Community testing:** log what people report in the brief's **Community feedback** section, and fix it in 1.0.x releases.
5. **Upstream PR** (when Simon calls it ready): `scripts/upstream-pr.sh <App+>`, then the "Ship as <Original>" commit and the PR text from `docs/templates/upstream-pr.md`, including the Maintenance note. Simon approves the text before anything is posted.
6. Never force-push a shared branch. The history clean-ups of Q-Share+ and Q-Mail+ had Simon's explicit OK, and `upstream-pr.sh` cleans new branches without needing one.

## Working with parallel agents

Only use parallel agents when the prompt allows workflows or ultracode.

- Do the foundation (round 1 through the layout shell) with one agent.
- Then fan out over **disjoint groups of files**: each agent in its own worktree on a local branch `<slug>/feat-<topic>`, tested and committed but not pushed.
- Integrate the branches one at a time: merge, resolve conflicts, run build + lint + tests, push. Then delete the feature branch and its worktree.
- Only one agent drives the test Hub.
- Q-Share+ round 4 is the worked example: scout and audit, 8 agents fixing in parallel, then integration, re-test and a final review.

## Brief template

The headings Q-Share+'s brief uses, in order:

1. Title and one line on the app.
2. **Published** and **Version on the branch** lines.
3. Baseline at import, Notes, Feature ideas.
4. **Audit:** Architecture map, Data contract, Qortal call inventory, Performance, UX problems, Bugs, Missing features.
5. **Plan.**
6. **Done:** one `###` subsection per round, with before/after tables, the screenshot matrix and the Hub check.
7. **Follow-ups:** numbered questions for Simon, then next-pass ideas.

## Guard rails

- **Data compatibility** (CLAUDE.md rule 1): leave the code for money, names, encryption and `SIGN_TRANSACTION` behaving identically, and test anything you refactor near it.
- **Measure efficiency work:** every efficiency change gets a test or a recorded before/after number.
- **Don't drop upstream features** (rule 6), and never publish or spend QORT (rule 7).
- **One logical change per commit.** Keep build, lint and tests green on every commit. No Claude attribution lines (CLAUDE.md → Git).
- **Hand off:** fill in Done and Follow-ups, push, and open or update the PR. The PR body gives a short summary of what changed, the before/after numbers, and what Simon should check.
