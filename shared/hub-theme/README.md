# hub-theme: the Q-Apps+ theme kit

This kit gives every + app the same four themes (Hub 3.0, Hub 2.0, Black and White), a pre-load script that stops the wrong background flashing, and a Settings theme picker. It's ported from Torq and works with MUI 5 and MUI 7. `scripts/check-theme-kit.sh` tests both.

| File | What it is |
|---|---|
| `tokens.ts` | **Source of truth.** Palettes, chrome tokens, shapes, theme list, `cssVariables()`. No dependencies. |
| `mui-theme.ts` | `createAppTheme(id, hostMode, config)` plus helpers: `headerFill`, `embedFill`, `primarySoft`, `accentWash`, `appSurface`, `fadeEdge`. |
| `mui-augment.d.ts` | Adds `theme.qplus` and `background.surface` / `background.elevated` to MUI's types. |
| `HubThemeProvider.tsx` | Wraps the app; `useHubTheme()` returns `{ uiTheme, setUiTheme, mode, hostMode }`. |
| `ThemePicker.tsx` | The four theme cards for Settings. |
| `boot.ts` | Reads Hub's mode (`_qdnTheme` / `?theme=`) and the saved theme; paints `<html>`. |
| `fonts.css` + `fonts/` | Inter 400/500/600/700 as woff2 (~100 KB each; SIL OFL, see `fonts/LICENSE-Inter.txt`). |
| `hub-theme.css` | *Generated.* `--qp-*` CSS variables per theme, for apps without MUI. |
| `boot-inline.js` | *Generated.* Snippet for `<head>` in `index.html`. |
| `build-css.mjs` | Regenerates the two files above from `tokens.ts`. |
| `dev/smoke.tsx` | Smoke test used by `scripts/check-theme-kit.sh`. |

Edit `tokens.ts` or the `.tsx` files here, never an app's copy. Afterwards run:

```bash
scripts/sync-theme.sh                # regenerates CSS, copies into every opted-in app
scripts/check-theme-kit.sh Q-Mail+   # MUI 5 / TS 4.9
scripts/check-theme-kit.sh Q-Tube+   # MUI 7 / TS 5.9
```

## Adding it to a React + MUI app

1. **Opt in and copy.** Run `mkdir "apps/<App+>/src/hub-theme" && scripts/sync-theme.sh`. The copy is committed with the app so that the app builds on its own.
2. **Make sure TypeScript sees the augmentation.** `src/hub-theme/mui-augment.d.ts` must be inside the app's `tsconfig` `include` (usually `src`). If the app already augments MUI's `Theme`, keep both; interfaces merge.
3. **Move the old theme into Hub 2.0.** Create `src/theme/qplus-theme.ts`:

   ```ts
   import type { AppThemeConfig } from '../hub-theme';
   import { lightThemeOptions, darkThemeOptions } from '../styles/theme'; // the app's existing options

   export const THEME_STORAGE_KEY = 'qmailplus-ui-theme'; // unique per app

   export const themeConfig: AppThemeConfig = {
     hub20: {
       name: 'Q-Mail Classic',
       description: 'The original Q-Mail colours',
       swatches: ['#1b1b1b', '#2a2a2a', '#1976d2', '#f5f5f5'],
       bootBackground: { light: '#f5f5f5', dark: '#1b1b1b' },
     },
     hub20Options: (mode) => (mode === 'dark' ? darkThemeOptions : lightThemeOptions),
   };
   ```

   If the app only exports finished `Theme` objects, change its theme file to export the options object instead. `createTheme(options)` is what the kit needs.
4. **Swap the provider.** Replace the app's `ThemeProvider` / `CssBaseline` (and any light/dark toggle state) with:

   ```tsx
   import { HubThemeProvider } from './hub-theme';
   import './hub-theme/fonts.css';
   import { themeConfig, THEME_STORAGE_KEY } from './theme/qplus-theme';

   <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
     <App />
   </HubThemeProvider>
   ```

   If the app had its own light/dark switch, remove it. Mode now comes from Hub, and Black and White fix their own mode. The rest of the app can read `useHubTheme().mode` if it needs to.
5. **Install the boot snippet.** Paste `boot-inline.js` inside a `<script>` at the top of `<head>` in `index.html`. Set `STORAGE_KEY` to the same key as step 3, and `HUB20` to the same colours as `bootBackground`.
6. **Add Settings.** Put `<ThemePicker />` in the Appearance section (see `docs/DESIGN.md`).
7. **Clean up hard-coded colours.** Swap them for `theme.palette.*`, the kit helpers or `var(--qp-*)`, then check all four themes.

## Adding it to a plain HTML/JS app (Q-Mintership+, maybe Q-Apps+)

1. **Opt in and copy.** Run `mkdir "apps/<App+>/assets/hub-theme" && scripts/sync-theme.sh`.
2. **Load the kit.** Put the boot snippet in `<head>` (as above), then:

   ```html
   <link rel="stylesheet" href="assets/hub-theme/fonts.css" />
   <link rel="stylesheet" href="assets/hub-theme/hub-theme.css" />
   ```

3. **Define Hub 2.0.** Write the app's original colours as `:root[data-ui-theme='hub20'] { --qp-bg: …; … }`, using the same variable names as `hub-theme.css`.
4. **Point the styles at the variables.** Make the app's CSS use the `var(--qp-*)` variables.
5. **Switch themes.** Set `document.documentElement.dataset.uiTheme`, and `dataset.theme` for light/dark, and save the choice as `JSON.stringify(id)` under the storage key.

## Theme rules

- `hub30` is the default. `hub30` and `hub20` follow Hub's light/dark, `black` is always dark and `white` is always light.
- The storage format is a JSON string (`"hub30"`), the same as jotai's `atomWithStorage`, so a jotai atom can share the key.
