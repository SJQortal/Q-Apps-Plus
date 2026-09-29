# Q-Shop+

Decentralised shops: sellers publish a store and products; buyers order and pay in QORT or other coins.

## Baseline at import

- **Upstream:** [Qortal/q-shop](https://github.com/Qortal/q-shop) branch `main` at `0738e27` (2024-04-17, 18 commits)
- **Stack:** React 18, MUI 5, Redux Toolkit, Vite 4, TypeScript 4.9
- **Original theme (becomes Hub 2.0):** src/styles/theme.tsx
- **i18n:** no
- **Tests:** none
- **Build:** `npm ci && npm run build` passes. dist 2.8 MB, biggest JS chunk 0.8 MB
- **QDN services:** STORE, PRODUCT, DOCUMENT, DOCUMENT_PRIVATE, VIDEO, AUDIO, THUMBNAIL
- **Identifiers seen (partial; complete this in the audit):** store/product/order identifiers (collect during the audit); leftovers `qvideo_qblog_`, `qaudio_qblog_`, `qortal_qmail_` from the Q-Blog template it was built from; `qortal_avatar`
- **Qortal calls (counts in source):** PUBLISH_QDN_RESOURCE ×13, FETCH_QDN_RESOURCE ×6, GET_NAME_DATA ×4, GET_ACCOUNT_DATA ×4, GET_USER_WALLET ×3, DECRYPT_DATA ×3, SEND_COIN ×2; `/crosschain/price` for coin prices

## Notes

- **Platform upgrade first** (docs/PLATFORM.md): React 18 → 19.3, MUI 5 → 9.4, Redux Toolkit 2 + react-redux 9, react-router-dom 7. This is the biggest jump in the repo, so run the codemods in docs/MIGRATION-NOTES.md in order and commit the upgrade on its own.
- This has the oldest upstream code (last commit 2024-04-17). `package.json` is still named `q-blog`.
- Payments go through `SEND_COIN`, and orders are encrypted (`DOCUMENT_PRIVATE`). Treat checkout and order code as money code: keep the flow identical unless the plan says otherwise, and test it.

## Feature ideas to weigh in the audit

- product search and filters
- cart that survives reload
- clear order status for buyers and sellers
- seller dashboard
- price shown in several coins

## Audit

_To fill in: architecture map, full list of QDN services and identifiers, every Qortal call and when it fires, performance hotspots, UX problems, bugs found. Rank each by impact._

## Plan

_To fill in: this pass's scope (theme kit and Settings, top efficiency fixes, top UX fixes, 2–4 features), plus anything deliberately deferred._

## Done

_To fill in: what changed, with before/after numbers (searches on first load, biggest chunk, dist size)._

## Follow-ups

_To fill in: open questions for Simon, and ideas for the next pass._
