# Running the redesign overnight in the cloud

This is how to hand the apps to Fable in Claude Code on the web (claude.ai/code), so the work runs on cloud credits while you sleep.

## One-time setup

1. **Push this repo to GitHub.** It's already done if you're reading this on GitHub.
2. **Connect GitHub to Claude Code on the web.** At [claude.ai/code](https://claude.ai/code), connect GitHub and install the Claude GitHub App on this repo. Or, in a terminal Claude Code session, run `/web-setup`: it reuses your `gh` login.
3. **Create a cloud environment:**
   - **Network access:** leave it on *Trusted* (the default). That lets sessions reach the npm registry and GitHub, which is all they need.
   - **Environment variables:** none needed.
   - **Setup script:** leave it empty. Each session installs the apps it works on (`npm ci` takes about 10 s per app).
4. **Model:** pick **Fable** in the model menu when you start each session, or type `/model fable` as the first message.

Cloud sessions load this repo's `CLAUDE.md`, the `qplus-app` skill and `.claude/settings.json`. They keep working after you close the browser. A session only stops early if it waits on a question, which is why the prompts below tell it not to ask.

## Option A (recommended): pilot, then fan out

**Evening: run the pilot, about an hour, while you're around.** Start one session:

> Use the qplus-app skill to do a full redesign pass on **Names+**. Work only in `apps/Names+/`, `docs/apps/Names+.md`, and `shared/hub-theme/` if the kit itself needs a fix. Don't stop to ask questions. Make sensible calls and list open questions in the brief's Follow-ups. When done, push and open a PR titled "Names+: redesign pass 1".

Look at the PR (and try the zip in Hub if you like). Merge it, and any kit fixes land on `main` for everyone else.

**Night: one session per app, all in parallel.** Start a session for each remaining app with this prompt, changing the name each time:

> Use the qplus-app skill to do a full redesign pass on **Q-Mail+**. Work only in `apps/Q-Mail+/` and `docs/apps/Q-Mail+.md`. Do not edit `shared/`, `docs/PROGRESS.md` or other apps. If the theme kit needs a change, work around it inside the app's own theme config and describe the needed kit change in Follow-ups. Don't stop to ask questions. Make sensible calls and list open questions in Follow-ups. When done, push and open a PR titled "Q-Mail+: redesign pass 1".

Apps: Q-Node+, Q-Tube+, Q-Trade+, Q-Mail+, Q-Share+, Q-Support+, Q-Fund+, Q-Shop+ and Q-Mintership+. That's 9 sessions. Each works in its own folder on its own branch, so the PRs don't conflict.

**Q-Apps+ (the launcher):** start it after the others are merged, since it presents them:

> Use the qplus-app skill to build **Q-Apps+** from scratch as described in `docs/apps/Q-Apps+.md`, using the Hub 3.0 kit. Read every other app's brief for names, taglines and what's new. Don't stop to ask questions. Push and open a PR titled "Q-Apps+: first version".

## Option B: one long session

This is cheaper to watch, but slower. Later apps benefit from lessons learned on earlier ones, but one session's context carries every app.

> Work through `docs/PROGRESS.md` in order. For each app, use the qplus-app skill for a full redesign pass. Commit as you go (commit messages prefixed with the app name) and update `docs/PROGRESS.md` after each app. Push after each app. Don't stop to ask questions; list open questions in each brief's Follow-ups. Open one PR at the end titled "Redesign pass 1: all apps".

## In the morning

1. **Check the PRs:**
   - Read each PR's summary and the app brief's **Follow-ups**, which hold questions for you.
   - Check the before/after numbers in **Done**.
2. **Merge the ones you like.**
3. **Build the zips:**

   ```bash
   git pull
   scripts/build-zip.sh all
   ```

4. **Test each zip in Hub before publishing:**
   - all four themes;
   - a phone-width window;
   - the main flows, especially anything involving QORT (Q-Trade+, Q-Shop+, Q-Fund+, Names+, Q-Support+).
5. **Publish** `release/<App+>.zip` from Hub as `APP` under the matching name.
6. **Update `docs/PROGRESS.md`,** or ask a session to do it.

## If something goes wrong

- **A session stopped early:** open it again from claude.ai/code and say "continue". Its progress is in the app brief and the git log.
- **Two PRs both changed the same shared file:** merge one, then ask the other session to `git merge main` and resolve the conflict.
- **Upstream Qortal repos moved on:** run `scripts/sync-upstream.sh --check` to see what's new, then `scripts/sync-upstream.sh <App+>` to merge it.
