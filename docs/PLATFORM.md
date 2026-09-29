# Platform upgrade: React 19.3 + MUI 9.4 for every + app

**Decision (2026-09-29, Simon):** every + app moves to **React 19.3** and **MUI 9.4**, including the ones on React 18 / MUI 5 today. The checks below show this works in Qortal Hub and GO, so we go ahead.

## Target stack

| Package | Target | Notes |
|---|---|---|
| `react`, `react-dom` | **19.3.0** | `@types/react` / `@types/react-dom` 19.3.x |
| `@mui/material`, `@mui/icons-material` (+ `@mui/system` if used) | **9.4.0** | MUI jumped 7 → 9; there is no 8 |
| `@emotion/react` / `@emotion/styled` | 11.14.x | unchanged |
| `qapp-core` (Q-Tube+, Q-Trade+, Names+, Q-Node+) | keep each app's version | needs the two workarounds below |
| `@reduxjs/toolkit` + `react-redux` (Q-Mail+, Q-Shop+, Q-Share+, Q-Support+, Q-Fund+) | 2.x + **9.x** | react-redux 8 does not accept React 19 |
| `react-router-dom` | **7.x** for apps on 6 | v8 (`react-router`) is a later, separate step |
| `vite` + `@vitejs/plugin-react` | 8.x + 6.x | needs Node ≥ 20.19 / 22.12; if a plugin blocks v8, stay on 7 and note it in the brief |
| `typescript` | 5.9.x | TypeScript 7 (the native compiler) is a later step, once typescript-eslint supports it |
| `vitest` | 5.x (+ `jsdom`, `@testing-library/react`) | for the test harness each app gets |

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
- **Still to do:** a live test inside Hub Dev Mode with a logged-in account (see `docs/HUB-TESTING.md`).

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
| `inputProps` on `Radio`/`Checkbox`/`Switch`/`TextField`, `InputProps`, `PaperProps`, `MenuListProps`, `TransitionComponent` … | Use `slotProps={{ input: … }}`, `slotProps={{ paper: … }}`, `slots={{ transition: … }}`, etc. |
| Theme `styleOverrides` keys like `containedPrimary` rejected | Use a style callback on `ownerState` (as the theme kit does) or `variants`. |
| Stricter ref types (`useRef<T>(null)` vs `RefObject<T \| null>`), `JSX` namespace | React 19 type changes; fix the types, don't cast them away. |

`docs/MIGRATION-NOTES.md` has the full React 18 → 19.3 and MUI 5 → 6 → 7 → 9 checklist, with codemods.

## How each app upgrades

This is the **first step of every app's pass**, before the theme kit and the redesign, so the redesign is only done once, on the final stack.

1. **Record the baseline:** `npm ci && npm run build`, and `npx tsc --noEmit` if the build doesn't already typecheck. Note the error count, dist size and biggest chunk in the brief.
2. **Bump the dependencies** per the target table. qapp-core apps also get the `overrides` and the icon alias above.
3. **Run the codemods** listed in `docs/MIGRATION-NOTES.md` (React 19 recipe; MUI v6 → v7 → v9 steps, back to back).
4. **Fix icon imports** until `scripts/check-mui-icons.sh <App+>` is clean.
5. **Fix types** until `npx tsc --noEmit` has no *new* errors versus the baseline. Fix old ones you touch.
6. **Verify:**
   - `npm run build`, plus tests and lint if present.
   - `npx vite preview` and a look in a browser: every page renders, and there are no new console errors compared with the baseline.
7. **Commit** as `<App+>: upgrade to React 19.3 and MUI 9.4`, alone, so it can be reviewed and reverted on its own.
8. **Test in Hub Dev Mode** when a local session with Hub is available (`docs/HUB-TESTING.md`).

For the old Redux apps, also:
- replace `ReactDOM.render` with `createRoot`;
- update RTK 2 (`createSlice` `extraReducers` must use the builder callback, the object form is gone);
- move react-router 6 → 7 (turn on the v7 future flags first, then bump).
