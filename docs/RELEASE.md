# From local build to Qortal: the release pipeline

Every + app goes through the same four stages:
1. It's built here.
2. It's published under its + name on QDN, as a testground.
3. The community tries it.
4. When it has proven itself, it's offered to the original Qortal repo as a pull request.

Q-Share went through all four first ([Qortal/q-share#9](https://github.com/Qortal/q-share/pull/9)). docs/PROGRESS.md shows where each app is.

| Stage | Where | Who | Ends with |
|---|---|---|---|
| 1. Build | local chat, the app's own folder | Claude (qplus-app skill, rounds 1–5) | a zip that passes the skill's "Done means" |
| 2. Testground | QDN, as `<App>+` | Simon publishes; Claude checks and merges | the brief's **Published** line and the PR merged into `main` |
| 3. Community testing | Hub and GO, with the community | Simon collects feedback; Claude fixes | 1.0.x releases, until Simon calls it ready |
| 4. Upstream PR | the original Qortal repo | Claude prepares; Simon approves; Claude posts | a PR from Simon's fork, with the maintenance note |

## 1. Build

Follow the `qplus-app` skill in the app's own folder (docs/OVERNIGHT.md → Setup). The app is ready to publish when its "Done means" checklist holds, including the Hub check.

**Keep everything + specific in one place.** Put the app's name, the name used in copied `qortal://APP/…` links, the browser storage prefix, the settings-sync identifier and the repo links in one module, for example `src/constants/plus.ts`. That keeps stage 4's "Ship as" commit small. Q-Share+ predates this rule, and its README lists where those things live instead.

## 2. Testground: publish as `<App>+`

1. Simon tests the zip in Hub (Dev Mode → **Zip**), then publishes `release/<App+>.zip` as `APP` under the + name.
2. Claude checks that the live bundle matches a build of the commit: the files referenced from `index.html` on the node versus a fresh build. Then Claude adds the **Published** line to the brief and merges the PR.
3. Versions start at 1.0.0 and follow the skill's release rules.

## 3. Community testing

- **Feedback:** Simon shares the app with the community (Q-Chat, Qortal groups, the dev team) and passes on what people report. Claude logs it in the brief, in a **Community feedback** section: date, where it came from, what was reported, and its status.
- **Fixes** go out as 1.0.1, 1.0.2 and so on, the same way as stage 1:
  1. the app's folder, on a branch `<slug>/1.0.x`;
  2. a Hub check;
  3. Simon publishes;
  4. Claude records it and merges.
- **Ready for upstream:** Simon decides. Before he does, check:
  - [ ] no open bug from the community that loses data, costs QORT or blocks a main flow;
  - [ ] the brief's "needs a phone (GO)" checks have been done on a real phone;
  - [ ] the original app's repo hasn't moved on (`scripts/upstream-pr.sh <App+> --check` says fast-forward: yes), or `scripts/sync-upstream.sh <App+>` has merged its changes and they've been tested and published;
  - [ ] the brief's open questions for Simon are answered or deliberately left open.

## 4. The upstream PR

```bash
scripts/upstream-pr.sh <App+> --check                 # fast-forward? how many commits? Claude lines? version?
scripts/upstream-pr.sh <App+> [--version X.Y.Z]       # branch <slug>-upstream/<version> + worktree .worktrees/upstream-<slug>
# … the "Ship as" commit, checks, PR text …
scripts/upstream-pr.sh <App+> --push --version X.Y.Z  # fork <QortalRepo> to SJQortal if needed, push the branch
gh pr create --repo <QortalRepo> --base <branch> --head SJQortal:<slug>-<version> --title "…" --body-file pr.md
```

**What the branch is.** It's `apps/<App+>`'s history from `main`, split out with `git subtree split`, on top of the Qortal repo's own commits, so the PR is a fast-forward. It's a new branch, so the script drops any Claude attribution lines from its messages without rewriting anything already published.

**Version.** By default the PR uses the Qortal repo's own version series, one major version up (a redesign). Pass `--version` to choose another.

### "Ship as" checklist (one commit: `Ship as <Original> <version>: …`)

- **Name:** the window title, header, welcome notice, Settings → About, What's new, and error logs say the original name.
- **Links:** copied `qortal://APP/…` links use the original name, and the tests that check it are updated. Tests about `+` handling in general stay.
- **Storage:** browser storage keys and the settings-sync identifier drop the "plus", for example `qshareplus-*` → `qshare-*`.
  - First check that the new names don't clash with keys or identifiers the original app already uses.
  - All Q-Apps on a node share one browser origin, so keys that stay the same would mix the two apps' settings.
- **Version:** `package.json` and `package-lock.json` get the original package name and the PR version. The changelog becomes **one** entry for that version, saying it was first published as `<App>+`.
- **README:** written for the Qortal repo (what's new, develop, test, publish, data, notes for maintainers). Point to the brief in this repo for the full audit and test records.
- **Monorepo references:** copy `scripts/screens.mjs` to `e2e/screens.mjs` and make it standalone (Q-Share's PR shows how). Comments that cite `docs/apps/…` get full GitHub links.
- **Checks:** `npm test`, `npm run lint`, `npm run build` and `node e2e/screens.mjs` pass, and nothing + specific is left (`grep -rn "<App>+\|plus" src index.html`, apart from deliberate credits).

### PR text

Write it from `docs/templates/upstream-pr.md`. It always ends with the **Maintenance** note: Simon offers to take over updates, and new work keeps coming through the same path (built here, tested as `<App>+` on QDN, then PR'd). **Simon reads the text before anything is posted.** After the PR is open, record its link in the brief and in docs/PROGRESS.md.

### After the PR

- **Review comments:** fix them on the same branch in the worktree, then run `--push` again. The PR updates by itself.
- **If Qortal merges and publishes it,** note that in the brief. The + app keeps running as the testground for the next round.
- **Later updates:** after further 1.0.x releases of the + app, run the script again with a new `--version`. If Qortal merged the earlier PR as a merge or fast-forward, the new split continues from it. If they squashed it, rebase the new split onto their `main` before pushing, and say so in the PR.
