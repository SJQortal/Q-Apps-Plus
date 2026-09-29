# Q-Node+

Manage the local Qortal node: status, peers, minting accounts, admin actions.

## Baseline at import

- **Upstream:** [Qortal/Q-Node](https://github.com/Qortal/Q-Node) branch `master` at `fe15445` (2026-02-14, 46 commits)
- **Stack:** React 19, MUI 7, qapp-core 1.0.56, jotai, i18next, Vite 6, TypeScript 5.7
- **Original theme (becomes Hub 2.0):** src/styles/theme/theme.ts
- **i18n:** yes
- **Tests:** none
- **Build:** `npm ci && npm run build` passes. dist 3.3 MB, biggest JS chunk 2.0 MB
- **QDN services:** none (admin API)
- **Identifiers seen (partial; complete this in the audit):** none
- **Qortal calls (counts in source):** ADMIN_ACTION ×11, GET_NODE_STATUS, GET_NODE_INFO, IS_USING_PUBLIC_NODE

## Notes

- This is the smallest app (~2.5k lines), a second pilot after Names+.
- `ADMIN_ACTION` only works against the user's own node. The UI must explain clearly when the user is on a public node.
- The import removed the upstream `.claude/settings.json`: it only allowed reading another developer's local folder.

## Feature ideas to weigh in the audit

- live status that polls only while visible
- peer list with sort and filter
- sync progress explained
- minting account health
- confirm dialogs for restart/stop

## Audit

_To fill in: architecture map, full list of QDN services and identifiers, every Qortal call and when it fires, performance hotspots, UX problems, bugs found. Rank each by impact._

## Plan

_To fill in: this pass's scope (theme kit and Settings, top efficiency fixes, top UX fixes, 2–4 features), plus anything deliberately deferred._

## Done

_To fill in: what changed, with before/after numbers (searches on first load, biggest chunk, dist size)._

## Follow-ups

_To fill in: open questions for Simon, and ideas for the next pass._
