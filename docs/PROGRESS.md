# Progress

One line per app; the details live in `docs/apps/<App+>.md`. The rounds are the ones in the qplus-app skill: **1** foundation, **2** features and phone shell, **3** quality, **4** Hub check (local), **5** Simon's requests, then release. Update this table in a `Repo:` commit when an app's work merges or a round finishes, not from inside parallel app sessions, so it doesn't conflict.

Order: one app per day, with Q-Share+ as the reference. Q-Apps+ comes last because it presents the others.

| App | Branch · PR | Rounds done | Published | Next |
|---|---|---|---|---|
| Q-Share+ | merged (#7) | 1–5, release | **1.0.0** (2026-09-30); 1.0.1 on main | publish 1.0.1; the GO phone checks in its brief |
| Q-Mail+ | `q-mail-plus/pass-1` · #15 | 1 (upgrade, harness, kit, Settings, audit); 2 started (layout shell), stopped 1 Oct 09:57 | – | finish round 2, then rounds 3–4 |
| Names+ | `names-plus/pass-1` · #5 | 1 checkpoint (29 Sep cloud night) | – | rounds 1–4 |
| Q-Tube+ | `q-tube-plus/pass-1` · #6 | 1 checkpoint | – | rounds 1–4 (keep the vendored qapp-core 1.0.80) |
| Q-Shop+ | `q-shop-plus/pass-1` · #8 | 1 checkpoint | – | replace the audio player that blanks React 19, then rounds 1–4 |
| Q-Node+ | `q-node-plus/pass-1` · #9 | 1 checkpoint | – | rounds 1–4 |
| Q-Trade+ | `q-trade-plus/pass-1` (no PR) | 1 in progress (kit and shell, part 1) | – | finish round 1 |
| Q-Support+ | `q-support-plus/pass-1` (no PR) | 1 in progress (upgrade) | – | finish round 1 |
| Q-Fund+ | `q-fund-plus/pass-1` (no PR) | 1 in progress (upgrade) | – | finish round 1 |
| Q-Mintership+ | `q-mintership-plus/rewrite-phase-1` (no PR) | rewrite phase 1 in progress | – | phases 1–5 of the rewrite plan; publish only at parity |
| Q-Apps+ | `q-apps-plus/first-version` (no PR) | brief and plan | – | after the others |

Shared work: theme kit (`shared/hub-theme`), Hub & GO pitfalls (docs/QORTAL.md), Hub test commands (`scripts/hub-cdp.mjs`), screenshot check (`scripts/screens.mjs`). Planned: a shared parts kit extracted from Q-Share+ (`shared/qplus-kit/`).
