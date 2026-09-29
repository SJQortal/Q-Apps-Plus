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

_To fill in: what changed, with before/after numbers (searches on first load, biggest chunk, dist size)._

## Follow-ups

_To fill in: open questions for Simon, and ideas for the next pass._
