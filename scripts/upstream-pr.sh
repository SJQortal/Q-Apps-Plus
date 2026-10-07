#!/usr/bin/env bash
# Prepare an app's pull request to its original Qortal repo (docs/RELEASE.md, stage 4).
#
#   scripts/upstream-pr.sh <App+> --check               is it ready to split? (nothing is kept)
#   scripts/upstream-pr.sh <App+> [--version X.Y.Z]     split it into a branch + worktree for the "Ship as" commit
#   scripts/upstream-pr.sh <App+> --push [--version …]  fork the Qortal repo if needed and push the branch to the fork
#
# The branch is apps/<App+>'s history from origin/main, on top of the Qortal
# repo's own commits (upstreams.tsv), so the PR is a fast-forward. Claude
# attribution lines are dropped from the split's messages (the branch is new,
# so nothing published is rewritten). --push never opens the PR: Simon reads
# the PR text first, then `gh pr create` (printed at the end) opens it.
set -euo pipefail
root=$(git rev-parse --show-toplevel)
cd "$root"

app=${1:?usage: scripts/upstream-pr.sh <App+> [--check|--push] [--version X.Y.Z]}
shift
mode=split
version=
while [ $# -gt 0 ]; do
  case "$1" in
    --check) mode=check ;;
    --push) mode=push ;;
    --version) version=${2:?--version needs a value}; shift ;;
    *) echo "Unknown option $1" >&2; exit 1 ;;
  esac
  shift
done

line=$(grep -P "^\Q$app\E\t" upstreams.tsv || true)
[ -n "$line" ] || { echo "$app is not in upstreams.tsv" >&2; exit 1; }
IFS=$'\t' read -r _ remote repo ubranch <<< "$line"
[ -d "apps/$app" ] || { echo "No apps/$app" >&2; exit 1; }

git remote get-url "$remote" >/dev/null 2>&1 || git remote add "$remote" "https://github.com/$repo.git"
git fetch --quiet origin main
git fetch --quiet --no-tags "$remote" "$ubranch"
up="$remote/$ubranch"

# Version: the Qortal repo's own series, one major up for a redesign, unless given.
if [ -z "$version" ]; then
  uver=$(git show "$up:package.json" 2>/dev/null | grep -m1 '"version"' | sed -E 's/.*"([0-9]+)\..*/\1/' || true)
  version=$(( ${uver:-0} + 1 )).0.0
fi
orig=$(basename "$repo")
slug=$(echo "$app" | tr '[:upper:]' '[:lower:]' | sed 's/+$//')
branch="$slug-upstream/$version"
wt="$root/.worktrees/upstream-$slug"

split_into() { # split apps/$app from origin/main into branch $1, then drop Claude lines
  git subtree split --quiet --prefix="apps/$app" origin/main -b "$1" >/dev/null
  if git log --format=%B "$up..$1" | grep -qiE '^(co-authored-by: claude|claude-session:|🤖 generated with)'; then
    echo "Dropping Claude attribution lines from the split's messages…"
    FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f --msg-filter \
      'grep -v -iE "^(Co-Authored-By: Claude|Claude-Session: |🤖 Generated with)" | sed -e :a -e "/^\n*\$/{\$d;N;ba" -e "}"' \
      -- "$up..$1" >/dev/null 2>&1
    git update-ref -d "refs/original/refs/heads/$1" 2>/dev/null || true
  fi
}

report() { # facts about branch $1
  local ff=no
  git merge-base --is-ancestor "$up" "$1" && ff=yes
  echo "  Qortal repo:      $repo ($ubranch at $(git rev-parse --short "$up"), last change $(git log -1 --format=%cs "$up"))"
  echo "  fast-forward:     $ff"
  echo "  commits on top:   $(git rev-list --count "$up..$1")"
  echo "  files changed:   $(git diff --shortstat "$up" "$1")"
  echo "  Claude lines:     $(git log --format=%B "$up..$1" | grep -ciE '^(co-authored-by: claude|claude-session:|🤖 generated with)' || true)"
  echo "  version for PR:   $version (Qortal's is $(git show "$up:package.json" 2>/dev/null | grep -m1 '"version"' | sed -E 's/.*: *"([^"]*)".*/\1/'))"
  [ "$ff" = yes ] || echo "  !! $repo has moved on: run scripts/sync-upstream.sh $app, test, publish and merge first."
}

case "$mode" in
check)
  tmp="tmp/upstream-check-$slug-$$"
  split_into "$tmp"
  echo "$app → $repo"
  report "$tmp"
  git branch -D -q "$tmp"
  ;;
split)
  if git show-ref --quiet "refs/heads/$branch"; then
    echo "$branch already exists. Continue in $wt, or delete the branch to start over." >&2
    exit 1
  fi
  split_into "$branch"
  echo "$app → $repo: branch $branch"
  report "$branch"
  rm -rf "$wt"; git worktree prune
  git worktree add -q "$wt" "$branch"
  cat <<EOF

Next (docs/RELEASE.md → "Ship as" checklist), in $wt:
  1. npm ci, then make ONE commit "Ship as $orig $version: name, links, storage keys, version and README".
  2. npm test, npm run lint, npm run build, node e2e/screens.mjs (copy of scripts/screens.mjs, see the checklist).
  3. Write the PR text from docs/templates/upstream-pr.md and show it to Simon.
  4. After his yes: scripts/upstream-pr.sh $app --push --version $version
EOF
  ;;
push)
  git show-ref --quiet "refs/heads/$branch" || { echo "No branch $branch: run scripts/upstream-pr.sh $app first." >&2; exit 1; }
  last=$(git log -1 --format=%s "$branch")
  case "$last" in "Ship as "*) ;; *) echo "The last commit on $branch is not the \"Ship as …\" commit (it is: $last)." >&2; exit 1 ;; esac
  me=$(gh api user --jq .login)
  fork="$me/$orig"
  if ! gh repo view "$fork" --json isFork --jq .isFork >/dev/null 2>&1; then
    echo "Forking $repo to $fork…"
    gh repo fork "$repo" --clone=false --default-branch-only >/dev/null
    for _ in 1 2 3 4 5 6 7 8 9 10; do gh repo view "$fork" >/dev/null 2>&1 && break; sleep 3; done
  fi
  head="$slug-$version"
  git push --quiet "https://github.com/$fork.git" "$branch:refs/heads/$head"
  echo "Pushed $branch to $fork as $head."
  echo
  echo "Open the PR once Simon has approved the text:"
  echo "  gh pr create --repo $repo --base $ubranch --head $me:$head --title \"…\" --body-file <pr-text.md>"
  ;;
esac
