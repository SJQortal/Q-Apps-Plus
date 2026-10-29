# Q-Share+

This is the **+** version of [Qortal's Q-Share](https://github.com/Qortal/q-share), the public file-sharing Q-App, maintained in [SJQortal/Q-Apps-Plus](https://github.com/SJQortal/Q-Apps-Plus). It reads and writes the same QDN data as the original: your shares, files and comments show up in both, and anything published here still works in Q-Share.

What it adds:

- a phone layout for GO and narrow screens: bottom bar, floating Share button, bottom sheets, full-screen forms with Publish above the keyboard, pull-to-refresh;
- collections (`qshare_collection_` documents, additive) with folders and covers, shown as a grid of cards by default, which you can copy from other people into your own (with a line naming the original, and a notification for its owner), previews for PDF, text, image, audio and video, a drag-and-drop publish flow with progress and retry;
- share thumbnails, made on your device from the first image or video (or a picture you choose), and shown on cards and rows;
- shares of up to 300 files, published in batches of 20 that Qortal Core accepts (it takes at most 25 unconfirmed transactions per account);
- a playlist player for shares with several audio files, which keeps playing while you browse;
- the Hub 3.0 look with four themes (Hub 3.0, Q-Share Classic, Black, White) and a Settings page;
- the current stack: React 19.3, MUI 9.4, Vite 8, with a vitest harness and an ESLint 9 config;
- a Quill 2 description editor that keeps the stored format readable in the original app;
- notifications: a bell for comments on your shares, replies to your comments, your shares added to collections and your collections copied, and optional Qortal Hub alerts while the app is closed.

See `CHANGELOG.md` for versions and `docs/apps/Q-Share+.md` in the monorepo for the audit, plan and status.

## Develop

```bash
npm ci
npm run dev        # Qortal calls need Hub; tests use the mocks in src/test/setup.ts
npm test
npm run lint
npm run build
../../scripts/screens.mjs Q-Share+   # every screen at five sizes in four themes, with checks (config: e2e/screens.config.mjs)
```

Publish zips are built from the monorepo root with `scripts/build-zip.sh Q-Share+`.

## Merging this back into Q-Share

Q-Share+ was imported into the monorepo with `git subtree`, so this folder's history still sits on top of Q-Share's own: all 31 commits of [Qortal/q-share](https://github.com/Qortal/q-share) `main` up to `9c1ca81`, with their original hashes, then the Q-Share+ commits.

The branch [`q-share-plus/for-upstream`](https://github.com/SJQortal/Q-Apps-Plus/tree/q-share-plus/for-upstream) is that history ready to merge, with this folder as its root (split at version 1.0.1). In a clone of Qortal/q-share:

```bash
git fetch https://github.com/SJQortal/Q-Apps-Plus.git q-share-plus/for-upstream
git merge FETCH_HEAD
```

To split it yourself, for example to include later changes:

```bash
# In a clone of SJQortal/Q-Apps-Plus: this folder's history as a branch of its own
git subtree split --prefix="apps/Q-Share+" origin/main -b q-share-plus
# (use origin/q-share-plus/pass-1 instead of origin/main until PR #7 is merged)

# In a clone of Qortal/q-share
git fetch /path/to/Q-Apps-Plus q-share-plus
git merge FETCH_HEAD
```

As of 2026-10-01 Q-Share's `main` has not moved since `9c1ca81`, so the merge is a fast-forward. Each commit is one change with a message that explains it; the full audit, the data contract and the test records are in [docs/apps/Q-Share+.md](https://github.com/SJQortal/Q-Apps-Plus/blob/613ff3ba58270c31b827003145045ed803a44ba1/docs/apps/Q-Share%2B.md).

**Data:** shares, files and comments use the same services, identifiers and JSON shapes as Q-Share, and descriptions are stored in the Quill 1 markup Q-Share writes, so nothing needs migrating. Four kinds of data are new, and Q-Share ignores them all: collections (DOCUMENT `qshare_collection_…`, whose QDN description also carries `~qsn-…~` markers naming the owners of its newest shares, for their notifications, and whose JSON may hold `folders`, a `cover`, on a copy `copiedFrom`, and once deleted `deleted: true`), collection and folder covers (THUMBNAIL `qshare_cover_…`), share thumbnails (THUMBNAIL `qshare_thumb_…`, named by an extra `thumbnail` field in the share JSON; Q-Share ignores it, and an edit in Q-Share drops it), and the optional Settings sync snapshot (DOCUMENT `qshareplus_settings`). A share with more than 10 files is the same share JSON as any other, just with a longer `files` list; Q-Share lists them all. Notifications themselves only read: comments are matched by the keys Q-Share already puts in their identifiers, and Hub alert rules live in Hub.

**What is specific to the + build**, to change if it ships as Q-Share:

- the app name in copied `qortal://APP/…` links and in Hub alert links: `PUBLISHED_APP_NAME` in `src/utils/qortalLinks.ts` and `HUB_APP_NAME` in `src/utils/notifications/hubAlerts.ts`;
- the visible name: `index.html`, the header (`src/components/layout/Navbar/Navbar.tsx`), the welcome notice (`src/components/common/ConsentModal.tsx`), Settings → About and the What's new dialog;
- the version and changelog: `package.json` (`qshare-plus`), `CHANGELOG.md` and `src/constants/changelog.ts`, which links to this repo;
- browser storage keys starting with `qshareplus-` (theme, settings, share statistics, notifications, Hub alerts) and the sync identifier above; renaming them means existing Q-Share+ users start with default settings;
- `src/hub-theme/`, a copy of the monorepo's shared theme kit (`shared/hub-theme`), which would simply become part of the app.

Removed from the original (listed in `CHANGELOG.md`): code carried over from Q-Tube that never ran (its video player and playlist screens), unused fonts, and the moment, react-quill, react-rnd, compressorjs and ts-key-enum dependencies.
