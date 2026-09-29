# Testing a + app inside Qortal Hub (Dev Mode)

Cloud sessions can only build and unit-test. Real Qortal behaviour needs Hub: `qortalRequest`, name lookups, QDN downloads, encryption and themes from `?theme=`. The check happens on Simon's desktop, where a Qortal Core node and Hub already run. A local Claude session drives Hub through its debug port.

**First run (2026-09-29):** Names+ upgraded to React 19.3 + MUI 9.4 ran in Hub (GO 3.0 build, Electron 32 / Chromium 128) on the Tester GO account. My Names showed the account's name and avatar, Names for sale listed the live marketplace, and the console stayed clean.

## How Claude drives Hub: debug port (Linux has no Computer use)

The Linux desktop app has no Computer use switch (checked 2026-09-29), so a local session controls Hub over the **Chrome DevTools Protocol** instead. That's the same mechanism as Chrome's developer tools.

1. **Local node:** Hub must be connected to the local node (`localhost:12391`). Dev Mode refuses to run on a public node.
2. **Quit Hub** (tray icon → Quit). Claude then starts it in the Terminal panel with the debug port:
   ```bash
   /home/simon-james/qortal-hub/Qortal-Hub --no-sandbox --remote-debugging-port=9222
   ```
   The port listens on 127.0.0.1 only, but while it's open, programs on this machine can control Hub. Use it for test sessions only, and start Hub normally from the menu afterwards (Ctrl+C in that terminal tab stops it).
3. **Log in and turn on Dev Mode.** Simon logs in to the **Tester GO** account; Claude never types passwords. Dev Mode is in Hub → Settings, and it stays on between restarts.
4. **Drive Hub with `scripts/hub-cdp.mjs`:**
   ```bash
   node scripts/hub-cdp.mjs targets                       # Hub window + app iframes
   node scripts/hub-cdp.mjs shot "Qortal Hub" hub.png     # screenshot (DPR 2.4: CSS px = image px / 2.4)
   node scripts/hub-cdp.mjs click "Qortal Hub" 720 480    # click at CSS px
   node scripts/hub-cdp.mjs type "Qortal Hub" "5173"      # type into the focused field
   node scripts/hub-cdp.mjs eval "12393" "document.title" # run JS inside the app frame (read-only checks)
   node scripts/hub-cdp.mjs console "12393" 10            # app console for 10 s (old entries replay first)
   ```

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
