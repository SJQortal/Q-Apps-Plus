# Running the app sessions (one app per day)

How the work actually runs since 2026-09-30: **one app per day, in a local Claude chat on Simon's desktop**, to the Q-Share+ standard. The rounds and the "done" checklist are in the `qplus-app` skill. This page covers the setup around them: folders, chats, Hub and the morning.

## Why local, one app at a time

- **Hub only works locally.** Only a local chat can test in Hub, and round 4 (the Hub check) found most of Q-Share+'s serious bugs.
- **Cost is the same.** Cloud sessions now bill the same plan usage as local ones; the $250 cloud credit was used up on the first night.
- **Parallel apps burn usage.** Eleven parallel sessions used it up in about an hour. One app with full attention got Q-Share+ to 1.0.0 in a day.
- **Cloud is still fine for rounds 1–3** of an app, when the desktop is busy. Use the same day prompt and leave round 4 for a local chat.

## Setup for an app

1. **A folder of its own** (a git worktree), so chats on different apps never share a checkout. From the main checkout:
   ```bash
   git worktree add "../Q-Apps+-QMail" q-mail-plus/pass-1
   ```
   The name is `../Q-Apps+-<Short>`. Use the app's branch from docs/PROGRESS.md, or `git worktree add -b <slug>/pass-1 "../Q-Apps+-<Short>" origin/main` for a new one. The main checkout (`Q-Apps+`) stays on `main` for repo work.
2. **Open the chat in that folder:** New → folder name → *Open folder…* → `Desktop/Q-Apps+-<Short>`.
   - Pick no branch and leave the worktree option off. The folder already is the worktree.
   - Choosing `Q-Apps+` together with the app's branch fails with "Commit or stash changes…", because git refuses a branch that's open in another folder.
3. **Model and mode:** Fable (or Opus when Fable's weekly limit is used up), permission mode **auto**. Turn on **Ultracode** only when the prompt allows workflows.
4. **Overnight:** keep the computer awake. If a chat stops at the 5-hour limit, open it after the reset and type "continue". Nothing is lost, because chats push after every commit.
5. **Hub:** each chat starts its own test Hub (docs/HUB-TESTING.md). The first chat uses debug port 9222 and dev server 5173; a second chat at the same time uses 9223 and 5174. A test Hub opens signed in to the same account as the normal Hub.

## The day prompt

Fill in the `<…>` parts and delete the lines that don't apply. The skill has the details, so the prompt only says which app, which rounds and what Simon wants most.

```
Local session for <App+>, rounds <1–4> of the qplus-app skill, to the Q-Share+ standard.
[Ultracode: use workflows and parallel agents where they help, following the skill's "Working with parallel agents".]
[Simon is asleep: don't stop to ask questions. Make sensible calls and list open questions in the brief's Follow-ups.]

Work ONLY in /home/simon-james/Desktop/Q-Apps+-<Short> (a git worktree on branch <slug>/pass-1). Never touch the other Q-Apps+ folders.

Start with: git fetch origin main && git merge origin/main, then scripts/sync-theme.sh, then a green build, test and lint. main has shared fixes (theme kit, docs, scripts).

Read the qplus-app skill, especially "Done means" and the rounds. Read docs/apps/Q-Share+.md as the worked example, and docs/apps/<App+>.md for where the last session stopped.

Simon's priorities for <App+>:
- <the features, layout changes and problems Simon cares about>

Hub check (round 4): your own test Hub with --remote-debugging-port=<9222>, and the dev server on port <5173> (docs/HUB-TESTING.md, scripts/hub-cdp.mjs). Read-only: ask Simon before anything that publishes, sends or spends QORT. [Overnight: skip those, and list them in Follow-ups.]

Git: only <slug>/pass-1 is pushed, after every commit. No Claude attribution lines.
[Usage guard: check usage (get_usage) between workflows. If weekly all-models passes 60%, stop starting workflows and finish alone.]

Finish:
- Fill in Done and Follow-ups using the skill's brief template.
- Set the version to 1.0.0, or what the skill's release rules say if the app is already published.
- Run scripts/build-zip.sh <App+> from this folder.
- Put a short summary at the top of the PR description.
```

The Q-Mail+ prompt of 30 September is a filled-in example with a long feature list. It's in the conversation that started it.

## In the morning

Type **"build the zips"** in a local chat in the main checkout. Claude then:

1. Runs `scripts/build-pr-zips.sh`, which builds every open app PR in `.worktrees/` and writes `release/<App+>.zip` plus `release/SUMMARY.md`.
2. Summarises what each PR changed and the open questions from each brief's Follow-ups.
3. On request, opens an app in a test Hub for Simon to try, using Dev Mode → **Zip** for the exact zip that will be published.

## Release

1. Simon publishes `release/<App+>.zip` from Hub as `APP` under the app's name.
2. The brief gets its **Published** line, with the version and commit.
3. Simon merges the PR with the **Merge** button (a merge commit; the branch deletes itself).
4. Then update docs/PROGRESS.md, and remove the app's folder when no chat needs it:
   ```bash
   git worktree remove "../Q-Apps+-<Short>"
   ```
5. Later updates bump the version (1.0.1, …) as the skill's release rules say.

## If something goes wrong

- **A chat stopped early:** open it and type "continue". Its progress is in the brief and the git log.
- **A shared file changed on main:** in the app folder, `git fetch origin main && git merge origin/main`, then `scripts/sync-theme.sh` if the kit changed.
- **Upstream Qortal repos moved on:** run `scripts/sync-upstream.sh --check`, then `scripts/sync-upstream.sh <App+>`.
- **A test Hub was left running:** Ctrl+C in its terminal tab, or kill the process that has `--remote-debugging-port` in its command line. Simon's normal Hub has no such flag.
