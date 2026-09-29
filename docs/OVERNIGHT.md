# Running the redesign overnight in the cloud

This is how to hand the apps to Fable in Claude Code on the web (claude.ai/code), so the work runs on cloud credits while you sleep. Every app pass starts with the **React 19.3 + MUI 9.4 upgrade** (docs/PLATFORM.md), then the redesign. **Q-Mintership+** gets a phased React rewrite instead.

## One-time setup (Simon)

1. **The repo is on GitHub** at [SJQortal/Q-Apps-Plus](https://github.com/SJQortal/Q-Apps-Plus). Done.
2. **GitHub is connected to Claude Code on the web.** Done: `Q-Apps-Plus` shows in the repo picker at [claude.ai/code](https://claude.ai/code).
3. **Cloud environment: "Qortal Programmer".** Done. Network access is *Full* (Trusted would also do), with no environment variables and no setup script. Each session installs the apps it works on.
4. **Model:** pick **Fable** when you start each session, or type `/model fable` as the first message.
5. **For Hub testing (local only):** Claude restarts Hub with its debug port, and you log in to the Tester GO account yourself with Dev Mode on (docs/HUB-TESTING.md). Computer use isn't needed, and the Linux app doesn't have it.

Cloud sessions load this repo's `CLAUDE.md`, the `qplus-app` skill and `.claude/settings.json`. They keep working after you close the browser. A session only stops early if it waits on a question, which is why the prompts below tell it not to ask.

## Recommended plan: pilot, then fan out

### Evening: pilot Names+ (about an hour, while you're around)

> Use the qplus-app skill to do a full pass on **Names+**: platform upgrade to React 19.3 + MUI 9.4 first, then the redesign. Work only in `apps/Names+/`, `docs/apps/Names+.md`, and `shared/` if the kit or docs need a fix. Don't stop to ask questions. Make sensible calls and list open questions in the brief's Follow-ups. When done, push and open a PR titled "Names+: React 19.3 / MUI 9.4 + redesign pass 1".

Then test it in Hub (a **local** session, following docs/HUB-TESTING.md), fix anything that turns up, and merge. Any kit or doc fixes land on `main` before the fan-out.

### Night: one cloud session per app, all in parallel

For **Q-Node+, Q-Tube+, Q-Trade+, Q-Mail+, Q-Share+, Q-Support+, Q-Fund+ and Q-Shop+** (8 sessions), change the name each time:

> Use the qplus-app skill to do a full pass on **Q-Mail+**: platform upgrade to React 19.3 + MUI 9.4 first (its own commit), then the redesign. Work only in `apps/Q-Mail+/` and `docs/apps/Q-Mail+.md`. Do not edit `shared/`, `docs/PROGRESS.md` or other apps. If the theme kit needs a change, work around it inside the app's own theme config and describe the needed kit change in Follow-ups. Don't stop to ask questions. Make sensible calls and list open questions in Follow-ups. When done, push and open a PR titled "Q-Mail+: React 19.3 / MUI 9.4 + redesign pass 1".

For **Q-Mintership+** (1 session):

> Use the qplus-app skill for **Q-Mintership+**. Follow the Rewrite plan in `docs/apps/Q-Mintership+.md`: do phase 1 (scaffold, data layer, data contract, parity checklist) and, if time allows, phase 2 (read-only boards). Work only in `apps/Q-Mintership+/` and `docs/apps/Q-Mintership+.md`. Don't stop to ask questions; list open questions in Follow-ups. Open one PR per phase, titled "Q-Mintership+: React rewrite phase N".

Each session works in its own folder on its own branch, so the PRs don't conflict.

### Later: Q-Apps+ (the launcher)

Start this after the others are merged, since it presents them:

> Use the qplus-app skill to build **Q-Apps+** from scratch as described in `docs/apps/Q-Apps+.md`, on React 19.3 + MUI 9.4 with the Hub 3.0 kit. Read every other app's brief for names, taglines and what's new. Don't stop to ask questions. Push and open a PR titled "Q-Apps+: first version".

### Following nights: Q-Mintership+ phases 3–5

Continue with one session per phase (write flows → admin side → redesign), each starting from the merged previous phase.

## In the morning

1. **Check the PRs:**
   - Read each PR's summary and the brief's **Follow-ups**, which hold questions for you.
   - Check the before/after numbers in **Done**.
2. **Test in Hub.** In a local session:

   > Test PR #N (Q-Mail+) in Hub Dev Mode following docs/HUB-TESTING.md.

   Claude runs the dev server, loads it in Hub, checks the four themes, phone width and the main read-only flows, and reports back. Anything that publishes or spends QORT, Claude asks you first.
3. **Merge the good ones, then build the zips:**

   ```bash
   git pull
   scripts/build-zip.sh all
   ```

4. **Before publishing:** preview each zip in Hub Dev Mode (**preview zip**). For a GO check, open it on your phone.
5. **Publish** `release/<App+>.zip` from Hub as `APP` under the matching name. Don't publish Q-Mintership+ until its parity checklist is complete.
6. **Update `docs/PROGRESS.md`,** or ask a session to do it.

## If something goes wrong

- **A session stopped early:** open it again from claude.ai/code and say "continue". Its progress is in the app brief and the git log.
- **Two PRs both changed the same shared file:** merge one, then ask the other session to `git merge main` and resolve the conflict.
- **Upstream Qortal repos moved on:** run `scripts/sync-upstream.sh --check` to see what's new, then `scripts/sync-upstream.sh <App+>` to merge it.
