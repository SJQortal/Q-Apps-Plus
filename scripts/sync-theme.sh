#!/usr/bin/env bash
# Copy shared/hub-theme into every app that has opted in, or check for drift.
#   scripts/sync-theme.sh           copy the kit into the apps
#   scripts/sync-theme.sh --check   exit 1 if any app's copy differs
# An app opts in by having src/hub-theme/ (React + MUI) or assets/hub-theme/
# (plain HTML/JS). Never edit those copies; edit shared/hub-theme and re-run.
set -euo pipefail
root=$(git rev-parse --show-toplevel)
kit="$root/shared/hub-theme"
check=${1:-}

node "$kit/build-css.mjs" >/dev/null

react_files=(tokens.ts boot.ts mui-theme.ts mui-augment.d.ts HubThemeProvider.tsx ThemePicker.tsx index.ts fonts.css fonts)
plain_files=(hub-theme.css fonts.css boot-inline.js fonts)

drift=0
sync_into() { # sync_into <dest> <files...>
  local dest=$1; shift
  for f in "$@"; do
    if [ "$check" = --check ]; then
      diff -rq "$kit/$f" "$dest/$f" >/dev/null 2>&1 || { echo "drift: ${dest#"$root"/}/$f"; drift=1; }
    else
      rm -rf "${dest:?}/$f"
      cp -R "$kit/$f" "$dest/$f"
    fi
  done
}

for dir in "$root"/apps/*/; do
  app=$(basename "$dir")
  if [ -d "$dir/src/hub-theme" ]; then
    sync_into "$dir/src/hub-theme" "${react_files[@]}"
    [ "$check" = --check ] || echo "$app: synced src/hub-theme"
  elif [ -d "$dir/assets/hub-theme" ]; then
    sync_into "$dir/assets/hub-theme" "${plain_files[@]}"
    [ "$check" = --check ] || echo "$app: synced assets/hub-theme"
  fi
done

if [ "$check" = --check ]; then
  [ $drift -eq 0 ] && echo "All app copies of the theme kit match shared/hub-theme."
  exit $drift
fi
