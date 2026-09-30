---
name: qplus-app
description: Full pass on one Q-Apps+ app — platform upgrade to React 19.3 + MUI 9.4, deep-dive audit, plan, Hub 3.0 theme kit and Settings page, Qortal efficiency fixes, UX redesign, obvious features, tests, and a publish zip. For Q-Mintership+ it drives the phased React rewrite. Use when asked to redesign, upgrade, audit or "do" an app in apps/ (e.g. "do Q-Mail+", "run the overnight pass on Names+").
---

# Redesign pass on one + app

Work on exactly one app per pass, and follow the steps in order. Write findings into `docs/apps/<App+>.md` as you go, so the brief is always current and another session can pick up where you stopped.

## Overnight mode (unattended cloud runs)

When the prompt says **overnight mode**, the goal is a publishable app by morning, even if the session stops early. So change the order:

1. **Checkpoint first:** branch → baseline (step 1) → platform upgrade (1b) → test harness → theme kit + Settings page with the four themes. `npm run build` must pass, and so must tests if present. `scripts/build-zip.sh <App+>` must produce a zip.
2. **Open the PR now:** push the branch and open the PR (step 6 format) with "Checkpoint reached" in the body.
3. **Then continue:** deep-dive audit (2), plan (3), efficiency fixes, UX redesign and features (4). **Push after every commit**, so the PR always holds your latest working state. Never leave the branch with a failing build. If something can't be finished, revert it rather than leave it half-done.
4. **Finish:** fill in the brief's Done and Follow-ups, update the PR description, and bump the version and changelog.

Data-code changes still need the data contract from the audit first (CLAUDE.md rule 1). The checkpoint steps don't touch data code.

## 0. Load context

Read `CLAUDE.md`, `docs/PLATFORM.md`, `docs/MIGRATION-NOTES.md`, `docs/DESIGN.md`, `docs/QORTAL.md`, `shared/hub-theme/README.md` and the app's brief. Skim the matching Torq files in `shared/reference/torq/` (theme, Settings page, QDN search cache, test setup).

## 1. Baseline

Create your branch first, e.g. `git switch -c names-plus/pass-1` (naming rules in CLAUDE.md → Git). `main` is protected, so work never goes there directly.

```bash
cd "apps/<App+>" && npm ci && npm run build   # Q-Mintership+ has no build
```

Record the result, the dist size and the biggest chunk if they differ from the brief. If the baseline fails, fix only what's needed to build, in its own commit, and note it.

## 1b. Platform upgrade to React 19.3 + MUI 9.4

Follow "How each app upgrades" in `docs/PLATFORM.md`:
- bump the dependencies and add the qapp-core workaround where needed;
- run the codemods, then `scripts/check-mui-icons.sh <App+>`;
- clear the new type errors, then build and preview.

Commit this on its own (`<App+>: upgrade to React 19.3 and MUI 9.4`) before anything else, so the redesign is done once on the final stack. Record the before/after type-error counts and bundle sizes in the brief.

**Q-Mintership+ is different:** it isn't upgraded, it's rewritten. Follow the phased **Rewrite plan** in its brief instead of steps 1b and 4. One session does one phase and ends with a working app and a PR.

## 2. Deep-dive audit (write it into the brief's "Audit" section)

Read the whole app, not a sample. Produce:

- **Architecture map:** entry point, routes and pages, state stores, the main components, and where Qortal is called.
- **Data contract:** every QDN service and identifier pattern the app reads or writes, with the JSON shape of each. This list is binding (ground rule 1). Finish it before any data-layer change.
- **Qortal call inventory:** each `qortalRequest` action and direct `fetch('/…')`, when it fires, and how often. Count the searches on first load. Mark every `limit: 0`, polling loop, N+1 pattern and uncached repeat.
- **Performance:** the biggest chunks and what's in them (`npx vite build --mode production` output, or a quick `rollup-plugin-visualizer` run you don't commit), images loaded at full size, and re-render hot spots.
- **UX problems:** confusing flows, missing loading, empty and error states, phone and small-window breakage, accessibility gaps, and unclear copy.
- **Bugs:** anything broken you find, with file:line.
- **Missing features:** what users of this kind of app obviously expect. Weigh the ideas already in the brief.

Rank each finding by user impact × effort.

## 3. Plan (write it into the brief's "Plan" section)

This pass always includes:

1. A test harness (`vitest` + `jsdom`) with a `qortalRequest` mock, if the app has none (see docs/QORTAL.md).
2. The theme kit, a Settings page and the four themes (DESIGN.md checklist).
3. The top efficiency fixes (every `limit: 0`, request dedupe and cache, lazy media, code-splitting).
4. A UX redesign of the main screens to the Hub 3.0 layout, **mobile-first**, meeting every point in docs/DESIGN.md → Mobile (GO and phones).
5. 2–4 of the most obvious missing features.

Defer anything risky, such as major dependency upgrades or rewriting money or encryption code, to "Follow-ups" with a reason. Don't stop to ask for approval. The plan exists so Simon can review it later.

## 4. Implement in small commits

Order (after the platform upgrade in 1b): harness → theme kit → Settings → efficiency → layout/UX → features. After each step:

```bash
npm run build && (npm test --if-present) && (npm run lint --if-present)
cd ../.. && scripts/sync-theme.sh --check
git add -A "apps/<App+>" "docs/apps/<App+>.md" && git commit -m "<App+>: <what changed>"
```

For the theme kit, create the opt-in folder and sync (`mkdir "apps/<App+>/src/hub-theme" && scripts/sync-theme.sh`). Then follow `shared/hub-theme/README.md`. Never edit the copied files. If the kit needs a change, change `shared/hub-theme`, run `scripts/check-theme-kit.sh` on an MUI 5 app and an MUI 7 app, and commit that as `Repo: …`.

Guard rails:

- **Keep data compatibility** (CLAUDE.md rule 1). Leave the code for money, names, encryption and `SIGN_TRANSACTION` behaviourally identical, and add tests around anything you refactor near it.
- **Measure efficiency work.** Every efficiency change needs a test or a recorded before/after number.
- **Version and changelog.** Every + app has its own version series, separate from the upstream app's number:
  - The first published release is `1.0.0`. Each later published update bumps the last number: `1.0.1`, `1.0.2`, and so on. Simon may pick `1.1.0` for a big release. Never use suffixes like `-plus.1`.
  - Only bump after the current version has been published. Until then, keep adding to the current version's changelog entry.
  - The brief's **Published** line (e.g. `Published: 1.0.0 on 2026-10-02`) says what's live. With no such line, nothing is published yet, and the version is `1.0.0`.
  - Keep `package.json`, the Settings → About line and the changelog in step.
  - Add a `CHANGELOG` entry and a changelog dialog reachable from Settings → About.
- **Add a README section.** At the top of the app's README (create one if missing), say this is the + version, what it adds, and link the upstream repo.

## 5. Verify

- The build, tests and lint pass, and `scripts/sync-theme.sh --check` passes.
- `scripts/build-zip.sh <App+>` produces a zip with `index.html` at the root (`unzip -l release/<App+>.zip | head`).
- If a browser tool is available, run `npm run dev` or `npx vite preview` and check all four themes at 1280, 700 and 375 px, and that the console shows no errors beyond the ones expected outside Hub (no `qortalRequest`).
- In a **local** session with Hub available, also test inside Hub Dev Mode through its debug port (`docs/HUB-TESTING.md`, `scripts/hub-cdp.mjs`). Ask Simon before any action that publishes or spends QORT. Without a node, Qortal calls fail, so use the test mocks or a dev-only mock of `qortalRequest`, and never commit a mock into production code paths.

## 6. Hand off

- Fill in the brief's "Done" section, with numbers, and its "Follow-ups" section, including questions for Simon.
- Commit, push the branch (`git push -u origin <branch>`) and open the PR: `gh pr create --base main --title "<App+>: React 19.3 / MUI 9.4 + redesign pass 1" --body-file <notes>`. The body summarises the audit's top findings, what changed, before/after numbers, and anything Simon should test in Hub. If `gh` fails, end your report with the branch name so Simon can click "Create PR".
- Only update `docs/PROGRESS.md` if you are the only session working in the repo.
