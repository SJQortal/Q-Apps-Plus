# Q-Apps+

Redesigned versions of the official [Qortal](https://qortal.org) Q-Apps: faster on QDN, easier to use, with more of the features you'd expect, and styled for Qortal Hub 3.0 with four themes (Hub 3.0, Hub 2.0, Black and White). Each + app keeps using the same QDN data as the original, so your existing mail, videos, shops and names show up unchanged.

| App | Based on | What it is |
|---|---|---|
| **Q-Mail+** | [Qortal/q-mail](https://github.com/Qortal/q-mail) | Encrypted mail between Qortal names |
| **Q-Shop+** | [Qortal/q-shop](https://github.com/Qortal/q-shop) | Decentralised shops and orders |
| **Q-Share+** | [Qortal/q-share](https://github.com/Qortal/q-share) | File and document sharing |
| **Q-Support+** | [Qortal/q-support](https://github.com/Qortal/q-support) | Issues and bounties |
| **Q-Tube+** | [Qortal/q-tube](https://github.com/Qortal/q-tube) | Video platform |
| **Q-Trade+** | [Qortal/q-trade](https://github.com/Qortal/q-trade) | Cross-chain QORT trading |
| **Q-Fund+** | [Qortal/q-fund-v2](https://github.com/Qortal/q-fund-v2) | Crowdfunding |
| **Names+** | [Qortal/names](https://github.com/Qortal/names) | Register, buy and sell names |
| **Q-Node+** | [Qortal/Q-Node](https://github.com/Qortal/Q-Node) | Manage your Qortal node |
| **Q-Mintership+** | [Qortal/Q-Mintership-Alpha](https://github.com/Qortal/Q-Mintership-Alpha) | Minting group forum and boards |
| **Q-Apps+** | new | One place to find and open all of the above |

Open them in Qortal Hub or GO as `qortal://APP/<name>`, e.g. `qortal://APP/Q-Mail+`.

## Repository layout

- `apps/<App+>/` holds one app each, imported with full upstream history via `git subtree`.
- `shared/hub-theme/` is the shared Hub 3.0 theme kit, which is copied into each app.
- `docs/` holds the design and Qortal guides, per-app briefs and progress, and the overnight runbook.
- `scripts/` has the helpers for syncing upstream, syncing the theme and building publish zips.

## Develop

```bash
cd "apps/Q-Mail+"
npm ci
npm run dev
npm run build
```

Qortal calls only work inside Hub or GO. Build a publish zip with `scripts/build-zip.sh Q-Mail+`, which writes `release/Q-Mail+.zip`.

Pull new commits from the Qortal repos:

```bash
scripts/sync-upstream.sh --check
scripts/sync-upstream.sh Q-Mail+
```

## Credits

Each app is built on the work of its original Qortal developers; see the upstream links above and the history under `apps/`. The Hub 3.0 theme comes from Torq. Inter font © The Inter Project Authors, SIL Open Font License 1.1.
