# Q-Apps+

New launcher that presents every + app in one user-friendly place.

## Baseline at import

- **Upstream:** none (new app)
- **Stack:** New. Use Torq's stack: React 19, MUI 7, qapp-core, jotai, Vite, TypeScript, vitest
- **Original theme (becomes Hub 2.0):** shared/hub-theme (Hub 3.0 default)
- **i18n:** start English-only, structured for i18n
- **Tests:** none
- **QDN services:** APP (reads metadata of the + apps), THUMBNAIL (app icons)
- **Identifiers seen (partial; complete this in the audit):** none of its own at first
- **Qortal calls (counts in source):** SEARCH_QDN_RESOURCES (service APP, exact names), GET_QDN_RESOURCE_STATUS

## Notes

- Build this last, once the other apps have briefs with final names and descriptions.
- Content comes from a static manifest in the app (name, tagline, category, what's new, upstream app) plus live QDN metadata for each `APP` resource (last updated, size, rating if available). Use one batched search with `names` + `exactMatchNames`, not one search per app.
- Opening an app: `qortal://APP/<encodeURIComponent(name)>`. Test that names with `+` open.
- Nice touches: "what's new" per app from its changelog, a "compare with original" note (e.g. Q-Mail+ vs Q-Mail), and a theme that matches the others.

## Feature ideas to weigh in the audit

- search and categories
- recently opened
- app detail page with screenshots and changelog
- link to each app's original version

## Audit

_To fill in: architecture map, full list of QDN services and identifiers, every Qortal call and when it fires, performance hotspots, UX problems, bugs found. Rank each by impact._

## Plan

_To fill in: this pass's scope (theme kit and Settings, top efficiency fixes, top UX fixes, 2–4 features), plus anything deliberately deferred._

## Done

_To fill in: what changed, with before/after numbers (searches on first load, biggest chunk, dist size)._

## Follow-ups

_To fill in: open questions for Simon, and ideas for the next pass._
