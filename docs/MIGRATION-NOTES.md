<!-- Researched 2026-09-29 from the official React, MUI, React Router, Redux, Vite and TypeScript sources cited in each section. Items marked UNVERIFIED or "inference" were not confirmed in a source. docs/PLATFORM.md is the project plan; this file is the reference checklist behind it. -->

## Q-Apps+ specifics (read first)

These come from checking the actual apps in this repo against the notes below:

- **`react-quill` 2.0.0 crashes on React 19.** It calls `ReactDOM.findDOMNode` (`lib/index.js`), which React 19 removed, so the editor won't mount. This affects **Q-Mail+, Q-Share+, Q-Support+ and Q-Fund+**.
  - Switch to **`react-quill-new`** (3.8.x, React 19 peer), which Q-Tube+ and Torq already use.
  - It runs on **Quill 2**, which writes some HTML differently from Quill 1 (for example list markup). Content written by a + app must still display correctly in the original app (ground rule 1). Before shipping, check with real messages and posts in both directions, and add a small conversion layer if the stored format differs.
  - Check any Quill 1 plugins (image resize, etc.) for Quill 2 versions.
- **Q-Fund+ uses `@mui/x-date-pickers` 6.** MUI 9 needs MUI X **9**, which has its own migration guides (v6 → v7 → v8 → v9), not covered below. Keep the date values and formats it stores unchanged.
- **qapp-core apps** (Q-Tube+, Q-Trade+, Names+, Q-Node+) need the `overrides` + icon alias workaround in docs/PLATFORM.md.
- **Grid:** Q-Shop+ (4 files), Q-Fund+ (2), Q-Share+ (1) and Q-Support+ (1) use the legacy `Grid` with `item`. Use the v7 `grid-props` codemod, then check the layouts visually (spacing is now `gap`).
- **No app uses `@mui/styles` / `makeStyles`**, so the JSS migration isn't needed.
- **React Router:** Names+, Q-Node+ and Q-Tube+ are on v7 already. Q-Trade+ and the Redux apps are on v6, which accepts React 19. Moving to v7 is optional; enable the `v7_*` future flags first.

---

# Upgrade notes: React 19.3.0 + @mui/material 9.4.0

Researched 2026-09-29. Sources are the official repos and docs listed in each section. Everything below was read in those sources unless it is marked **UNVERIFIED** or **inference**.

Baselines:
- **(a)** React 18.2, MUI 5.11, @mui/icons-material 5, Emotion 11, RTK 1.9, react-router-dom 6, Vite 4/5, TS 4.9
- **(b)** React 19.x, MUI 7.x, Vite 6/7, TS 5.x

## 0. Target versions (latest as of 2026-09-29)

| Package | Latest | Notes |
|---|---|---|
| react / react-dom | **19.3.0** (2026-09-09) | |
| @types/react / @types/react-dom | 19.x | Match the React major version |
| @mui/material, @mui/system, @mui/icons-material | **9.4.0** (2026-08-27) | There is no v8. The changelog says "v8 is skipped to align the release version with MUI X v9". |
| @mui/lab | 9.0.0-beta.9 | Lab stays on beta |
| @mui/codemod | use `@latest` (≥ 9.3.1) | 9.3.1 fixed the published package, which shipped without its transforms |
| @mui/x-* (data-grid, date-pickers) | 9.14.0 | X v9 accepts `@mui/material ^7.3.0 \|\| ^9.0.0`. X v8.29.x accepts only `^5.15.14 \|\| ^6 \|\| ^7`. MUI 9 therefore needs MUI X v9. |
| @emotion/react / @emotion/styled | 11.14.0 / 11.14.1 | MUI 9 peer deps: `^11.5.0` / `^11.3.0` |
| react-router | 8.4.0 (v7 line is at 7.18.4, v6 line at 6.30.6) | See section 3 |
| @reduxjs/toolkit / react-redux | 2.13.0 / 9.3.0 | |
| vite / @vitejs/plugin-react | 8.3.1 / 6.1.1 | |
| typescript | 5.9.3, 6.0.3, 7.0.2 (GitHub release tags) | |
| @testing-library/react | 16.3.3 | React 19 is in its peer range from 16.1.0 |

**MUI 9 peer deps** (from `packages/mui-material/package.json` @ 9.4.0): `react`, `react-dom` and `@types/react` at `^17 || ^18 || ^19`, plus `@emotion/react ^11.5.0` and `@emotion/styled ^11.3.0` (Emotion is optional only if you use Pigment/styled-components). MUI depends on `react-is ^19.3.0`.

---

## 1. React 18 → 19.3

Sources:
- https://react.dev/blog/2024/04/25/react-19-upgrade-guide (raw: github.com/reactjs/react.dev/…/2024/04/25/react-19-upgrade-guide.md)
- https://github.com/facebook/react/blob/main/CHANGELOG.md
- https://react.dev/blog/2025/10/01/react-19-2
- https://react.dev/blog/2026/09/09/react-19-3
- https://react.dev/blog/2022/03/08/react-18-upgrade-guide (browser requirements)

### 1.1 Before you start
- [ ] Move to **react@18.3.1** first. It is identical to 18.2 but warns about every API that React 19 removes. Fix all of those warnings on 18.3.
- [ ] The **new JSX transform is required**. Without it React logs an "outdated JSX transform" error. Use `"jsx": "react-jsx"` in tsconfig. @vitejs/plugin-react already uses the automatic runtime.
- [ ] Install `react@19.3.0 react-dom@19.3.0 @types/react@^19 @types/react-dom@^19`.

### 1.2 Codemods
```bash
npx codemod@latest react/19/migration-recipe        # runs replace-reactdom-render, replace-string-ref,
                                                    # replace-act-import, replace-use-form-state, prop-types-typescript
npx types-react-codemod@latest preset-19 ./src      # TS type changes (not included in the recipe)
npx types-react-codemod@latest react-element-default-any-props ./src   # only if you have a lot of unsound element.props access
```
You can also run the individual codemods: `react/prop-types-typescript`, `react/19/replace-string-ref`, `react/19/replace-act-import` and `react/19/replace-reactdom-render`.

### 1.3 Breaking changes that commonly bite
- [ ] **`ReactDOM.render` / `ReactDOM.hydrate` removed.** Use `createRoot(el).render(<App/>)` / `hydrateRoot` from `react-dom/client`. Codemod: `replace-reactdom-render`.
- [ ] **`unmountComponentAtNode` removed.** Use `root.unmount()`.
- [ ] **`ReactDOM.findDOMNode` removed.** Use refs.
- [ ] **`propTypes` checks removed.** They are silently ignored now.
- [ ] **`defaultProps` removed for function components.** Use ES default parameters. Class components keep `defaultProps`.
- [ ] **Legacy context removed** (`contextTypes`, `childContextTypes`, `getChildContext`). Use `static contextType` or `createContext`.
- [ ] **String refs removed** (`ref="input"`, `this.refs`). Use callback refs or `useRef`. Codemod: `replace-string-ref`.
- [ ] **Module-pattern factories removed, and so is `React.createFactory`.**
- [ ] **`react-dom/test-utils` removed** except for `act`. Change `import {act} from 'react-dom/test-utils'` to `import {act} from 'react'`. Codemod: `replace-act-import`.
- [ ] **`react-test-renderer/shallow` removed.** Install `react-shallow-renderer` instead. `react-test-renderer` itself is now deprecated.
- [ ] **`element.ref` is deprecated.** `ref` is now a regular prop, read it as `element.props.ref`. Reading `element.ref` logs a warning. This is why **MUI 5.11 does not work cleanly on React 19** (see 1.6).
- [ ] **Errors thrown during render are no longer re-thrown.**
  - Uncaught errors go to `window.reportError`. Caught errors go to `console.error`.
  - If your error reporting relied on the re-throw, use `createRoot(el, { onUncaughtError, onCaughtError })`.
- [ ] **UMD builds removed.**
- [ ] Other react-dom breaking changes:
  - `javascript:` URLs in `src`/`href` now throw an error.
  - `errorInfo.digest` removed from `onRecoverableError`.
  - `unstable_flushControlled`, `unstable_createEventHandle`, `unstable_renderSubtreeIntoContainer` and `unstable_runWithPriority` removed.
  - Deprecated `react-is` methods removed.
- [ ] Libraries that use React internals (`SECRET_INTERNALS…`) may break. Audit old dependencies.

### 1.4 TypeScript changes (@types/react 19)
- [ ] **`useRef()` now requires an argument.** Use `useRef(null)` or `useRef(undefined)`. All refs are now mutable `RefObject<T>`, and `MutableRefObject` is deprecated. Fixed by codemod `refobject-defaults`.
- [ ] **Ref callbacks can't implicitly return a value** because of the new ref cleanup functions. Change `ref={el => (x = el)}` to `ref={el => { x = el }}`. Fixed by codemod `no-implicit-ref-callback-return`.
- [ ] **The global `JSX` namespace is gone.** Use `React.JSX`. Wrap augmentations in `declare module "react" { namespace JSX { … } }`, or in `react/jsx-runtime` when using `jsx: react-jsx`. Fixed by codemod `scoped-jsx`.
- [ ] **`ReactElement["props"]` now defaults to `unknown` instead of `any`.**
- [ ] **`useReducer` type args changed.** Drop `useReducer<React.Reducer<S, A>>`. Let it infer, or use `useReducer<S, [A]>`.
- [ ] Deprecated types are removed. Run `types-react-codemod preset-19`.

### 1.5 What changed in 19.1, 19.2 and 19.3

**19.1.0** (2025-03-28)
- Adds `captureOwnerStack` (dev only).
- `useId` format changed from `:r123:` to `«r123»`.
- `React.act` is no longer available in production builds. Tests must run with NODE_ENV≠production.
- HTML comments can no longer be used as a DOM container.
- Suspense improvements.

**19.2.0** (2025-10-01)
- New APIs: `<Activity>`, `useEffectEvent`, `cacheSignal`, Performance Tracks, and partial-prerender `resume*` APIs.
- **The `useId` prefix changed again, to `_r_`.** Snapshot tests and any CSS or DOM selectors that depend on generated IDs will change.
- SSR batches Suspense boundary reveals.
- The Context display name is now "SomeContext" instead of "SomeContext.Provider".
- **`eslint-plugin-react-hooks` v6:** `recommended` is now flat config. Legacy `.eslintrc` users must switch to `plugin:react-hooks/recommended-legacy`.

**19.3.0** (2026-09-09)
- New stable APIs: `<ViewTransition>` with `addTransitionType`, Fragment refs, the react-dom `browser()` API, and Trusted Types integration (values are no longer coerced to strings).
- Behavior changes to watch:
  - Transitions now render independently instead of being entangled into one render.
  - StrictMode double-invokes effects during hydration and after Fast Refresh (dev only).
  - New dev warning when `use()` is called conditionally.
  - `resize` event updates are batched until the next frame.
  - `defaultValue` on `type="number"` inputs now matches the other input types.
  - `onReset` fires on automatic form reset.
  - `submitter` is included in `submit` events.
- The changelog marks none of these as breaking.

### 1.6 React 19 compatibility of the rest of the stack
- MUI 5.11 declares `react ^17 || ^18` only.
  - MUI **5.16.8+** adds `^19` to the peer range (5.18.0 is the last v5).
  - MUI **6.2.0** changelog: "Material UI is now compatible with React 19".
- React Testing Library needs **@testing-library/react ≥ 16.1.0** for React 19 in its peer range. 16.0 is React 18 only.
- Emotion: use **@emotion/react ≥ 11.12.0**. That release improved compatibility with React 19 types (no global `JSX` namespace) and forwards only defined refs. Latest is 11.14.0.
- Redux and React Router: see section 3.

---

## 2. MUI 5 → 6 → 7 → 9

Sources:
- https://mui.com/material-ui/migration/upgrade-to-v6/ (raw: github.com/mui/material-ui/blob/master/docs/data/material/migration/upgrade-to-v6/upgrade-to-v6.md)
- https://mui.com/material-ui/migration/upgrade-to-v7/ (…/upgrade-to-v7/upgrade-to-v7.md)
- https://mui.com/material-ui/migration/upgrade-to-v9/ (…/upgrade-to-v9/upgrade-to-v9.md)
- https://mui.com/material-ui/migration/upgrade-to-grid-v2/
- https://mui.com/material-ui/migration/migrating-from-deprecated-apis/
- https://github.com/mui/material-ui/blob/master/packages/mui-codemod/README.md
- https://github.com/mui/material-ui/blob/master/CHANGELOG.md and CHANGELOG.old.md

### 2.1 v5 → v6 (6.0.0, Aug 2024)

**Requirements**
- [ ] Minimum React 17.
- [ ] Minimum TypeScript **4.7**.
- [ ] Node **14**.
- [ ] Browsers: Chrome 109, Edge 121, Firefox 115, Safari 15.4 (macOS and iOS). IE 11 dropped.
- [ ] UMD bundle removed.
- [ ] **If you stay on React 18 while on MUI v6 or v7,** pin `react-is` to your React version with an `overrides`/`resolutions` entry (for example `"react-is": "^18.3.1"`). MUI 6 and 7 use react-is@19, and a mismatch causes prop-type runtime errors. This is not needed once you are on React 19.

**Breaking changes**
- [ ] **`ListItem`:** the `button`, `autoFocus`, `disabled` and `selected` props are removed. Use `<ListItemButton>`. `listItemClasses.button/focusVisible/disabled/selected` move to `listItemButtonClasses.*`. Codemod: `v6.0.0/list-item-button-prop`.
- [ ] **`Unstable_Grid2` is renamed to `Grid2`.**
  - `xs`/`sm`/… and `*Offset` become `size={{…}}` and `offset={{…}}`. A bare `xs` becomes `size="grow"`.
  - `disableEqualOverflow` is removed.
  - Spacing now uses CSS `gap`. Containers no longer grow to full width; add `sx={{ width: '100%' }}` or `flexGrow: 1`.
  - Codemod: `v6.0.0/grid-v2-props`. Rename the import first.
  - Only applies if you used Grid2 on v5. The legacy `Grid` is unchanged in v6.
- [ ] **Accordion:**
  - The summary is wrapped in an `<h3>`. Change it with `slotProps.heading.component`.
  - From 6.3.0 the `AccordionSummary` root is a `<button>` and its content and icon are `<span>`s. Use `<Typography component="span">` inside it.
- [ ] **Autocomplete `onInputChange`:** new `reason` values `"blur"`, `"selectOption"` and `"removeOption"` replace some cases that used to report `"reset"`.
- [ ] **Chip:** keeps focus on Esc.
- [ ] **Divider:** vertical dividers render a `<div>` instead of `<hr>`. Update any `& hr` selectors.
- [ ] **`LoadingButton` removed from @mui/lab** (from material 6.4.0). Use `<Button loading>`.
- [ ] **Typography `color`** is no longer a system prop. Use `sx` for theme callbacks.
- [ ] `useMediaQuery` types `MuiMediaQueryList*` removed.
- [ ] **Types:** `component` is removed from `BoxOwnProps`. Change `styled(Box)` to `styled('div')`, or cast.
- [ ] **Tests:** the ripple changes mean button, Checkbox, Chip, Radio, Switch and Tabs interactions may need `await act(async () => fireEvent…)`.

**Stabilized APIs and deprecations (not yet breaking)**
- `CssVarsProvider` and `extendTheme` lose their `experimental_` prefix.
- New `theme.applyStyles('dark', …)`.
- System props (`mt`, `bgcolor`, …) are deprecated on Box, Typography, Link, Grid and Stack. They are **removed in v9**.
- Theme `components.MuiX.variants` moves to `styleOverrides.root.variants` (codemod `theme-v6`).

**v6 codemods**
```bash
npx @mui/codemod@latest v6.0.0/list-item-button-prop <src>
npx @mui/codemod@latest v6.0.0/styled <src>          # theme.palette.mode ternaries -> theme.applyStyles
npx @mui/codemod@latest v6.0.0/sx-prop <src>
npx @mui/codemod@latest v6.0.0/theme-v6 <theme-file> # only the file(s) containing styleOverrides/variants
npx @mui/codemod@latest v6.0.0/grid-v2-props <src>   # only if you used Unstable_Grid2 (rename import first)
# v6.0.0/system-props exists, but prefer v9.0.0/system-props (it is a superset), see 2.3
```

### 2.2 v6 → v7 (7.0.0, Mar 2025)

**Requirements**
- [ ] Minimum TypeScript **4.9**.
- [ ] `@types/react*` major must match the React major.
- [ ] Browser targets: the v7 guide lists no changes. The v9 guide's "up from" values confirm v7 used the same targets as v6.

**Breaking changes**
- [ ] **Package layout now uses `exports`.**
  - **Deep imports more than one level deep no longer work.** For example `@mui/material/styles/createTheme` becomes `import { createTheme } from '@mui/material/styles'`.
  - `/modern` bundles are removed. Delete any bundler aliases to them.
  - Delete any Vite alias that rewrites `@mui/icons-material/*` to `@mui/icons-material/esm/*`.
- [ ] **Theme augmentation paths change.** `declare module '@mui/material/styles/createTypography'` becomes `declare module '@mui/material/styles'`.
  - `TypographyOptions` is renamed `TypographyVariantsOptions`.
  - `Typography` is renamed `TypographyVariants`.
- [ ] **Grid renames:**
  - The legacy `Grid` becomes **`GridLegacy`**, along with `MuiGridLegacy` in the theme and `.MuiGridLegacy-root`.
  - **`Grid2` becomes `Grid`**, including `gridClasses`, `GridProps`, `MuiGrid` and `.MuiGrid-root`.
  - To go straight to the new Grid, run `v7.0.0/grid-props`. It targets imports from `@mui/material/Grid` and removes `item` and `zeroMinWidth`. It does not cover wrapped or `styled(Grid)` components.
- [ ] **`InputLabel size="normal"` becomes `"medium"`.** Codemod: `v7.0.0/input-label-size-normal-medium`. The `MuiInputLabel-sizeMedium` class is no longer added.
- [ ] **Icons:** the default `data-testid` is removed from icons in production bundles.
- [ ] **`TablePaginationActionsProps` import path** changes to `@mui/material/TablePaginationActions`.
- [ ] **Theme behavior with CSS vars and built-in light/dark schemes:** the theme object no longer changes when the mode changes.
  - Use `theme.vars.*`, `color-mix()` or `theme.applyStyles`.
  - To opt out, use `<ThemeProvider forceThemeRerender>`.
- [ ] **Removed (deprecated since v5):**
  - `createMuiTheme` → use `createTheme`
  - `experimentalStyled` → use `styled`
  - `Hidden` and `PigmentHidden` → use `sx` display rules or `useMediaQuery`
  - `onBackdropClick` on Dialog and Modal → use `onClose(event, reason === 'backdropClick')`
  - `.MuiRating-readOnly` → use `.Mui-readOnly`
  - `StepButtonIcon` type → use `StepButtonProps['icon']`
  - `StyledEngineProvider` from `@mui/material` → import from `@mui/material/styles`
- [ ] **Lab components moved into @mui/material:**
  - Components: Alert, AlertTitle, Autocomplete, AvatarGroup, Pagination, PaginationItem, Rating, Skeleton, SpeedDial, SpeedDialAction, SpeedDialIcon, ToggleButton, ToggleButtonGroup.
  - Hook: `usePagination`.
  - Codemod: `v7.0.0/lab-removed-components`. It does not fix type imports.
- [ ] **`@mui/styles` (JSS `makeStyles`/`withStyles`):** its code was removed from the repo in v7, so its last line is 6.x (6.4.8 peers React ^19).
  - **UNVERIFIED** whether it works with a MUI 9 theme.
  - Migrate to `styled`/`sx` (or tss-react) before going to v9.

**Optional in v7:**
- CSS layers via `<StyledEngineProvider enableCssLayer>`
- Native color (`nativeColor`)
- Codemod `v7.0.0/theme-color-functions` (`alpha()` → `theme.alpha()`)

**v7 codemods**
```bash
npx @mui/codemod@latest v7.0.0/lab-removed-components <src>
npx @mui/codemod@latest v7.0.0/input-label-size-normal-medium <src>
npx @mui/codemod@latest v7.0.0/grid-props <src>      # legacy Grid -> new Grid (run only once you're on v7+ packages)
#   custom breakpoints: --jscodeshift='--muiBreakpoints=mobile,desktop'
```

### 2.3 v7 → v9 (9.0.0, Apr 2026; latest 9.4.0)

**Requirements and targets**
- [ ] Browsers: **Chrome 117, Edge 121, Firefox 121, Safari 17.0 (macOS and iOS)**.
- [ ] TypeScript minimum stays **4.9** (supported-platforms page).
- [ ] Node 14+ for SSR.
- [ ] React `^17 || ^18 || ^19`.
- [ ] Update @mui/icons-material, @mui/system, @mui/utils and @mui/styled-engine to 9. Put @mui/lab on its latest v9 beta.

**Behavior and API breaking changes**
- [ ] **`GridLegacy` removed.** Use `Grid` with `size`; drop `item`. `MuiGridLegacy` is removed from the theme types.
- [ ] **`Grid direction="column"` and `"column-reverse"` removed.** Use `<Stack>`.
- [ ] **`disableEscapeKeyDown` removed from Dialog and Modal.** Filter `reason !== 'escapeKeyDown'` in `onClose` instead.
- [ ] **ButtonBase and every button-like component:**
  - Enter/Space clicks now **bubble**, and `onClick` receives a `MouseEvent`.
  - Disabled non-native buttons no longer run their handlers.
  - New **`nativeButton`** prop. It is needed when `component={X}` changes whether the rendered element is a native `<button>`. MUI shows a dev warning on mismatch.
  - **inference:** from reading `ButtonBase.js`, `href`/`to` links are exempt from the mismatch check. A custom component that renders a real `<button>` needs `nativeButton`.
- [ ] **Menu / MenuList:**
  - Roving `tabindex`.
  - **`MenuItem` rendered outside Menu or MenuList now throws.**
  - Custom `role="menuitem"` children that don't wrap `MenuItem` are no longer supported.
  - `muiSkipListHighlight` is no longer needed.
- [ ] **Tabs:** roving `tabindex`. **A `Tab` rendered outside `Tabs` now throws.**
- [ ] **Stepper:**
  - `Stepper` renders `<ol>` and `Step` renders `<li>`.
  - With `StepButton`, it uses tablist/tab roles, `aria-selected` and roving tabindex.
- [ ] **Slider:** uses pointer events. Cancel a drag with `onPointerDown` instead of `onMouseDown`.
- [ ] **TablePagination:** numbers are formatted with `Intl.NumberFormat`. Override `labelDisplayedRows` to opt out.
- [ ] **`TextField select`:** the label renders a `<div>` instead of a `<label>`.
- [ ] **Backdrop:** no longer sets `aria-hidden` by default.
- [ ] **Autocomplete:**
  - Right click no longer toggles the listbox.
  - With `freeSolo`, the types of `getOptionLabel` and `isOptionEqualToValue` args now include `string`.
- [ ] **`ListItemIcon` min-width** changes from 56px to **36px**.
- [ ] **Icons:** 23 duplicate `*Outline` exports are removed. Use `*Outlined`, for example `InfoOutline` → `InfoOutlined` and `DeleteOutline` → `DeleteOutlined`. Themed variants like `InfoOutlineRounded` are not affected.
- [ ] **Theme:** `MuiTouchRipple` is removed from the component types. Target `.MuiTouchRipple-*` through `MuiButtonBase` `styleOverrides` instead.
- [ ] **jsdom/happy-dom are auto-detected** by user-agent sniffing instead of `NODE_ENV==='test'`. This can change CI test behavior.

**Deprecated APIs removed.** All of these have codemods. Pattern: `XxxComponent`/`XxxProps`/`components`/`componentsProps` become `slots`/`slotProps`, and composed CSS classes become atomic class combinations.
- [ ] **TextField:**

  | Removed | Use |
  |---|---|
  | `InputProps` | `slotProps.input` |
  | `inputProps` | `slotProps.htmlInput` |
  | `SelectProps` | `slotProps.select` |
  | `InputLabelProps` | `slotProps.inputLabel` |
  | `FormHelperTextProps` | `slotProps.formHelperText` |

  - Autocomplete `renderInput` params follow the same change: `params.slotProps.htmlInput`.
- [ ] **Dialog, Drawer, Popover, Modal, SwipeableDrawer, Snackbar, Tooltip, Accordion, StepContent, SpeedDial:** `TransitionComponent`, `TransitionProps`, `PaperProps`, `BackdropComponent`, `BackdropProps`, `SlideProps`, `ContentProps`, `PopperComponent`/`PopperProps` and `components`/`componentsProps` all become `slots.*` / `slotProps.*`.
- [ ] **Menu:** `MenuListProps` → `slotProps.list`, `PaperProps` → `slotProps.paper`, `TransitionProps` → `slotProps.transition`. This also applies inside `Select`'s `MenuProps`.
- [ ] **Autocomplete:** `ChipProps`, `componentsProps`, `ListboxComponent`, `ListboxProps`, `PaperComponent` and `PopperComponent` move to slots and slotProps. `renderTags` → `renderValue`. The `useAutocomplete` fields `getTagProps` → `getItemProps` and `focusedTag` → `focusedItem`.
- [ ] **Checkbox, Radio, Switch:** `inputProps` and `inputRef` → `slotProps.input` (the ref goes in `slotProps.input.ref`).
- [ ] **ListItemText:** `primaryTypographyProps` / `secondaryTypographyProps` → `slotProps.primary` / `slotProps.secondary`.
- [ ] **ListItem:** `components`, `componentsProps`, `ContainerComponent` and `ContainerProps` removed.
- [ ] **CardHeader:** `titleTypographyProps` / `subheaderTypographyProps` → `slotProps.title` / `slotProps.subheader`.
- [ ] **Avatar:** `imgProps` → `slotProps.img`.
- [ ] **AvatarGroup:** `additionalAvatar` → `surplus`.
- [ ] **Divider:** `light` → `sx={{ opacity: 0.6 }}`.
- [ ] **Typography:** `paragraph` → `sx={{ mb: 2 }}`.
- [ ] **TablePagination:** `backIconButtonProps` / `nextIconButtonProps` / `SelectProps` → `slotProps.actions.*` / `slotProps.select`.
- [ ] **Tabs:** `TabIndicatorProps`, `ScrollButtonComponent` and `TabScrollButtonProps` → slots. `slots.StartScrollButtonIcon` → `startScrollButtonIcon`.
- [ ] **Rating:** `IconContainerComponent` removed.
- [ ] **MobileStepper:** `LinearProgressProps` removed.
- [ ] **StepLabel:** `StepIconComponent` / `StepIconProps` removed.
- [ ] **Input, FilledInput, OutlinedInput, InputBase, Slider, Badge, Popper, PaginationItem, FormControlLabel:** `components` / `componentsProps` removed.
- [ ] **Composed CSS classes removed:**
  - Button, ButtonGroup, Chip, Alert, CircularProgress, LinearProgress, Dialog, Drawer, InputBase, Select, Slider, StepConnector, Tab/Tabs, TableSortLabel, ToggleButtonGroup, ImageListItemBar, AccordionSummary, Divider and PaginationItem are affected.
  - Examples: `.MuiButton-containedPrimary` → `.MuiButton-contained.MuiButton-colorPrimary`, and `Tabs flexContainer` → `list`.
  - Theme `styleOverrides` keys such as `containedPrimary` must become `root.variants` entries.
- [ ] **System props removed** from Box, Stack, Typography, Link, Grid, DialogContentText, TimelineContent and TimelineOppositeContent. Change `<Box mt={2}>` to `<Box sx={{ mt: 2 }}>`.

**v9 codemods**
```bash
npx @mui/codemod@latest deprecations/all <src>        # runs every deprecations/* transform (slots/slotProps, classes)
npx @mui/codemod@latest v9.0.0/system-props <src>     # superset of v6 system-props (Typography color="inherit", Link, DialogContentText, Timeline*)
npx @mui/codemod@latest v9.0.0/system-props <src> -- --jsx=Box,Typography,Stack,Link,Grid,DialogContentText   # if you use auto-imports
# individual: deprecations/text-field-props, deprecations/dialog-props, deprecations/menu-props, deprecations/autocomplete-props, ...
# common flags: --packageName="@org/ui" (for re-export wrappers), --dry, --parser=tsx (default)
```
No codemod covers these v9 items, so handle them by hand:
- `disableEscapeKeyDown`
- `Grid direction="column"`
- `*Outline` icon imports (a regex rename works)
- `nativeButton`
- Menu, Tab and MenuItem placement
- Slider `onMouseDown`
- `MuiTouchRipple` in the theme

### 2.4 Can the MUI codemods run back-to-back?
All transforms ship in one package (`@mui/codemod@latest`) and only rewrite source, so technically you can run them in sequence in one sitting. The official guides describe **one major at a time**, with a commit and verification after each step. They do not describe a combined 5→9 run. Practical rules drawn from the guides and codemod source:
1. **Order:** v6 transforms → v7 transforms → `deprecations/all` → `v9.0.0/system-props`. Then do the manual v9 items.
2. **Grid:**
   - `v7.0.0/grid-props` rewrites usage of `@mui/material/Grid` to the *new* Grid API. Run it only with v7+ packages installed, because in v5 and v6 that import is still the legacy Grid.
   - `v6.0.0/grid-v2-props` needs the `Grid2` import rename done first.
3. **`deprecations/all`:** run it after you are on v7 (or at least v6.x latest). Its target APIs (`slotProps.htmlInput`, `slots.transition`, …) don't all exist in v5, so running it earlier would break a v5 build.
4. **System props:** skip `v6.0.0/system-props` and run `v9.0.0/system-props` once.
5. **Presets:** undocumented `v6.0.0/all` and `v7.0.0/all` presets exist in the source. `v6/all` only runs list-item-button-prop. Run the individual transforms listed above instead. `v5.0.0/preset-safe` is for v4→v5 and does not apply here.
6. Run `tsc --noEmit` after every step. Codemods don't cover type imports, `styled(Grid)` or wrapped components.

### 2.5 Other MUI-adjacent packages
- **MUI X:** v9 is required with MUI 9. v8 only goes up to material ^7. X has its own migration guides for v6→v7→v8→v9, which were **not reviewed here**.
- **Emotion:** no new requirement beyond `^11.5.0`, but use ≥ 11.12 for React 19 (see 1.6). MUI 9 still uses Emotion by default. Pigment CSS is opt-in (`@mui/material-pigment-css`).

---

## 3. Companion libraries

### 3.1 React Router
Sources:
- https://reactrouter.com/upgrading/v6 (raw: github.com/remix-run/react-router/blob/react-router@7.18.4/docs/upgrading/v6.md)
- https://reactrouter.com/upgrading/v7 (…/main/docs/upgrading/v7.md)
- package.json files at tags `react-router@6.30.6`, `@7.18.4` and main (8.4.0)

| Line | Peer React | Node engine | Status |
|---|---|---|---|
| v6 (react-router-dom 6.30.6) | `>=16.8` (allows 19) | >=14 | Still gets patches (6.30.6 released 2026-08-18) |
| v7 (7.18.4) | `>=18` | >=20 | Still gets patches |
| v8 (8.4.0) | **`>=19.2.7`** | **>=22.22.0** | Latest |

- **Is v7 needed?** Not for React 19. v6 declares `react >=16.8`, so it is a strictly-optional follow-up. The upgrade is low risk:
  - v7 has "no breaking changes if you have enabled all future flags" on the latest 6.x: `v7_relativeSplatPath`, `v7_startTransition`, `v7_fetcherPersist`, `v7_normalizeFormMethod`, `v7_partialHydration`, `v7_skipActionErrorRevalidation`.
  - With `v7_startTransition`, move any `React.lazy` defined *inside* components to module scope.
  - `json()` and `defer()` are deprecated. Return raw objects instead.
- **Package rename:** in v7, import from **`react-router`** and install only that.
  - DOM-only APIs (`RouterProvider`, `HydratedRouter`) come from **`react-router/dom`**.
  - `react-router-dom` still exists in v7 as a re-export.
  - **v8 removes `react-router-dom` completely.**
- **v8 (optional):**
  - Requires React ≥ 19.2.7 and Node ≥ 22.22.
  - Adopt the `future.v8_*` flags on 7.x first.
  - `data` becomes `loaderData` on `useMatches()` and `meta`.
  - Framework mode needs Vite 7+.

### 3.2 Redux Toolkit / React-Redux
Sources:
- https://redux.js.org/usage/migrations/migrating-rtk-2 (raw: github.com/reduxjs/redux/blob/master/docs/usage/migrations/migrating-rtk-2.md)
- package.json in reduxjs/redux-toolkit and reduxjs/react-redux

- **Peer ranges:**
  - RTK 1.9.7 peers `react ^16.9 || ^17 || ^18` and `react-redux ^7.2.1 || ^8.0.2`.
  - react-redux 8.1.3 peers `react … ^18.0`.
  - React 19 is outside **both** ranges, so npm reports peer-dependency (ERESOLVE) errors.
  - **react-redux 9.2.0+** is the first release with `react ^18.0 || ^19` and `@types/react ^18.2.25 || ^19`. 9.0 and 9.1 are React 18 only.
  - RTK 2.x (2.13.0) peers `react ^16.9 … || ^19` and `react-redux ^7.2.1 || ^8.1.3 || ^9.0.0`.
- **Required for React 19: RTK 2.x plus react-redux ≥ 9.2** (9.3.0 is the latest). RTK 2.0 also moves to Redux 5, Reselect 5 and redux-thunk 3.
- **RTK 2 changes most likely to need code edits:**
  - [ ] **Object syntax removed from `createSlice.extraReducers` and `createReducer`.** Use the builder callback. Codemods:
    ```bash
    npx @reduxjs/rtk-codemods createSliceBuilder ./src
    npx @reduxjs/rtk-codemods createReducerBuilder ./src
    ```
  - [ ] **`configureStore({ middleware })` and `enhancers` must be callbacks**, for example `middleware: gDM => gDM().concat(x)`. Use `Tuple` for custom arrays in TS.
  - [ ] **Standalone `getDefaultMiddleware` and `getType` removed.**
  - [ ] **Middleware `action` and `next` are typed `unknown`.** `AnyAction` is deprecated in favor of `UnknownAction`. The `PreloadedState` type is removed.
  - [ ] **`action.type` must be a string.**
  - [ ] **RTK Query:** tag invalidation now defaults to `invalidationBehavior: 'delayed'`.
  - [ ] **Packaging:** there is an `exports` field, builds target ES2020 untranspiled, and UMD is dropped. The lowest TS tested for RTK 2.0 is 4.7.
  - [ ] react-redux 9 requires React 18+. Custom context is typed `ReactReduxContextValue | null`.
  - [ ] Reselect: `createSelector` defaults to `weakMapMemoize`, and `defaultMemoize` is renamed `lruMemoize`. It adds dev-mode checks for input stability and identity functions.

### 3.3 Vite 8 and @vitejs/plugin-react 6
Sources:
- https://vite.dev/guide/migration (raw: github.com/vitejs/vite/blob/main/docs/guide/migration.md)
- v7/v6/v5 guides at tags `v7.0.0`, `v6.0.0` and `v5.0.0` (docs/guide/migration.md)
- https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/CHANGELOG.md

- **Node:** Vite 8.3.1 and plugin-react 6.1.1 both declare `^20.19.0 || >=22.12.0`. Vite 7 dropped Node 18.
  - If you also want React Router v8 tooling, use Node ≥ 22.22.
- **Vite 8** (Rolldown and Oxc replace esbuild and Rollup):
  - Default `build.target` is now Chrome/Edge 111, Firefox 114 and Safari 16.4.
  - `optimizeDeps.esbuildOptions` and the `esbuild` option are deprecated. They are auto-converted to `rolldownOptions`/`oxc` for now.
  - esbuild becomes an optional dependency. Install it yourself if you use `build.minify: 'esbuild'`, `cssMinify: 'esbuild'` or `transformWithEsbuild`.
  - JS is minified by Oxc and CSS by Lightning CSS.
  - **CJS default-import interop changed.** A temporary escape hatch exists: `legacy.inconsistentCjsInterop: true`.
  - Format-sniffing resolution between `browser` and `module` fields is removed.
  - **The object form of `build.rollupOptions.output.manualChunks` is removed** and the function form is deprecated. Use Rolldown `codeSplitting`.
  - `build.rollupOptions` → `build.rolldownOptions`, and `build.commonjsOptions` is now a no-op.
  - `system`/`amd` output formats are unsupported, and plugin-legacy can't target ES5.
- **Vite 7** (from 6):
  - Default target was 'baseline-widely-available' (Chrome 107). The old `'modules'` target name is gone.
  - Sass legacy API removed.
  - `splitVendorChunkPlugin` removed.
  - `transformIndexHtml` `enforce`/`transform` → `order`/`handler`.
- **Vite 6** (from 5):
  - Custom `resolve.conditions` must now include the defaults (`defaultClientConditions`).
  - `json.stringify` defaults to `'auto'`.
  - postcss-load-config v6 (TS configs need tsx or jiti).
  - Sass uses the modern API by default.
- **Vite 5** (from 4):
  - Node 18+ required.
  - Rollup 4.
  - The CJS Node API is deprecated (`vite.config` should be ESM or `.mjs`).
  - Manifest moved to `.vite/`.
  - `import.meta.globEager` and CSS default exports removed.
  - `experimentalDecorators` and `useDefineForClassFields` behavior changed.
- **@vitejs/plugin-react 6.0.0:**
  - **Drops Vite ≤7.**
  - **Babel removed.** The `react({ babel: {...} })` options are gone. Use `@rolldown/plugin-babel` next to it. For React Compiler, use `babel({ presets: [reactCompilerPreset()] })`.
  - 6.1 adds experimental native compiler support: `react({ compiler: true })` with `oxc-transform-react`.
  - From 5.0: `react` and `react-dom` are no longer auto-added to `resolve.dedupe`. Watch for duplicate-React errors, and add them manually if needed.

### 3.4 TypeScript
Sources:
- https://mui.com/material-ui/getting-started/supported-platforms/
- DefinitelyTyped README ("Support Window")
- https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html

- **Minimums:**
  - MUI 7/9: **TS 4.9**. MUI 6: 4.7.
  - RTK 2.0: lowest tested is 4.7.
  - @types/react 19: DefinitelyTyped only tests TS versions **less than 2 years old**. It ships a `ts5.0` typesVersions fallback for TS ≤ 5.0.
  - Minimums for React Router and Vite types are not documented in the sources reviewed.
- **Recommendation for baseline (a):** go from TS 4.9 to **5.9.x** during the React/MUI upgrade. TS 4.9 meets MUI's floor but is outside DefinitelyTyped's tested window.
- **Treat TS 6.0 and 7.0 as a separate step.** TS 6.0 changes defaults and deprecates options:
  - `types` now defaults to `[]`. You typically need to add `"types": ["node", "vitest/globals", …]`.
  - `strict` defaults to `true`, `module` to `esnext`, the `target` to es2025, and `rootDir` to `.`.
  - Deprecated: `moduleResolution: node`/`node10`, `baseUrl`, `target: es5`, and `esModuleInterop: false`.
  - TS 7 removes the options deprecated in 6.0.

---

## 4. Browser support minimums

Sources:
- https://mui.com/material-ui/migration/upgrade-to-v9/ (supported browsers)
- https://mui.com/material-ui/getting-started/supported-platforms/
- https://github.com/mui/material-ui/blob/master/.browserslistrc
- https://vite.dev/guide/migration
- https://react.dev/blog/2022/03/08/react-18-upgrade-guide

| | Chrome | Edge | Firefox | Safari macOS/iOS | Notes |
|---|---|---|---|---|---|
| MUI 6 and 7 | 109 | 121 | 115 | 15.4 | IE 11 dropped in v6 |
| **MUI 9** | **117** | **121** | **121** | **17.0** | `.browserslistrc` `[stable]` also lists `and_chr` (Chrome Android) **117–146**. It has no separate `android` (WebView) entry. |
| React 19 | no published matrix | | | | React 18 dropped IE. It needs `Promise`, `Symbol`, `Object.assign` and microtasks. The React 19 docs reviewed state no browser minimums. |
| Vite 8 default `build.target` | 111 | 111 | 114 | 16.4 | Lower `build.target` only if you must ship to older engines |

- **Electron on Chromium 128+:** at or above every minimum (MUI 9 needs Chrome 117). OK.
- **Android WebView:** MUI's list covers Chrome for Android 117+ and has no explicit WebView entry.
  - **inference:** WebView is Chromium-versioned, so treat **WebView ≥ 117** as the effective MUI 9 floor.
  - Devices with an older or pinned WebView are outside MUI 9's supported range. They would also fall below Vite 8's default target (111) if under 111.
  - Check the WebView versions your devices actually report. Consider gating on `navigator.userAgent` (`Chrome/NNN`).
- **React 19.3 `<ViewTransition>`** relies on the browser View Transitions API. The docs reviewed don't state fallback behavior (**UNVERIFIED**). Treat it as progressive enhancement.

---

## 5. Recommended upgrade order and verification

### 5.1 Baseline (a): React 18.2, MUI 5.11, RTK 1.9, RRD 6, Vite 4/5, TS 4.9
Commit, and ideally ship, after each numbered step.
1. **Toolchain:** Node 22 LTS (≥ 22.12 for Vite 8; ≥ 22.22 if RR v8 is planned). TypeScript → 5.9.x.
2. **Vite 4/5 → 8 and @vitejs/plugin-react → 6.**
   - This step is independent of React.
   - Walk through the v5/v6/v7/v8 notes in 3.3.
   - Move any `react({ babel })` config to `@rolldown/plugin-babel`.
   - Check the `manualChunks` object form and CJS default imports.
3. **React 18.2 → 18.3.1.**
   - Fix the deprecation warnings.
   - Run `npx codemod@latest react/19/migration-recipe`. Its output also works on 18.3: `createRoot`, callback refs, and `act` from `react`.
4. **Redux:** RTK 1.9 → 2.x and react-redux 8 → 9.3, still on React 18. Run the rtk-codemods and fix the `middleware` callback.
5. **React Router:** go to 6.30.x and enable all `v7_*` future flags. Optionally move to v7 and `react-router` imports now, or later.
6. **MUI 5.11 → 5.18.x**, the last v5. It declares a React 19 peer.
   - Migrate off `@mui/styles`/JSS if present.
   - Move MUI X to a version compatible with v5, 6 and 7.
7. **React 18.3 → 19.3.0.**
   - Install @types 19 and run `types-react-codemod preset-19`.
   - Emotion → 11.14.
   - @testing-library/react → ≥ 16.1.
   - eslint-plugin-react-hooks → v6 (flat config, or `recommended-legacy`).
8. **MUI 5.18 → 6 → 7 → 9.**
   - Keep icons, system and lab in lockstep. Move MUI X to v9 together with MUI 9.
   - Codemods in the order from 2.4. Then do the manual v9 items.
   - Visual QA of Grid, Accordion, Stepper, Menu and Tabs.
   - Because React is already 19, no `react-is` override is needed.
9. **Optional:** React Router v7 → v8 (needs React ≥ 19.2.7 and Node ≥ 22.22, and removes `react-router-dom`). TypeScript 6.0 (tsconfig `types`/`strict`/`baseUrl` changes).

### 5.2 Baseline (b): React 19, MUI 7, Vite 6/7, TS 5
1. **React 19.x → 19.3.0.** This is a minor upgrade. Watch the `useId` format (`_r_`), StrictMode double effects on hydration and Fast Refresh, eslint-plugin-react-hooks v6, and number-input `defaultValue`.
2. **MUI 7.x → 7.3.x latest.** On v7, run `deprecations/all` and `v9.0.0/system-props`. Change `GridLegacy` imports to `@mui/material/Grid`, then run `v7.0.0/grid-props`. Verify on v7.
3. **MUI → 9.4.0** (icons 9.4.0, lab v9 beta, MUI X ≥ 9.0). Then do the manual v9 items in 2.3.
4. **Vite 6/7 → 8 and plugin-react 6** (Node 20.19+/22.12+).
5. **Companion libraries:** react-redux ≥ 9.2 if not already; React Router per 3.1.

### 5.3 Verification checklist
**Install and types**
- [ ] `npm install` passes **without** `--legacy-peer-deps`.
- [ ] `npm ls react react-dom @types/react react-is` shows a single copy of each (plugin-react 5+ no longer dedupes React).
- [ ] `tsc --noEmit` is clean.
- [ ] ESLint is clean, including react-hooks v6.

**Grep for leftover APIs.** Each item should return zero hits.
- React removals:
  - `ReactDOM.render`, `hydrate(`, `unmountComponentAtNode`, `findDOMNode`
  - `react-dom/test-utils`, `react-test-renderer/shallow`
  - `.defaultProps =` on function components, `contextTypes`, `getChildContext`
  - String refs (`ref="`), `createFactory`
  - Bare `useRef()`, and global `JSX.` augmentations
- MUI imports and components:
  - Deep imports: `@mui/material/[^'"]+/[^'"]+`
  - Grid: `Unstable_Grid2`, `Grid2`, `GridLegacy`, `<Grid item`, `direction="column"`
  - `<ListItem button`, `@mui/lab` imports of the moved components, `@mui/styles`, `createMuiTheme`, `experimentalStyled`, `<Hidden`
  - Icons: `from '@mui/icons-material/.*Outline'` (no d)
  - Theme: `MuiTouchRipple`, `MuiGridLegacy`, and composed class keys in `styleOverrides`
- MUI props:
  - Transitions and backdrops: `TransitionComponent`, `TransitionProps`, `PaperProps`, `BackdropProps`, `components=`, `componentsProps`, `onBackdropClick`, `disableEscapeKeyDown`
  - TextField and Menu: `InputProps`, `inputProps`, `InputLabelProps`, `SelectProps`, `FormHelperTextProps`, `MenuListProps`
  - ListItemText, Autocomplete, Divider, Typography: `primaryTypographyProps`, `renderTags`, `<Divider light`, `paragraph`
  - System props on Box, Stack, Typography and Link: `mt=`, `p=`, `bgcolor=`, `display=`, …
- Redux: `extraReducers: {`, `middleware: [`, `getDefaultMiddleware` imports.
- React Router: `from "react-router-dom"` if moving to v7 or v8.

**Runtime (dev build, console open)**
- [ ] No React warnings:
  - "outdated JSX transform"
  - "Accessing element.ref"
  - conditional `use()`
- [ ] No MUI `nativeButton` mismatch warnings.
- [ ] No errors from `Tab` or `MenuItem` rendered outside `Tabs`/`Menu`.
- [ ] Error boundaries and error reporting still fire (`onUncaughtError`/`onCaughtError`).

**Visual and a11y regression**
- [ ] Grid spacing and width (gap vs negative margins; set `width:100%` on containers).
- [ ] `ListItemIcon` at 36px.
- [ ] Accordion summary: `h3` and `button` DOM.
- [ ] Vertical Divider (`div`).
- [ ] Stepper `ol`/`li`.
- [ ] TablePagination number formatting.
- [ ] Select TextField label.
- [ ] Dialog Esc handling.
- [ ] Keyboard navigation in Menu, Tabs and Stepper.

**Tests**
- [ ] @testing-library/react ≥ 16.1.
- [ ] `act` imported from `react`.
- [ ] Tests do not run with NODE_ENV=production (`React.act` is dev-only since 19.1).
- [ ] Update snapshots for the `useId` format change and for icon `data-testid` removal in production.
- [ ] Recheck jsdom-dependent MUI tests (MUI 9 environment detection).
- [ ] Recheck ripple interactions that need `await act(...)`.

**Build and targets**
- [ ] `vite build` passes.
- [ ] No CJS default-import runtime errors.
- [ ] `build.target` is appropriate for the oldest Android WebView you ship to.
- [ ] Smoke test on Electron (Chromium 128+) and on the lowest-version Android WebView device.
