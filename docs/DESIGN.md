# Q-Apps+ design: Hub 3.0

Every + app should feel like part of Qortal Hub 3.0: calm dark surfaces, one soft blue accent, 8 px corners and Inter type. Content comes first. Torq is the worked example. Its theme, layout and Settings page are in `shared/reference/torq/src/`.

## The four themes

Every app ships these four themes, picked on the Settings page and saved per app in `localStorage`:

| id | Card name | Look | Light/dark |
|---|---|---|---|
| `hub30` | Hub 3.0 (default) | Hub chat surfaces `#0E0F14` / `#1D1F27`, soft blue `#84AFF0`; warm paper `#F6F2EA` in light | follows Hub |
| `hub20` | Hub 2.0, or "<App> Classic" | The app's original colours and shapes, carried over from its old theme file | follows Hub |
| `black` | Black | X-style lights-out: pure black, X blue `#1d9bf0`, grey `#2f3336` borders, pill buttons | always dark |
| `white` | White | Clean white, black text and primary, `#e6e6e6` borders, pill buttons | always light |

"Follows Hub" means the mode Hub passes in (`window._qdnTheme` or `?theme=`). The kit handles all of this; see `shared/hub-theme/README.md`.

**Hub 2.0 is the "keep it how it was" option.** Build it from the app's existing `createTheme` options, moved into the kit's `hub20Options(mode)`. Keep the layout changes: only the palette, type and shape come from the old theme. Name the card after the app if that reads better, e.g. "Q-Tube Classic".

## Layout

Follow Torq's structure, adjusted to the app's content:

- **Desktop (≥ 900 px):** a left navigation rail with icon and label, the main column centred with a comfortable max width (~600–760 px for feeds and lists, wider for grids such as Q-Tube and Q-Shop), and an optional right rail for context such as filters, trending or wallet balance. Rails use `headerFill(theme)` or `var(--qp-chrome)`, not solid paper.
- **Phone / GO (< 600 px):** a bottom navigation bar with at most 5 items, a sticky header that hides when you scroll down and returns when you scroll up, and full-width content. Tap targets are at least 40 px. Respect `env(safe-area-inset-*)`.
- **Small Hub windows:** Hub often runs apps in a narrow pane. Use the phone layout below 600 px wide, whatever the device.
- **Headers:** sticky and translucent (`headerFill`), with a 1 px `divider` bottom border, the title on the left and actions on the right.
- **Cards and lists:** `background.paper`, 8 px radius (the kit sets this per theme), `divider` borders, and a hover of `action.hover`.

## Settings page

Settings is a full page reached from the nav, not a small modal. Sections run in this order, each with a small uppercase `text.secondary` title:

1. **Account**: the active Qortal name, with a name switcher if the app supports several names.
2. **Appearance**: `<ThemePicker />` from the kit. Add app-specific display options here, such as density or grid/list.
3. **App sections**: the options that make sense for the app, such as notifications, default filters, hidden words or users, and wallet defaults.
4. **Sync** (optional, recommended): save/restore these settings to QDN under the user's name, like Torq's `settingsQdn.ts`.
5. **About**: the version and a button that opens a changelog dialog (Torq's `ChangelogDialog.tsx`), plus links to the upstream app and source.

## Components and states

- **Colour:** always use the theme (`theme.palette.*`, `theme.qplus.*` or `var(--qp-*)`), so all four themes work. For accents on selected or active items, use `primarySoft(theme)`.
- **Loading:**
  - Use skeletons that match the final layout, not a spinner over a blank page.
  - Show cached data at once, then refresh.
  - Make likes, votes and follows optimistic.
- **QDN resources that aren't downloaded yet:** show "Fetching from peers…" with the progress from `GET_QDN_RESOURCE_STATUS` or qapp-core's `useResourceStatus`, and offer retry. Don't show a broken image.
- **Empty states:** one line explaining why the view is empty, plus the next action, e.g. "No mail yet · Compose".
- **Errors:** say what failed in plain words and offer Retry. Never show a raw stack trace or `[object Object]`.
- **Dialogs:** confirm anything that publishes, spends QORT or deletes. Say what will happen and what it costs.
- **Motion:** 150–200 ms ease on hover and state changes. Honour `prefers-reduced-motion`.
- **Accessibility:**
  - Every icon button has an `aria-label`.
  - Focus is visible (`:focus-visible` outline in `primary`).
  - Text contrast is at least 4.5:1 in all four themes. Check the White and Black themes especially.
- **Copy:** short and plain, in sentence case. Keep existing i18n keys and add new strings to every locale file the app has, using English as the fallback.

## Checklist for a finished redesign

- [ ] `HubThemeProvider` wraps the app; all four themes switch live and survive a reload.
- [ ] The `index.html` boot snippet is installed, so there's no flash of the wrong background.
- [ ] Hub 2.0 looks like the original app.
- [ ] Nothing is hard-coded to one theme: `grep -rE "#[0-9a-fA-F]{3,6}\b" src` outside the theme files finds only intentional brand art.
- [ ] The Settings page has the sections above, and the version opens the changelog.
- [ ] The desktop, small-window and phone layouts all work (check at 1280, 700 and 375 px).
- [ ] Every screen has loading, empty and error states.
- [ ] The Inter font comes from the kit (`fonts.css`), not the web.
