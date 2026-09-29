# Q-Mintership+

Forum and admin boards for the Qortal minting group: minter cards, nominations, polls, admin approvals.

## Baseline at import

- **Upstream:** [Qortal/Q-Mintership-Alpha](https://github.com/Qortal/Q-Mintership-Alpha) branch `Nominations` at `cb6fcef` (2026-06-04, 95 commits)
- **Stack:** Plain HTML/JS (Mobirise + Bootstrap), no build step. `index.html` + `assets/`
- **Original theme (becomes Hub 2.0):** `assets/css/`, `assets/theme/css/style.css` (Mobirise)
- **i18n:** no
- **Tests:** none
- **Build:** none (static files)
- **QDN services:** BLOG_POST, MAIL_PRIVATE, FILE_PRIVATE, DOCUMENT
- **Identifiers seen (partial; complete this in the audit):** `mintership-forum-message`, `mintership-forum-attachment`, `card-MAC`, `QM-AR-card`, `grp-`, `Q-Mintership-blockedNames`, `_mail_qortal_qmail_`
- **Qortal calls (counts in source):** FETCH_QDN_RESOURCE ×15, SIGN_TRANSACTION ×8, PUBLISH_QDN_RESOURCE ×8, SEARCH_QDN_RESOURCES ×4, CREATE_POLL ×3, VOTE_ON_POLL ×2, JOIN_GROUP ×2, ENCRYPT_QORTAL_GROUP_DATA

## Notes

- This uses upstream branch **`Nominations`** (v3.0.2, 2026-06-04, crowetic), which is 14 commits ahead of `main` and has the new look and the nominations board.
- **Has ~21 `limit: 0` (unlimited) searches**, the heaviest in the repo and the biggest efficiency win.
- Group approvals use `SIGN_TRANSACTION` for group admin actions. Keep those exact.
- No build step: use the plain-JS path of the theme kit (`assets/hub-theme/`). Whether to move it to Vite + React is a plan decision. If you do, make it a separate, clearly marked step and keep the same QDN data.
- `BACKUP/removedFromMinterBoard.js` is upstream's parked code. Leave it out of the publish zip (build-zip.sh already does).

## Feature ideas to weigh in the audit

- paged boards (no unlimited loads)
- card status at a glance
- nomination and vote progress
- search within boards

## Audit

_To fill in: architecture map, full list of QDN services and identifiers, every Qortal call and when it fires, performance hotspots, UX problems, bugs found. Rank each by impact._

## Plan

_To fill in: this pass's scope (theme kit and Settings, top efficiency fixes, top UX fixes, 2–4 features), plus anything deliberately deferred._

## Done

_To fill in: what changed, with before/after numbers (searches on first load, biggest chunk, dist size)._

## Follow-ups

_To fill in: open questions for Simon, and ideas for the next pass._
