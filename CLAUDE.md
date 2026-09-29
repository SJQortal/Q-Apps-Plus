# Q-Apps+

This monorepo holds Simon's "+" versions of the official Qortal Q-Apps. Each app in `apps/<Name>+/` starts as a copy of a Qortal repo (listed in `upstreams.tsv`, full history kept with `git subtree`). The + versions aim to be:

- **faster on Qortal**: fewer and cheaper QDN calls, smaller bundles, quick first paint;
- **easier to use**: clear flows, proper empty, loading and error states, and a phone layout that works in GO;
- **more capable**: the obvious missing features;
- **Hub 3.0 styled**: four themes and a real Settings page, the same way Torq does it.

They publish to QDN under the names Simon registered: Q-Mail+, Q-Shop+, Q-Share+, Q-Support+, Q-Tube+, Q-Trade+, Q-Fund+, Names+, Q-Node+, Q-Mintership+ and Q-Apps+. `apps/Q-Apps+/` is a new launcher app that presents all the others.

Torq is Simon's Quitter fork and the model to follow. Selected Torq files are in `shared/reference/torq/`; read them for patterns, never import them.

## Read before working on an app

1. `docs/DESIGN.md`: the Hub 3.0 look, layout, the four themes and the Settings page contract.
2. `docs/QORTAL.md`: how Q-Apps run in Hub/GO, QDN efficiency rules, and testing without a node.
3. `docs/apps/<App+>.md`: the brief for that app. Baseline facts are there already; the audit, plan and status sections are yours to fill.
4. `shared/hub-theme/README.md`: how to install the theme kit.

For a full redesign pass on an app, use the `qplus-app` skill in `.claude/skills/qplus-app/`.

## Layout

```
apps/<App+>/            one folder per app, each with its own package.json and lockfile
shared/hub-theme/       the theme kit (source of truth); copied into apps by scripts/sync-theme.sh
shared/reference/torq/  read-only Torq files: theme, Hub boot, QDN search cache, Settings, tests
docs/                   DESIGN.md, QORTAL.md, PROGRESS.md, apps/<App+>.md briefs, OVERNIGHT.md
scripts/                sync-upstream.sh, sync-theme.sh, build-zip.sh, check-theme-kit.sh
upstreams.tsv           folder → upstream GitHub repo and branch
```

Folder names contain `+`, so always quote paths: `cd "apps/Q-Mail+"`. One known tooling trap: TypeScript mis-reads a tsconfig `"include": ["."]` when the path contains `+`, and silently finds almost no files. Use `"src"` or `"**/*"` instead. Vite, vitest, eslint and npm all handle `+` paths fine.

## Ground rules

1. **Stay data-compatible with the original app.** A + app reads and writes the same QDN resources as the original: the same services, identifier schemes and prefixes, JSON shapes, encryption, and `publicSalt`/app identity where qapp-core is used. A user's existing mail, videos, shops and funds must show up in the + app, and anything published from the + app must still work in the original. New data is additive only: extra JSON fields, or new identifiers with their own prefix. List each app's identifiers in its brief before changing any data code.
2. **Each app stands alone.** It installs and builds from its own folder, and nothing imports across `apps/`. The theme kit is copied in, not linked. Keep each app's own dependency versions unless the brief's plan says to upgrade, and do major upgrades as their own commit.
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
scripts/sync-theme.sh [--check]        # copy the theme kit into opted-in apps / verify no drift
scripts/check-theme-kit.sh Q-Tube+     # typecheck + smoke-test the kit against an app's MUI
scripts/sync-upstream.sh --check       # new commits in the Qortal repos since import
```

## Git

- Prefix commit messages with the app, e.g. `Q-Mail+: add thread search`. Use `Repo:` for shared work.
- One logical change per commit: test harness, theme kit, Settings page, each efficiency fix, each feature. That keeps review and revert easy.
- Never commit `node_modules/`, `dist/`, zips, `.env` files or secrets.
- When you work on one app, only touch `apps/<that app>/` and `docs/apps/<that app>.md`. `shared/` and `docs/PROGRESS.md` change in their own commits.
- Don't rewrite upstream history. Pull upstream changes with `scripts/sync-upstream.sh`, never by copying files.
