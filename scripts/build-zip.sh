#!/usr/bin/env bash
# Build an app and write its Qortal publish zip to release/<App+>.zip,
# with index.html at the zip root (what Hub expects when publishing an APP).
#   scripts/build-zip.sh Q-Mail+
#   scripts/build-zip.sh all
set -euo pipefail
root=$(git rev-parse --show-toplevel)
target=${1:?usage: scripts/build-zip.sh <App+|all>}
mkdir -p "$root/release"

zip_dir() { # zip_dir <dir> <zip> [paths...]
  local dir=$1 out=$2; shift 2
  rm -f "$out"
  if command -v zip >/dev/null; then
    (cd "$dir" && zip -r -q "$out" "${@:-.}" -x '*.map')
  else
    (cd "$dir" && python3 - "$out" "${@:-.}" <<'PY'
import os, sys, zipfile
out, paths = sys.argv[1], sys.argv[2:]
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for p in paths:
        for base, _, files in os.walk(p) if os.path.isdir(p) else [('', [], [p])]:
            for f in files:
                full = os.path.join(base, f)
                if not full.endswith('.map'):
                    z.write(full, os.path.normpath(full))
PY
    )
  fi
}

for dir in "$root"/apps/*/; do
  app=$(basename "$dir")
  [ "$target" = all ] || [ "$target" = "$app" ] || continue
  out="$root/release/$app.zip"
  if [ -f "$dir/package.json" ]; then
    (
      cd "$dir"
      [ -d node_modules ] || npm ci --no-audit --no-fund
      npm run build
    )
    dist="$dir/dist"
    [ -f "$dist/index.html" ] || { echo "$app: no dist/index.html after build" >&2; exit 1; }
    zip_dir "$dist" "$out"
  else
    # Plain HTML/JS app (Q-Mintership+): ship index.html and assets as they are.
    zip_dir "$dir" "$out" index.html assets
  fi
  echo "$app: $(du -h "$out" | cut -f1) -> release/$app.zip"
done
