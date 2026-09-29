#!/usr/bin/env bash
# List @mui/icons-material imports in an app that don't exist in its installed
# icons package (MUI 9 removed the legacy "…Outline" names; use "…OutlineOutlined").
#   scripts/check-mui-icons.sh Q-Tube+
# Needs the app's node_modules. Exits 1 if anything is missing.
set -euo pipefail
root=$(git rev-parse --show-toplevel)
app=${1:?usage: scripts/check-mui-icons.sh <App+>}
dir="$root/apps/$app"
[ -d "$dir/node_modules/@mui/icons-material" ] || { echo "Run npm ci in apps/$app first." >&2; exit 1; }
cd "$dir"
node - <<'JS'
const fs = require('fs');
const path = require('path');
const iconsDir = path.join('node_modules', '@mui', 'icons-material');
const version = JSON.parse(fs.readFileSync(path.join(iconsDir, 'package.json'), 'utf8')).version;
const exists = (name) => fs.existsSync(path.join(iconsDir, `${name}.js`));
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx?|jsx?|mjs)$/.test(e.name)) files.push(p);
  }
})('src');
const missing = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/['"]@mui\/icons-material\/([A-Za-z0-9]+)['"]/g))
    if (!exists(m[1])) missing.push(`${f}: ${m[1]}`);
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]@mui\/icons-material['"]/g))
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/)[0].trim();
      if (name && !exists(name)) missing.push(`${f}: ${name}`);
    }
}
console.log(`@mui/icons-material ${version}: checked ${files.length} files`);
if (missing.length) {
  console.log('Missing icons (try the "Outlined" variant, e.g. ErrorOutline -> ErrorOutlineOutlined):');
  for (const m of missing) console.log('  ' + m);
  process.exit(1);
}
console.log('All icon imports resolve.');
JS
