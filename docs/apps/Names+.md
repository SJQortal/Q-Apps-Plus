# Names+

Register, update, buy and sell Qortal names.

## Baseline at import

- **Upstream:** [Qortal/names](https://github.com/Qortal/names) branch `main` at `bdc9c13` (2026-03-22, 11 commits)
- **Stack:** React 19, MUI 7, qapp-core 1.0.41, jotai, i18next, Vite 6, TypeScript 5.7
- **Original theme (becomes Hub 2.0):** src/styles/theme/theme.ts
- **i18n:** yes
- **Tests:** none
- **Build:** `npm ci && npm run build` passes. dist 3.1 MB, biggest JS chunk 1.8 MB
- **QDN services:** THUMBNAIL (avatars)
- **Identifiers seen (partial; complete this in the audit):** `qortal_avatar`
- **Qortal calls (counts in source):** REGISTER_NAME, UPDATE_NAME, SELL_NAME, CANCEL_SELL_NAME, BUY_NAME, GET_ACCOUNT_NAMES, GET_PRIMARY_NAME, PUBLISH_QDN_RESOURCE; `/names/forsale`, `/transactions/unitfee`

## Notes

- **Platform upgrade first** (docs/PLATFORM.md): React 19 → 19.3, MUI 7 → 9.4. This app uses qapp-core, so add the `overrides` block and the `ErrorOutline` icon alias from PLATFORM.md.
- Upstream committed build junk (`dist.zip`, `.qapp-tunnel.pid`, `.vite/`); the import cleanup removed it. `connect-qapp.sh` and `stop-qapp.sh` are the upstream dev tunnel scripts, kept.
- This app is small (~3k lines) and on the same stack as Torq. **Good pilot for the theme kit**, so do it first.
- Name purchases spend QORT, so keep the buy/sell flows exact.

## Feature ideas to weigh in the audit

- name search with availability check as you type
- marketplace sort and filter (price, length, newest)
- show fee before confirming
- my names dashboard with avatar and primary-name controls

## Audit

_To fill in: architecture map, full list of QDN services and identifiers, every Qortal call and when it fires, performance hotspots, UX problems, bugs found. Rank each by impact._

## Plan

_To fill in: this pass's scope (theme kit and Settings, top efficiency fixes, top UX fixes, 2–4 features), plus anything deliberately deferred._

## Done

_To fill in: what changed, with before/after numbers (searches on first load, biggest chunk, dist size)._

## Follow-ups

_To fill in: open questions for Simon, and ideas for the next pass._
