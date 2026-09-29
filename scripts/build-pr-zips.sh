#!/usr/bin/env bash
# Morning helper: build a Qortal publish zip for every open app PR.
# Each PR branch is checked out in .worktrees/<branch> (so your checkout is
# untouched), built, and zipped to release/<App+>.zip. A summary goes to
# release/SUMMARY.md.
#   scripts/build-pr-zips.sh            all open PRs
#   scripts/build-pr-zips.sh 12 14      only these PR numbers
set -uo pipefail
root=$(git rev-parse --show-toplevel)
cd "$root"
mkdir -p release .worktrees
git fetch -q origin --prune

summary="$root/release/SUMMARY.md"
{
  echo "# Zips built $(date '+%Y-%m-%d %H:%M')"
  echo
  echo "| App | PR | Branch @ commit | Build | Zip |"
  echo "|---|---|---|---|---|"
} > "$summary"

# branch prefix (e.g. q-mail-plus) -> app folder (Q-Mail+)
app_for_branch() {
  local prefix=${1%%/*} d slug
  for d in apps/*/; do
    d=$(basename "$d")
    slug=$(echo "$d" | tr '[:upper:]' '[:lower:]' | sed 's/+$/-plus/')
    [ "$slug" = "$prefix" ] && { echo "$d"; return; }
  done
}

prs=${PR_LIST:-$(gh pr list --state open --json number,headRefName --jq '.[] | "\(.number) \(.headRefName)"')}  # PR_LIST="<num> <branch>" overrides, for testing
[ $# -gt 0 ] && prs=$(echo "$prs" | grep -E "^($(IFS='|'; echo "$*")) ")
[ -n "$prs" ] || { echo "No open PRs to build."; exit 0; }

while read -r num branch; do
  app=$(app_for_branch "$branch")
  if [ -z "$app" ]; then
    echo "PR #$num ($branch): not an app branch, skipped"
    continue
  fi
  wt="$root/.worktrees/$branch"
  rm -rf "$wt"; git worktree prune
  git worktree add -q --detach "$wt" "origin/$branch" || { echo "| $app | #$num | $branch | checkout failed | – |" >> "$summary"; continue; }
  sha=$(git -C "$wt" rev-parse --short HEAD)
  echo "== $app from PR #$num ($branch @ $sha)"
  if (cd "$wt" && scripts/build-zip.sh "$app") > "$root/release/$app.build.log" 2>&1; then
    cp "$wt/release/$app.zip" "$root/release/$app.zip"
    size=$(du -h "$root/release/$app.zip" | cut -f1)
    echo "| $app | #$num | $branch @ $sha | ✅ | release/$app.zip ($size) |" >> "$summary"
    echo "   ok: release/$app.zip ($size)"
  else
    echo "| $app | #$num | $branch @ $sha | ❌ see release/$app.build.log | – |" >> "$summary"
    echo "   FAILED: see release/$app.build.log"
  fi
done <<< "$prs"

echo; cat "$summary"
