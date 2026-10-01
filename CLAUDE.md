# Q-Apps+

This monorepo holds Simon's "+" versions of the official Qortal Q-Apps. Each app in `apps/<Name>+/` starts as a copy of a Qortal repo (listed in `upstreams.tsv`, full history kept with `git subtree`). The + versions aim to be:

- **faster on Qortal**: fewer and cheaper QDN calls, smaller bundles, quick first paint;
- **easier to use**: clear flows, proper empty, loading and error states, and a phone layout that works in GO;
- **more capable**: the obvious missing features;
- **Hub 3.0 styled**: four themes and a real Settings page, the same way Torq does it.
- **Great on phones**: every app must work like a native mobile app in GO and on narrow screens (docs/DESIGN.md → Mobile).
- **Proven in Hub**: no app is finished until it has been checked in a test Hub with real data (the skill's round 4).

They publish to QDN under the names Simon registered: Q-Mail+, Q-Shop+, Q-Share+, Q-Support+, Q-Tube+, Q-Trade+, Q-Fund+, Names+, Q-Node+, Q-Mintership+ and Q-Apps+. `apps/Q-Apps+/` is a new launcher app that presents all the others.

Torq is Simon's Quitter fork and the model to follow for look and Qortal patterns. Selected Torq files are in `shared/reference/torq/`; read them for patterns, never import them.

**Q-Share+ is the reference + app.** It was published as 1.0.0 on 2026-09-30. Every app aims for its standard: the rounds and "Done means" checklist in the `qplus-app` skill, and its brief `docs/apps/Q-Share+.md` as the worked example.

## Read before working on an app

1. `docs/DESIGN.md`: the Hub 3.0 look, layout, the four themes and the Settings page contract.
2. `docs/QORTAL.md`: how Q-Apps run in Hub/GO, QDN efficiency rules, and testing without a node.
3. `docs/PLATFORM.md`: the target stack (**React 19.3 + MUI 9.4** for every app), why it's safe in Hub/GO, the qapp-core workaround, and how each app upgrades.
4. `docs/apps/<App+>.md`: the brief for that app. Baseline facts are there already; the audit, plan and status sections are yours to fill.
5. `shared/hub-theme/README.md`: how to install the theme kit.
6. `docs/HUB-TESTING.md`: how to test inside Qortal Hub Dev Mode (local sessions only, via Hub's debug port and `scripts/hub-cdp.mjs`).
7. `docs/apps/Q-Share+.md`: the worked example of every round, from audit to Hub check and release.

For work on an app, use the `qplus-app` skill in `.claude/skills/qplus-app/`. `docs/OVERNIGHT.md` covers the setup around it: one folder and one chat per app, the day prompt, the morning and release.

## Layout

```
apps/<App+>/            one folder per app, each with its own package.json and lockfile
shared/hub-theme/       the theme kit (source of truth); copied into apps by scripts/sync-theme.sh
shared/reference/torq/  read-only Torq files: theme, Hub boot, QDN search cache, Settings, tests
docs/                   DESIGN.md, QORTAL.md (incl. Hub & GO pitfalls), PLATFORM.md, MIGRATION-NOTES.md,
                        HUB-TESTING.md, PROGRESS.md, OVERNIGHT.md (daily sessions), apps/<App+>.md briefs
scripts/                sync-upstream.sh, sync-theme.sh, build-zip.sh, build-pr-zips.sh, check-theme-kit.sh,
                        check-mui-icons.sh, screens.mjs (screenshot check), hub-cdp.mjs (drive a test Hub)
upstreams.tsv           folder → upstream GitHub repo and branch
```

Folder names contain `+`, so always quote paths: `cd "apps/Q-Mail+"`. One known tooling trap: TypeScript mis-reads a tsconfig `"include": ["."]` when the path contains `+`, and silently finds almost no files. Use `"src"` or `"**/*"` instead. Vite, vitest, eslint and npm all handle `+` paths fine.

## Ground rules

1. **Stay data-compatible with the original app.** A + app reads and writes the same QDN resources as the original: the same services, identifier schemes and prefixes, JSON shapes, encryption, and `publicSalt`/app identity where qapp-core is used. A user's existing mail, videos, shops and funds must show up in the + app, and anything published from the + app must still work in the original. New data is additive only: extra JSON fields, or new identifiers with their own prefix. List each app's identifiers in its brief before changing any data code.
2. **Each app stands alone.** It installs and builds from its own folder, and nothing imports across `apps/`. The theme kit is copied in, not linked. Every app moves to the target stack in docs/PLATFORM.md (React 19.3, MUI 9.4) as the **first** step of its pass, in its own commit, before any redesign work. Q-Mintership+ is being rewritten in React on that stack (see its brief).
3. **Themes come from the kit.** Take every colour, radius and font from `shared/hub-theme`, `theme.palette` or `var(--qp-*)`. Never hard-code hex values in components. Hub 2.0 is the app's own original look, carried over from its old theme file. Edit the kit only in `shared/`, then run `scripts/sync-theme.sh`. Never edit an app's copy.
4. **Qortal efficiency** (details in docs/QORTAL.md):
   - Never search with `limit: 0` or with no limit.
   - Page every list.
   - Merge identical searches that are already in flight, and cache results for the session.
   - Load thumbnails and avatars lazily.
   - Pause any polling while the tab is hidden, and back off.
   - Code-split heavy screens and libraries.
5. **Keep the build green.** Before every commit, the app you touched must pass `npm run build`, plus `npm test` and `npm run lint` if they exist. `scripts/sync-theme.sh --check` must also pass. If a check was already failing at the baseline, say so in the brief; don't hide it.
6. **Don't drop upstream features.** Redesign them, and move rarely used ones into menus or Settings, but don't delete them. If something truly has to go, record why in the brief.
7. **Never publish to QDN, and never spend QORT.** Simon publishes. Agents build zips with `scripts/build-zip.sh`.
8. **Qortal APIs only.** Q-Apps run sandboxed in Hub, so don't add calls to web2 services, CDNs or remote fonts. Bundle every asset.

## Commands

```bash
cd "apps/Q-Mail+" && npm ci           # install one app (every app has a lockfile, except Q-Mintership+, which has no build)
npm run dev                            # vite dev server; Qortal calls need Hub, so use mocks in tests
npm run build                          # must pass before committing
scripts/build-zip.sh Q-Mail+           # release/Q-Mail+.zip, ready for Simon to publish
scripts/build-pr-zips.sh               # morning: zips for every open app PR + release/SUMMARY.md
scripts/sync-theme.sh [--check]        # copy the theme kit into opted-in apps / verify no drift
scripts/check-theme-kit.sh Q-Tube+     # typecheck + smoke-test the kit against an app's MUI
scripts/check-mui-icons.sh Q-Tube+     # icon imports that MUI 9 removed (use the …Outlined names)
scripts/screens.mjs Q-Share+           # every screen × 5 sizes × 4 themes, with overflow/a11y/call checks (needs Playwright)
node scripts/hub-cdp.mjs size 390 844 --touch   # drive a test Hub: sizes, touch, request logs (docs/HUB-TESTING.md)
scripts/sync-upstream.sh --check       # new commits in the Qortal repos since import
```

## Git

- **`main` is protected: every change arrives as a pull request.** Start each piece of work on a branch named `<app-slug>/<topic>` (e.g. `names-plus/pass-1`, `q-mintership-plus/rewrite-phase-1`, `repo/theme-kit-fix`), push it with `git push -u origin <branch>`, and open the PR with `gh pr create --base main --title "…" --body "…"`. If `gh` can't open it, push anyway and end your report with the branch name so Simon can click "Create PR". PRs merge as merge commits (squash and rebase are switched off), so upgrade and redesign commits stay separate and `git subtree` history survives. Never force-push.
- **Commit identity:** before your first commit, check `git config user.email`. If it's empty or not a `users.noreply.github.com` address, set the repo-local identity with `git config user.name "Simon James"` and `git config user.email "274929184+SJQortal@users.noreply.github.com"`, so commits link to Simon's GitHub account.
- **No Claude attribution:** commit messages and PR descriptions carry no Claude lines at all: no `Co-Authored-By: Claude` trailer, no "🤖 Generated with Claude Code", no `Claude-Session:` trailer and no claude.ai session links. `.claude/settings.json` turns off Claude Code's automatic ones (`attribution`). Leave them out when you write the text yourself.
- Prefix commit messages with the app, e.g. `Q-Mail+: add thread search`. Use `Repo:` for shared work.
- One logical change per commit: test harness, theme kit, Settings page, each efficiency fix, each feature. That keeps review and revert easy.
- Never commit `node_modules/`, `dist/`, zips, `.env` files or secrets.
- When you work on one app, only touch `apps/<that app>/` and `docs/apps/<that app>.md`. `shared/` and `docs/PROGRESS.md` change in their own commits.
- Don't rewrite upstream history. Pull upstream changes with `scripts/sync-upstream.sh`, never by copying files.
