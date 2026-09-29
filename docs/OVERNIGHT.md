# Running the redesign overnight in the cloud

This is how to hand the apps to Fable in Claude Code on the web (claude.ai/code), so the work runs on cloud credits while you sleep. Every app pass starts with the **React 19.3 + MUI 9.4 upgrade** (docs/PLATFORM.md), then the redesign. **Q-Mintership+** gets a phased React rewrite instead.

## One-time setup (Simon)

1. **The repo is on GitHub** at [SJQortal/Q-Apps-Plus](https://github.com/SJQortal/Q-Apps-Plus). Done.
2. **GitHub is connected to Claude Code on the web.** Done: `Q-Apps-Plus` shows in the repo picker at [claude.ai/code](https://claude.ai/code).
3. **Cloud environment: "Qortal Programmer".** Done. Network access is *Full* (Trusted would also do), with no environment variables and no setup script. Each session installs the apps it works on.
4. **Model:** pick **Fable** when you start each session, or type `/model fable` as the first message.
5. **GitHub rules.** Done: `main` only accepts pull requests, PRs merge as merge commits (squash/rebase off), and branches delete themselves after merging.
6. **For Hub testing (local only):** Claude restarts Hub with its debug port, and you log in to the Tester GO account yourself with Dev Mode on (docs/HUB-TESTING.md). Computer use isn't needed, and the Linux app doesn't have it.

Cloud sessions load this repo's `CLAUDE.md`, the `qplus-app` skill and `.claude/settings.json`. They keep working after you close the browser. A session only stops early if it waits on a question, which is why the prompts below tell it not to ask.

## Recommended plan: pilot, then fan out

### Evening: pilot Names+ (about an hour, while you're around)

> Use the qplus-app skill to do a full pass on **Names+** on a new branch `names-plus/pass-1`: platform upgrade to React 19.3 + MUI 9.4 first, then the redesign. Work only in `apps/Names+/`, `docs/apps/Names+.md`, and `shared/` if the kit or docs need a fix. Don't stop to ask questions. Make sensible calls and list open questions in the brief's Follow-ups. When done, push and open a PR titled "Names+: React 19.3 / MUI 9.4 + redesign pass 1".

Then test it in Hub (a **local** session, following docs/HUB-TESTING.md), fix anything that turns up, and merge. Any kit or doc fixes land on `main` before the fan-out.

### Night: one cloud session per app, all in parallel

For **Q-Node+, Q-Tube+, Q-Trade+, Q-Mail+, Q-Share+, Q-Support+, Q-Fund+ and Q-Shop+** (8 sessions), change the app name and the branch name each time (branch = lower-case app name with `-plus`, e.g. `q-tube-plus/pass-1`):

> Use the qplus-app skill to do a full pass on **Q-Mail+** on a new branch `q-mail-plus/pass-1`: platform upgrade to React 19.3 + MUI 9.4 first (its own commit), then the redesign. Work only in `apps/Q-Mail+/` and `docs/apps/Q-Mail+.md`. Do not edit `shared/`, `docs/PROGRESS.md` or other apps. If the theme kit needs a change, work around it inside the app's own theme config and describe the needed kit change in Follow-ups. Don't stop to ask questions. Make sensible calls and list open questions in Follow-ups. When done, push and open a PR titled "Q-Mail+: React 19.3 / MUI 9.4 + redesign pass 1".

For **Q-Mintership+** (1 session):

> Use the qplus-app skill for **Q-Mintership+** on a new branch `q-mintership-plus/rewrite-phase-1`. Follow the Rewrite plan in `docs/apps/Q-Mintership+.md`: do phase 1 (scaffold, data layer, data contract, parity checklist) and, if time allows, phase 2 (read-only boards). Work only in `apps/Q-Mintership+/` and `docs/apps/Q-Mintership+.md`. Don't stop to ask questions; list open questions in Follow-ups. Open one PR per phase, titled "Q-Mintership+: React rewrite phase N".

Each session works in its own folder on its own branch, so the PRs don't conflict. All nine share your account's usage limits; if one pauses for the limit, reopen it later and say "continue".

### Later: Q-Apps+ (the launcher)

Start this after the others are merged, since it presents them:

> Use the qplus-app skill to build **Q-Apps+** from scratch on a new branch `q-apps-plus/first-version`, as described in `docs/apps/Q-Apps+.md`, on React 19.3 + MUI 9.4 with the Hub 3.0 kit. Read every other app's brief for names, taglines and what's new. Don't stop to ask questions. Push and open a PR titled "Q-Apps+: first version".

### Following nights: Q-Mintership+ phases 3–5

Continue with one session per phase (write flows → admin side → redesign), each starting from the merged previous phase.

## In the morning

Type in the local Claude session, for example: **"build the zips"**. Claude then:

1. Runs `scripts/build-pr-zips.sh`. It checks each open app PR out in `.worktrees/`, builds it, and writes `release/<App+>.zip` plus `release/SUMMARY.md` (PR, branch, commit, build result, zip size).
2. Tests the apps in Hub Dev Mode through the debug port (docs/HUB-TESTING.md): the four themes, phone width and the main read-only flows. Anything that publishes or spends QORT, Claude asks you first.
3. Reports what each PR changed, including the open questions from each brief's **Follow-ups**.

Then you:

4. **Publish** `release/<App+>.zip` from Hub as `APP` under the matching name. Don't publish Q-Mintership+ until its parity checklist is complete.
5. **Merge** the PRs you published with the **Merge** button. It makes a merge commit, and the branch deletes itself.

## If something goes wrong

- **A session stopped early:** open it again from claude.ai/code and say "continue". Its progress is in the app brief and the git log.
- **Two PRs both changed the same shared file:** merge one, then ask the other session to `git merge main` and resolve the conflict.
- **Upstream Qortal repos moved on:** run `scripts/sync-upstream.sh --check` to see what's new, then `scripts/sync-upstream.sh <App+>` to merge it.
