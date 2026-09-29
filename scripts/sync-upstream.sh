#!/usr/bin/env bash
# Bring new commits from the original Qortal repos into apps/<App+>/.
#   scripts/sync-upstream.sh --check        list unmerged upstream commits per app
#   scripts/sync-upstream.sh Q-Mail+        merge upstream into apps/Q-Mail+
#   scripts/sync-upstream.sh all            merge every app
# Upstream repos and branches live in upstreams.tsv. Remotes are added on demand,
# so this works in a fresh clone or a cloud session too.
set -euo pipefail
root=$(git rev-parse --show-toplevel)
cd "$root"
target=${1:?usage: scripts/sync-upstream.sh <App+|all|--check>}

if [ "$(git rev-parse --is-shallow-repository)" = true ]; then
  echo "Shallow clone: fetching full history first (subtree needs it)."
  git fetch --unshallow --quiet
fi

# Read the list on fd 3 so git subtree cannot swallow it from stdin.
while IFS=$'\t' read -r folder remote repo branch <&3; do
  [ "$target" = all ] || [ "$target" = --check ] || [ "$target" = "$folder" ] || continue
  git remote get-url "$remote" >/dev/null 2>&1 ||
    git remote add "$remote" "https://github.com/$repo.git"
  git fetch --quiet --no-tags "$remote" "$branch"
  pending=$(git rev-list --count "$remote/$branch" ^HEAD)
  if [ "$target" = --check ]; then
    printf '%-15s %3s new upstream commit(s)  (%s %s)\n' "$folder" "$pending" "$repo" "$branch"
    [ "$pending" -gt 0 ] && git log --format='                  %cs %an: %s' "$remote/$branch" ^HEAD | head -5
    continue
  fi
  if [ "$pending" -eq 0 ]; then
    echo "$folder: already up to date with $repo@$branch"
    continue
  fi
  echo "$folder: merging $pending commit(s) from $repo@$branch"
  git subtree pull --prefix="apps/$folder" "$remote" "$branch" \
    -m "$folder: merge upstream $repo@$branch"
done 3< <(grep -v '^#' upstreams.tsv)
