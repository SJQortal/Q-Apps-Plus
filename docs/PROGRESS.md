# Progress

One line per app; the details live in `docs/apps/<App+>.md`. The rounds are the ones in the qplus-app skill: **1** foundation, **2** features and phone shell, **3** quality, **4** Hub check (local), **5** Simon's requests, then release. Update this table in a `Repo:` commit when an app's work merges or a round finishes, not from inside parallel app sessions, so it doesn't conflict.

Order: one app per day, with Q-Share+ as the reference. Q-Apps+ comes last because it presents the others.

Each app moves through the stages in docs/RELEASE.md: **build** (local, the rounds), **testground** (published as `<App>+` on QDN), **community** (testing with the community, fixes as 1.0.x), **upstream** (a PR to the original Qortal repo).

| App | Stage | Branch · PR | Rounds done | Published as + | Upstream PR | Next |
|---|---|---|---|---|---|---|
| Q-Share+ | upstream | merged (#7); 1.0.1 in #17 (`Desktop/Q-Apps+-QShare`) | 1–5, release | **1.0.0** (2026-09-30) | [Qortal/q-share#9](https://github.com/Qortal/q-share/pull/9) (2.0.0, 2026-10-07) | answer review on #9; 1.0.1 notifications (#17), publish, then a follow-up PR |
| Q-Mail+ | community | merged (#15); 1.0.1 in `Desktop/Q-Apps+-QMail` | 1–5, release | **1.0.0** (2026-10-05, `a128d290`) | – | Simon's 1.0.1 changes; community feedback; the GO phone checks; then `scripts/upstream-pr.sh Q-Mail+` |
| Names+ | build | `names-plus/pass-1` · #5 | 1 checkpoint (29 Sep cloud night) | – | – | rounds 1–4 |
| Q-Tube+ | build | `q-tube-plus/pass-1` · #6 | 1 checkpoint | – | – | rounds 1–4 (keep the vendored qapp-core 1.0.80) |
| Q-Shop+ | build | `q-shop-plus/pass-1` · #8 | 1 checkpoint | – | – | replace the audio player that blanks React 19, then rounds 1–4 |
| Q-Node+ | build | `q-node-plus/pass-1` · #9 | 1 checkpoint | – | – | rounds 1–4 |
| Q-Trade+ | build | `q-trade-plus/pass-1` (no PR) | 1 in progress (kit and shell, part 1) | – | – | finish round 1 |
| Q-Support+ | build | `q-support-plus/pass-1` (no PR) | 1 in progress (upgrade) | – | – | finish round 1 |
| Q-Fund+ | build | `q-fund-plus/pass-1` (no PR) | 1 in progress (upgrade) | – | – | finish round 1 |
| Q-Mintership+ | build | `q-mintership-plus/rewrite-phase-1` (no PR) | rewrite phase 1 in progress | – | – | phases 1–5 of the rewrite plan; publish only at parity |
| Q-Apps+ | build | `q-apps-plus/first-version` (no PR) | brief and plan | – | n/a (new app) | after the others |

Shared work:
- theme kit (`shared/hub-theme`);
- Hub & GO pitfalls (docs/QORTAL.md);
- Hub test commands (`scripts/hub-cdp.mjs`; tap and swipe measure the app frame's real position since #18);
- screenshot check (`scripts/screens.mjs`);
- upstream PRs (`scripts/upstream-pr.sh`, docs/RELEASE.md, docs/templates/upstream-pr.md).

Planned: a shared parts kit extracted from Q-Share+ and Q-Mail+ (`shared/qplus-kit/`).

For the Qortal devs: `q-share-plus/for-upstream` and `q-mail-plus/for-upstream` hold each app's history on top of the upstream repo (see each app's README). From now on the PR itself is the way in, prepared with `scripts/upstream-pr.sh` (docs/RELEASE.md).
