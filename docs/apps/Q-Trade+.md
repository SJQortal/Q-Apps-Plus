# Q-Trade+

Cross-chain trade portal: buy and sell QORT for LTC, BTC, DOGE, DGB, RVN and ARRR through Qortal trade bots.

## Baseline at import

- **Upstream:** [Qortal/q-trade](https://github.com/Qortal/q-trade) branch `feature/fee-management` at `1a77a51` (2025-08-14, 60 commits)
- **Stack:** React 19, MUI 7, qapp-core 1.0.26, jotai, Vite 5, TypeScript 5.4
- **Original theme (becomes Hub 2.0):** src/styles/theme.tsx
- **i18n:** no
- **Tests:** none
- **Build:** `npm ci && npm run build` passes. dist 4.3 MB, biggest JS chunk 2.5 MB
- **QDN services:** JSON
- **Identifiers seen (partial; complete this in the audit):** `coinInfo-`
- **Qortal calls (counts in source):** UPDATE_FOREIGN_FEE ×5, GET_FOREIGN_FEE ×2, CANCEL_TRADE_SELL_ORDER ×2, CREATE_TRADE_BUY_ORDER, CREATE_TRADE_SELL_ORDER, SIGN_FOREIGN_FEES, SEND_COIN; `/crosschain/tradeoffers`, `/crosschain/trades`, `/crosschain/tradebot`, `/crosschain/tradepresence`

## Notes

- **Platform upgrade first** (docs/PLATFORM.md): React 19 → 19.3, MUI 7 → 9.4. This app uses qapp-core, so add the `overrides` block and the `ErrorOutline` icon alias from PLATFORM.md.
- This uses upstream branch **`feature/fee-management`**, not `master`. It is 24 commits ahead of `master` (lock fees, stuck sell orders, settings modal, trade-offer fetch without socket) and was the newest work at import.
- **This is money code.** Buy, sell, cancel and fee logic must keep exactly the same behaviour and parameters. Redesign the UI around it, and add tests around any logic you touch. Never place orders or send coins from tests or scripts.
- The biggest JS chunk is 2.5 MB.

## Feature ideas to weigh in the audit

- clearer order book (depth, best price, spread)
- trade history with filters
- order status explained in plain words
- price chart from recent trades
- warnings before risky actions

## Audit

_To fill in: architecture map, full list of QDN services and identifiers, every Qortal call and when it fires, performance hotspots, UX problems, bugs found. Rank each by impact._

## Plan

_To fill in: this pass's scope (theme kit and Settings, top efficiency fixes, top UX fixes, 2–4 features), plus anything deliberately deferred._

## Done

**Status 2026-09-29 (paused overnight, branch `q-trade-plus/pass-1`, no PR yet).** Session order followed the overnight mode of the `qplus-app` skill. Three commits are on the branch; the third is the theme-kit step, partly finished (see Follow-ups).

1. **Platform upgrade** (`Q-Trade+: upgrade to React 19.3 and MUI 9.4`): React 19.3.0, MUI 9.4.0, Emotion 11.14, Vite 8.3 + plugin-react 6.1, TypeScript 5.9, typescript-eslint 8. qapp-core pinned to **1.0.26** (a fresh resolution otherwise picks 1.0.79, which needs React Router 7) with the MUI overrides and the `ErrorOutline` alias. `vite-plugin-pwa` (unused, Vite ≤ 5 only) dropped. Codemods: `deprecations/all` rewrote four Dialog `PaperProps` → `slotProps.paper` in TradeOffers.tsx; `v9.0.0/system-props` changed nothing; `InfoOutline` → `InfoOutlined`. tsc clean before and after (tsconfig is `strict: false`).
   - Baseline: build passes, dist 4.4 MB, biggest chunk 2,613 kB (gzip 1,021 kB), CSS 206 kB, fonts as TTF 1.6 MB, tsc 0 errors, **lint already failing (197 errors, 31 warnings)**.
   - After upgrade: dist 4.4 MB, biggest chunk 2,686 kB (gzip 1,042 kB), lint 206 errors.
2. **Test harness** (`Q-Trade+: add a vitest test harness`): vitest 5 + jsdom + Testing Library + fake-indexeddb. `src/test/setup.ts` mocks `qortalRequest`, `qortalRequestWithTimeout`, `fetch` and `WebSocket` (records calls, unregistered actions reject, fresh IndexedDB per test). `src/test/qappCoreMock.ts` mocks useGlobal (with persistentOperations), usePublish, toasts and RequestQueueWithPromise. 9 tests pass (`npm test`).
3. **Theme kit, Hub 3.0 shell and Settings page** (part 1, this commit): see Follow-ups for what is still open.

Verified outside Hub with headless Chromium (Playwright against `vite preview`): the upgraded app renders at 1280 and 375 px with only the errors expected without Hub (`qortalRequest` undefined, no node). One pre-existing runtime error found: ag-grid 32 no longer passes `params.columnApi`, so `onGridReady` in TradeBotList.tsx, HistoryList.tsx and TradeOffers.tsx throws `Cannot read properties of undefined (reading 'getAllColumns')` (caught by React, tables still render).

## Follow-ups

### Unfinished in the theme-kit commit (do this first)

The shell and Settings page are in place and the app builds, but the colour sweep and the visual check were cut short when the session was paused. The next session should:

1. **Finish the hard-coded colour sweep** (DESIGN.md checklist: `grep -rnE "#[0-9a-fA-F]{3,8}|\"white\"|\"red\"" src` outside `hub-theme/`, `styles/theme.tsx` and the SVG icons). Files not yet converted:
   - `src/components/Grids/TradeOffers.tsx` (CRLF file): the four Dialogs still force `slotProps.paper.style.backgroundColor: "rgb(39, 40, 44)"` and `background: "rgb(39, 40, 44)"` on DialogTitle/Content/Actions (delete those, the theme paper is right in all four themes); `sx={{ borderColor: "#333" }}` → `"divider"`; `color: "white"` → `"text.primary"`; `color="gray"` → `"text.secondary"`; the close IconButton `color: "#fff"` → `"text.secondary"`; the red warning box → `bgcolor: "error.main", color: "error.contrastText"`; ErrorIcon `red` → `error.main`, CheckCircleIcon `green` → `success.main`; the total-vs-balance highlight `"red"` → `"error.main"`; Buy button hover `#1b5e20` → `success.dark`; `getRowStyle` colours `#D9D9D91A` / `#6D94F533` / `#FF0000` → `var(--qp-hover)` / `var(--qp-selected)` / `var(--qp-error)`; `<FallingLines color="white">` → `"currentColor"`.
   - `src/components/sell/UnsignedFees.tsx`: `background: "red"` / `darkred` / `color: "white"` → `bgcolor: "error.main"` / `"error.dark"` / `color: "error.contrastText"`.
   - `src/components/sell/CreateSell.tsx`: `CustomLabel` and `CustomInput` use white/rgba(255,255,255,…) → rewrite as `styled(...)(({ theme }) => …)` with `text.secondary`, `text.primary`, `divider` and `primary.main`; the gateway notice `color: "white"` → `"text.primary"`.
   - `src/components/sell/TradeBotList.tsx`: replace the raw `<button style={{ background: "#4D7345" … }}>` with `<Button variant="contained" color="success">` and the fixed `<Box sx={{ position: "fixed", background: "#323336" … }}>` with the shared `BuyContainer` from `Grids/Table-styles.tsx` (it already positions itself right of the rail and above the phone bottom bar).
   - `src/components/history/History-styles.tsx`: `Refresh` icon `color: "#fff"` → `theme.palette.text.primary`.
   - `src/components/common/reusable-modal/ReusableModal.tsx`: `border: '5px solid #3F3F3F'` → `` `1px solid ${theme.palette.divider}` ``.
   - `src/contexts/gameContext.ts`: remove the stray `import { NULL } from "sass"`, then drop `sass` from package.json (index.scss is already gone).
   - `package.json` version → `1.0.0-plus.1` to match `src/constants/changelog.ts`.
   - Leave alone: `Header-styles.tsx` gradient/inputs (Classic look), `AddressQRCode` (a QR must stay black on white), the SVG icons, and the unused `Info.tsx`, `Game-styles.tsx`, `ReusableModal-styles.tsx` (delete or ignore).
2. **Check the four themes visually** at 1280, 700 and 375 px (`npx vite preview --port 4173` plus a Playwright script; Chromium is at `/opt/pw-browsers/chromium`, pass it as `executablePath`, set `localStorage["qtradeplus-ui-theme"]` to `"hub30" | "hub20" | "black" | "white"` before load). Look at: the nav rail and bottom bar, the Settings page (Account, Appearance, Fees, About; changelog and terms dialogs), the balance card, the coin picker + fee button row, the ag-grid tables (App.css maps ag-grid's variables to `--qp-*`; check the light themes), and the fixed Buy / Cancel bars (`BuyContainer`) not covering the rail or the bottom bar.
3. **Then run the checkpoint steps:** `npm run build && npm test`, `scripts/sync-theme.sh --check`, `scripts/build-zip.sh Q-Trade+` (check `unzip -l release/Q-Trade+.zip | head` shows `index.html` at the root), push, and open the PR: `gh pr create --base main --title "Q-Trade+: React 19.3 / MUI 9.4 + redesign pass 1"` with "Checkpoint reached" in the body.

### Not started

- **Deep-dive audit** (skill step 2) and **Plan** (step 3) are not written. Findings so far to fold in: ag-grid 32 `columnApi` error (above); `sell/Settings.tsx` restores the wrong value (`if (res2) setIsEnabledCustomLockingFee(res)` uses the publisher string instead of `res2`); `TradeOffers.getNewBlockedTrades` calls `/transactions/unconfirmed?txType=MESSAGE&limit=0` (unlimited); three 150 s `setInterval` loops plus qapp-core's own 180 s balance poll run while the tab is hidden; `/names/primary/{address}` lookups are per row with no shared cache across the three tables; all three panes stay mounted (display: none) with their sockets open; `react-ga4` (web2 analytics, unused import), `lodash`, `socket.io-client`, `short-unique-id` are unused dependencies and `axios` is used once; `moment` only formats dates; `index.scss` referenced a `Fira Sans.ttf` that never existed (the Classic font is therefore Fredoka One, which the theme now states explicitly); lint fails at baseline.
- **Efficiency work**: the 2.6 MB chunk is mostly ag-grid (4 tables); replacing it with MUI Table + react-virtuoso is the big win and also removes the ag-grid CSS (200 kB) and the `columnApi` error. Keep the buy selection rule (`signedFee.fee <= fee` per row, PIRATECHAIN single select) byte-for-byte and test it.
- **UX/features** from the brief's ideas: none started.
- **Kit note:** `HubThemeProvider` reads Hub's mode once; `Root.tsx` remounts it (and therefore the app, its sockets and IndexedDB hook) with `key={hostMode}` on THEME_CHANGED. A `hostMode` prop on the provider would avoid the remount (change in `shared/`, not done here).
- **Hub testing:** none of this has run inside Hub yet (cloud session). Test in Hub Dev Mode per docs/HUB-TESTING.md before publishing; check `qortal://APP/Q-Trade+` opens and that the routes `/sell`, `/history`, `/settings` work under the `/render/APP/Q-Trade+` prefix.
