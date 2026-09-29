# Platform upgrade: React 19.3 + MUI 9.4 for every + app

**Decision (2026-09-29, Simon):** every + app moves to **React 19.3** and **MUI 9.4**, including the ones on React 18 / MUI 5 today. The checks below show this works in Qortal Hub and GO, so we go ahead.

## Target stack

| Package | Target | Notes |
|---|---|---|
| `react`, `react-dom` | **19.3.0** | `@types/react` / `@types/react-dom` 19.3.x |
| `@mui/material`, `@mui/icons-material` (+ `@mui/system` if used) | **9.4.0** | MUI jumped 7 → 9; there is no 8 |
| `@emotion/react` / `@emotion/styled` | 11.14.x | unchanged |
| `qapp-core` (Q-Tube+, Q-Trade+, Names+, Q-Node+) | keep each app's version | needs the two workarounds below |
| `@reduxjs/toolkit` + `react-redux` (Q-Mail+, Q-Shop+, Q-Share+, Q-Support+, Q-Fund+) | 2.x + **9.2+** | react-redux 8 (and 9.0/9.1) do not accept React 19 |
| `react-router-dom` | stay on **6.30.x** (accepts React 19) with the `v7_*` future flags on; v7 is optional | v8 needs React ≥ 19.2.7 and removes `react-router-dom`, so it's a later step |
| `vite` + `@vitejs/plugin-react` | 8.x + 6.x | needs Node ≥ 20.19 / 22.12; if a plugin blocks v8, stay on 7 and note it in the brief |
| `typescript` | 5.9.x | TypeScript 7 (the native compiler) is a later step, once typescript-eslint supports it |
| `vitest` | 5.x (+ `jsdom`, `@testing-library/react` ≥ 16.1) | for the test harness each app gets |
| `react-quill` (Q-Mail+, Q-Share+, Q-Support+, Q-Fund+) | **replace with `react-quill-new` 3.8.x** | react-quill 2 calls `findDOMNode` and crashes on React 19. Quill 2 output must stay readable in the original apps (see MIGRATION-NOTES) |
| `@mui/x-date-pickers` (Q-Fund+) | **9.x** | MUI 9 needs MUI X 9 |

## Will it run in Hub and GO? Yes

| Host | Engine that renders the Q-App | MUI 9 needs |
|---|---|---|
| Qortal Hub, official (Electron 44) | Chromium 144 | Chrome ≥ 117 ✅ |
| GO 3.0 / Simon's Hub fork (Electron 32) | Chromium 128 | ✅ |
| GO on Android (Capacitor, minSdk 26 = Android 8) | Android System WebView, updated from the Play Store separately from the OS. Android 8/9 devices are capped at Chromium 138; newer Android gets current versions | ✅ |
| iOS | no GO build exists | (would need iOS 17+) |

Each Q-App ships its own React and MUI inside its zip and runs in its own iframe, so Hub's own React/MUI versions don't matter.

## Spike results (Names+ and Q-Tube+, upgraded in a scratch copy)

- **Install:** OK once qapp-core's peer ranges are overridden (below). A single React 19.3 and a single MUI 9.4 are deduped across the tree.
- **Typecheck:** Names+ has 0 errors. Q-Tube+ went from 6 to 37 errors; the 31 new ones are all mechanical (list below).
- **Build:** both apps build once the removed icon names are fixed. The bundle size is unchanged (Q-Tube 3.39 → 3.43 MB).
- **Runtime:** both render and navigate in Chromium, and show exactly the same console errors as the MUI 7 baseline. The errors all come from running outside Hub: no `qortalRequest`, and no node behind `vite preview`.
- **Inside Hub:** ✅ verified 2026-09-29. Names+ (React 19.3 + MUI 9.4 + qapp-core) ran in Hub Dev Mode on the local node with the Tester GO account: real names, avatar and marketplace data through `qortalRequest`, and no new console errors (docs/HUB-TESTING.md). GO on a phone is still to check.

## qapp-core and MUI 9

qapp-core (npm latest 1.0.79, source `Qortal/qapp-core` master) declares `@mui/material ^7` as a peer. Scanning its build found two things that break on MUI 9:

1. **Import of a removed icon.** `src/components/ResourceList/ResourceLoader.tsx` imports `@mui/icons-material/ErrorOutline`, which MUI 9 removed. This fails the build.
2. **A removed prop.** `src/components/VideoPlayer/PeerDetailsModal.tsx` passes `PaperProps` to a Dialog. MUI 9 ignores it, so that one dialog loses its paper styling. This is cosmetic; check it in Hub.

Everything else it imports from MUI 9 still exists (16 components checked). The `InputProps` hits in the scan are react-dropzone's `getInputProps`, not MUI.

Q-Tube+ vendors **qapp-core 1.0.80**, which isn't published and isn't on any qapp-core branch. It has video-player changes (`VideoSettings`) that aren't in master. **Don't replace it with a master build.**

**Workaround in each qapp-core app** (both parts verified in the spike):

```jsonc
// package.json
"overrides": {
  "qapp-core": {
    "@mui/material": "$@mui/material",
    "@mui/icons-material": "$@mui/icons-material",
    "react": "$react",
    "react-dom": "$react-dom"
  }
}
```

```ts
// vite.config.ts → resolve.alias (qapp-core's removed icon)
{ find: /^@mui\/icons-material\/ErrorOutline$/, replacement: '@mui/icons-material/ErrorOutlineOutlined' }
```

The proper fix is a small upstream PR to `Qortal/qapp-core`: widen the peer ranges to `^7 || ^9`, import `ErrorOutlineOutlined`, and use `slotProps={{ paper: … }}`. Also ask the Qortal devs to publish 1.0.80. Sending a PR is Simon's call; it's outward-facing.

## MUI 9 breakages found so far, and their fixes

| Symptom | Fix |
|---|---|
| `Cannot find module '@mui/icons-material/XxxOutline'` (e.g. `ErrorOutline`, `PlayCircleOutline`, `DeleteOutline`) | MUI 9 removed the legacy `…Outline` names. Import `…OutlineOutlined` (same glyph). `scripts/check-mui-icons.sh <App+>` lists every missing icon import. |
| `Property 'position' / 'bgcolor' / 'fontWeight' … does not exist` on `Box`, `Typography`, `Stack`, `Grid` | MUI 9 removed system props. Move them into `sx={{ … }}`. |
| `inputProps` on `Radio`/`Checkbox`/`Switch`; TextField `InputProps` / `inputProps`; `PaperProps`, `MenuListProps`, `TransitionComponent` … | Checkbox/Radio/Switch → `slotProps.input`; TextField `InputProps` → `slotProps.input` and `inputProps` → `slotProps.htmlInput`; `slotProps.paper`, `slotProps.list`, `slots.transition` … The codemod `deprecations/all` does most of it. |
| Theme `styleOverrides` keys like `containedPrimary` rejected | Use a style callback on `ownerState` (as the theme kit does) or `variants`. |
| Stricter ref types (`useRef<T>(null)` vs `RefObject<T \| null>`), `JSX` namespace | React 19 type changes; fix the types, don't cast them away. |

`docs/MIGRATION-NOTES.md` has the full React 18 → 19.3 and MUI 5 → 6 → 7 → 9 checklist with codemods, the companion-library changes, and a verification checklist (§5.3). Its first section lists the problems specific to these apps (react-quill, MUI X in Q-Fund+, Grid).

## How each app upgrades

This is the **first step of every app's pass**, before the theme kit and the redesign, so the redesign is only done once, on the final stack.

1. **Record the baseline:** `npm ci && npm run build`, and `npx tsc --noEmit` if the build doesn't already typecheck. Note the error count, dist size and biggest chunk in the brief.
2. **Bump the dependencies** per the target table. qapp-core apps also get the `overrides` and the icon alias above.
3. **Run the codemods** listed in `docs/MIGRATION-NOTES.md` in its order (§2.4 for MUI, §1.2 for React). For the old Redux apps, follow the step order at the end of this file.
4. **Fix icon imports** until `scripts/check-mui-icons.sh <App+>` is clean.
5. **Fix types** until `npx tsc --noEmit` has no *new* errors versus the baseline. Fix old ones you touch.
6. **Verify:**
   - `npm run build`, plus tests and lint if present.
   - `npx vite preview` and a look in a browser: every page renders, and there are no new console errors compared with the baseline.
7. **Commit** the upgrade separately from the redesign (one or more commits starting `<App+>: upgrade …`), so it can be reviewed and reverted on its own.
8. **Test in Hub Dev Mode** when a local session with Hub is available (`docs/HUB-TESTING.md`).

**The old Redux apps must go in this order.** MUI 5.11 does not accept React 19, which only arrived in MUI 5.16.8. Commit after each step and keep the build green:
1. Toolchain: TypeScript 5.9 and Vite 8 + plugin-react 6, still on React 18.
2. React 18.2 → **18.3.1** (warns about everything 19 removes), then `npx codemod@latest react/19/migration-recipe`.
3. RTK 2 + react-redux 9.3 (`npx @reduxjs/rtk-codemods createSliceBuilder ./src`; `middleware` must be a callback).
4. React Router 6.30.x with all `v7_*` future flags on.
5. **react-quill → react-quill-new**, and check the Quill 2 output against the original app.
6. MUI 5.11 → **5.18.x**.
7. React 18.3 → **19.3**, plus `npx types-react-codemod@latest preset-19 ./src`, Emotion 11.14 and @testing-library/react ≥ 16.1.
8. MUI 5.18 → 9.4 (and MUI X → 9 in Q-Fund+). Run the codemods in the order given in MIGRATION-NOTES §2.4 using `@mui/codemod@latest` (≥ 9.3.1), then the manual v9 items and `scripts/check-mui-icons.sh`.

These can be separate commits within one "upgrade" PR. The React 19 apps (qapp-core ones) follow MIGRATION-NOTES §5.2 instead.
