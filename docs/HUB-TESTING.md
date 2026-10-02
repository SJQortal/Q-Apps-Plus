# Testing a + app inside Qortal Hub (Dev Mode)

Cloud sessions can only build and unit-test. Real Qortal behaviour needs Hub: `qortalRequest`, name lookups, QDN downloads, encryption and themes from `?theme=`. The check happens on Simon's desktop, where a Qortal Core node and Hub already run. A local Claude session drives Hub through its debug port.

**First run (2026-09-29):** Names+ upgraded to React 19.3 + MUI 9.4 ran in Hub (GO 3.0 build, Electron 32 / Chromium 128) on the Tester GO account. My Names showed the account's name and avatar, Names for sale listed the live marketplace, and the console stayed clean.

## How Claude drives Hub: debug port (Linux has no Computer use)

The Linux desktop app has no Computer use switch (checked 2026-09-29), so a local session controls Hub over the **Chrome DevTools Protocol** instead. That's the same mechanism as Chrome's developer tools.

1. **Local node:** Hub must be connected to the local node (`localhost:12391`). Dev Mode refuses to run on a public node.
2. **Start a test Hub next to the normal one.** Claude starts a second Hub with a debug port in the Terminal panel; Simon's normal Hub keeps running:
   ```bash
   /home/simon-james/qortal-hub/Qortal-Hub --no-sandbox --remote-debugging-port=9222
   ```
   - **One test Hub per app chat.** The first uses debug port 9222 and dev server port 5173. A second chat working on another app at the same time uses 9223 and 5174, with `HUB_CDP_PORT=9223` set for the scripts.
   - **Security:** the port listens on 127.0.0.1 only, but while it's open, programs on this machine can control that Hub. Close the test Hub when testing is done (Ctrl+C in its terminal tab, or kill its process).
3. **Signed in, with Dev Mode on.** A test Hub opens signed in to the account the normal Hub uses (checked 2026-09-30 with Tester GO), and Dev Mode stays on between restarts.
   - If it isn't signed in, Simon logs in. Claude never types passwords.
   - Overnight sessions skip the Hub checks if the test Hub isn't signed in, and list them in Follow-ups.
4. **Drive Hub with `scripts/hub-cdp.mjs`.** "12393" matches the app frame, served through the node's dev proxy:
   ```bash
   node scripts/hub-cdp.mjs targets                         # Hub window + app iframes
   node scripts/hub-cdp.mjs shot "Qortal Hub" hub.jpg 0.5   # small JPEG of the window (PNG at full size without a scale)
   node scripts/hub-cdp.mjs eval "12393" "document.title"   # run JS inside the app frame (read-only checks)
   node scripts/hub-cdp.mjs console "12393" 10              # app console for 10 s (old entries replay first)
   node scripts/hub-cdp.mjs size 390 844 --touch            # hold the app frame at 390×844 with phone touch (runs until Ctrl+C)
   node scripts/hub-cdp.mjs tap 'button[aria-label="Menu"]' # touch tap on an element (or x,y in frame CSS px)
   node scripts/hub-cdp.mjs swipe 200,150 200,500           # touch drag, e.g. pull-to-refresh
   node scripts/hub-cdp.mjs requests 20 --reload            # log every qortalRequest for 20 s from a reload at "/"
   node scripts/hub-cdp.mjs calls                           # the frame's direct Core fetches, grouped and counted
   node scripts/hub-cdp.mjs click "Qortal Hub" 720 480      # mouse click on Hub's own UI (CSS px)
   node scripts/hub-cdp.mjs type "Qortal Hub" "5173"        # type into the focused field
   ```
   - Run `size` in the background, then check the sizes from the five-size list in docs/DESIGN.md → Mobile.
   - Hub's own buttons (Dev Mode, Server, Add) are often easier to press with `eval "Qortal Hub"` and an element's `.click()` than by coordinates.

### Lessons from the Q-Share+ session (2026-09-30)

The `size`, `tap`, `swipe`, `requests` and `calls` commands above are built on these.

- **Sizes without touching the window.** Electron has no `Browser.setWindowBounds`, but `Emulation.setDeviceMetricsOverride` on the Hub page works even while the window is minimised, and screenshots work while it is held. Hub zooms its page by 1.2 and re-applies that after resizes, so check the app frame's `innerWidth` and adjust. `mobile: true` makes the zoom flip back and forth; `mobile: false` plus touch emulation is stable.
- **Touch lives in the app frame.** The app is an out-of-process iframe with its own CDP target. `pointer: coarse` / `hover: none` must be set there with `Emulation.setEmulatedMedia`, and any other session that detaches from that target (every `eval`) resets it, so re-apply it on a timer. Touch events sent to the page target land at the wrong offset and are dropped. Send them to the frame target, in the frame's own CSS px (`hub-cdp.mjs tap` and `swipe` do this; checked 2026-10-01 with a touch listener in the frame).
- **Counting `qortalRequest`.** q-apps.js routes every request through `window.executeQortalRequestImmediate`; wrapping it from `Page.addScriptToEvaluateOnNewDocument` at `readystatechange` logs each action. `/arbitrary` fetches show in the frame's resource timings (raise the buffer with `performance.setResourceTimingBufferSize`).
- **Dev proxy quirks.** Only `/` (and `*.html`) get q-apps.js injected, so reload at `/` and navigate with the app's router; a deep path loads without `qortalRequest`. Vite's HMR socket never connects through the proxy, so after new dependencies are optimised the page can load two copies of React ("Invalid hook call"): reload again, or restart Vite with `--force`. Core's proxy on 12393 can stop after Vite restarts; re-add the server in Dev Mode (Server → 127.0.0.1:5173 → Add) and close the dead tab.
- **Hub dialogs.** Accept and Decline in Hub's request dialogs are plain `div`s with those texts. `SAVE_FILE` by `location` opens a native Save As dialog on desktop, which CDP can't reach, so test saves with small files and blobs.
- **Deep links with `+`.** Hub never decodes the app name in `qortal://APP/<name>/…`; test with a published app whose name has `+` (e.g. `POS+`).

## Running an app in Hub

**Known Core bug:** Qortal Core 6.1.9's dev proxy returns 404 for every path under `/assets/`, before the request ever reaches your server. Vite puts built files there, so a built app (`vite preview`) shows a blank tab. Two ways around it:

- **Dev server** (what most Qortal devs use; it doesn't serve from `/assets/`):
  ```bash
  cd "apps/Names+" && npm ci
  npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
  ```
- **The real production bundle,** built with a different assets folder, for testing only:
  ```bash
  npx vite build --assetsDir static && npx vite preview --host 127.0.0.1 --port 5173 --strictPort
  ```
  Don't commit `--assetsDir static`; published zips are served by Core's normal renderer, which doesn't have this bug.

Then in Hub: Dev Mode → **Server** → domain `127.0.0.1`, port `5173` → **Add**. The app opens in a Hub tab (served via `http://127.0.0.1:12393`, the node's proxy) with the real `qortalRequest`, the logged-in account and Hub's light/dark theme. If a reload shows a stale page, navigate the frame with a cache-busting query (`?theme=dark&lang=en&cb=<time>`).

To test the exact zip that will be published, use Dev Mode's **Zip** option with `release/<App+>.zip` from `scripts/build-zip.sh`. It previews under the logged-in account's name without publishing.

## What to check

- **Themes and layout:** all four themes and a Hub light/dark switch; the window at desktop size and at narrow/phone width.
- **Reading:** the app's main screens load real data: mail, videos, names, trades, boards. Compare with the original app in a second tab (`qortal://APP/Q-Mail`) to confirm it's the same data (ground rule 1).
- **Network use:** the Hub console (View → Toggle Developer Tools) shows no errors and no request storms. Count the searches on first load.
- **Actions that write:** publishing, sending mail, voting, buying or selling names, trading, and sending coins all cost QORT or change real data. **Claude asks Simon before any of these,** even on the Tester account, and Hub shows its own confirmation too. Use the Tester account and small amounts only.

Record what you tested, and the result, in the app's brief under **Done** or **Follow-ups**.

## GO (Android)

GO renders apps in Android System WebView (Chromium). For a GO check, publish or preview the zip and open it in GO on a phone. That step is Simon's.
