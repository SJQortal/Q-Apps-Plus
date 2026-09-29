#!/usr/bin/env bash
# Typecheck and smoke-test shared/hub-theme against an app's own MUI/React/TS
# versions (run after editing the kit). The app needs node_modules installed.
#   scripts/check-theme-kit.sh Q-Mail+      (MUI 5 / TS 4.9)
#   scripts/check-theme-kit.sh Q-Tube+      (MUI 7 / TS 5.9)
set -euo pipefail
root=$(git rev-parse --show-toplevel)
app=${1:?usage: scripts/check-theme-kit.sh <App+>}
dir="$root/apps/$app"
[ -d "$dir/node_modules" ] || { echo "Run npm ci in apps/$app first." >&2; exit 1; }

tmp="$dir/hub-theme-check.tmp"
rm -rf "$tmp"; mkdir -p "$tmp"
trap 'rm -rf "$tmp"' EXIT
cp "$root"/shared/hub-theme/*.ts "$root"/shared/hub-theme/*.tsx "$root/shared/hub-theme/dev/smoke.tsx" "$tmp/"
cat > "$tmp/tsconfig.json" <<'JSON'
{
  "compilerOptions": {
    "target": "ES2020", "lib": ["ES2020", "DOM", "DOM.Iterable"], "module": "ESNext",
    "moduleResolution": "node", "jsx": "react-jsx", "strict": true, "noEmit": true,
    "skipLibCheck": true, "isolatedModules": true, "esModuleInterop": true
  },
  "include": ["**/*"]
}
JSON
cd "$dir"
echo "MUI $(node -p "require('@mui/material/package.json').version"), TypeScript $(node -p "require('typescript/package.json').version")"
npx tsc -p "$tmp/tsconfig.json" && echo "typecheck OK"
npx esbuild "$tmp/smoke.tsx" --bundle --platform=node --jsx=automatic --log-level=error --outfile="$tmp/smoke.cjs"
node "$tmp/smoke.cjs"
