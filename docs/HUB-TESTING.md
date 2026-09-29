# Testing a + app inside Qortal Hub (Dev Mode)

Cloud sessions can only build and unit-test. Real Qortal behaviour needs Hub: `qortalRequest`, name lookups, QDN downloads, encryption and themes from `?theme=`. The check happens on Simon's desktop, where a Qortal Core node and Hub already run. A local Claude session can drive Hub when **Computer use** is on.

## One-time setup (Simon)

1. **Local node:** Hub must be connected to the local node (`localhost:12391`). Dev Mode refuses to run on a public node.
2. **Log in:** log in to Hub with the **Tester GO** account yourself. Claude never types account passwords.
3. **Dev Mode:** Hub → Settings → turn on **Dev Mode**. A Dev Mode icon appears in the left sidebar.
4. **Computer use:** in the Claude desktop app, turn on Settings → Desktop app → **Computer use**, then start a new local session in this repo. That lets Claude see and click Hub.

## Running an app in Hub

```bash
cd "apps/Q-Mail+"
npm ci
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Then in Hub: Dev Mode icon → **Add server** → domain `127.0.0.1`, port `5173`. The app opens in a Hub tab with the real `qortalRequest`, the logged-in account and Hub's light/dark theme. Refresh in the tab picks up code changes. Vite hot-reloads most of them.

To test the exact zip that will be published, use Dev Mode's **preview zip** option with `release/<App+>.zip` from `scripts/build-zip.sh`. It previews under the logged-in account's name without publishing.

## What to check

- **Themes and layout:** all four themes and a Hub light/dark switch; the window at desktop size and at narrow/phone width.
- **Reading:** the app's main screens load real data: mail, videos, names, trades, boards. Compare with the original app in a second tab (`qortal://APP/Q-Mail`) to confirm it's the same data (ground rule 1).
- **Network use:** the Hub console (View → Toggle Developer Tools) shows no errors and no request storms. Count the searches on first load.
- **Actions that write:** publishing, sending mail, voting, buying or selling names, trading, and sending coins all cost QORT or change real data. **Claude asks Simon before any of these,** even on the Tester account, and Hub shows its own confirmation too. Use the Tester account and small amounts only.

Record what you tested, and the result, in the app's brief under **Done** or **Follow-ups**.

## GO (Android)

GO renders apps in Android System WebView (Chromium). For a GO check, publish or preview the zip and open it in GO on a phone. That step is Simon's.
