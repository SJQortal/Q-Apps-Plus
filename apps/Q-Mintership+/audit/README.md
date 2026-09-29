# Legacy audit findings (raw, partial)

Structured findings from reading the original app's JS, produced by the phase-1
session before it was paused. Each file covers one legacy source file (or part
of one) and lists identifiers, Qortal calls, transactions, features, routes,
constants, localStorage keys and bugs with line numbers. They feed the data
contract and parity checklist in `docs/apps/Q-Mintership+.md`.

Done so far: `qortalapi.json` (QortalApi.js), `qmintership.json`
(Q-Mintership.js), `shared-1.json` (Shared.js lines 1–2350). Still to read:
Shared.js 2300–4546, MinterBoard.js (4 parts), StatsBoard.js (2 parts),
AdminBoard.js, ARBoard.js, AdminTools.js + BACKUP, and index.html + CSS. Claims
have not yet been verified against the source; treat them as a draft.
