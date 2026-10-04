#!/usr/bin/env node
/**
 * Screenshot check for one + app (docs/DESIGN.md → Mobile → Check), shared by
 * every app. Serves the app's production build with `vite preview`, answers
 * qortalRequest and the Core endpoints from the app's own mocks, and captures
 * every screen at five sizes in the four themes. Each capture is checked for
 * console errors, sideways overflow, buttons without an accessible name, small
 * tap targets and text, Qortal call counts, and axe-core (WCAG 2.1 A/AA and
 * best practices) violations.
 *
 *   scripts/screens.mjs <App+> [--only home,share] [--themes hub30] [--mode light] [--build] [--port 4173]
 *
 * The app describes itself in apps/<App+>/e2e/screens.config.mjs (see
 * apps/Q-Share+/e2e/screens.config.mjs): its name, theme storage key, mock
 * qortalRequest answers, Core routes and screens. Nothing here publishes or
 * touches a node. Captures land in apps/<App+>/e2e/shots/ (git-ignored), and
 * the report beside them as report-<themes>-<mode>.json: report-all-dark.json
 * for the default run, report-hub30,black-light.json for `--themes hub30,black
 * --mode light`. Runs with different themes or modes can go side by side
 * without overwriting each other's report.
 *
 * Needs Playwright: a global `playwright`, or `playwright-core` plus a
 * Chromium-based browser in QPLUS_CHROMIUM (e.g. /snap/bin/brave).
 * QPLUS_PLAYWRIGHT can point at a playwright or playwright-core folder.
 */
import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const VALUED = ['only', 'themes', 'mode', 'port'];
const appName = args.find((a, i) => !a.startsWith('--') && !VALUED.includes(args[i - 1]?.slice(2)));
if (!appName) {
  console.error('Usage: scripts/screens.mjs <App+> [--only a,b] [--themes hub30,black] [--mode light] [--build]');
  process.exit(1);
}
const app = path.join(root, 'apps', appName);
const configFile = path.join(app, 'e2e', 'screens.config.mjs');
if (!existsSync(configFile)) {
  console.error(`No ${path.relative(root, configFile)}. Copy apps/Q-Share+/e2e/screens.config.mjs and adapt it.`);
  process.exit(1);
}
const config = (await import(pathToFileURL(configFile).href)).default;
const shots = path.join(app, 'e2e', 'shots');
mkdirSync(shots, { recursive: true });

const onlyScreens = opt('only', '').split(',').filter(Boolean);
const themes = opt('themes', 'hub30,hub20,black,white').split(',');
const PORT = Number(opt('port', '4173'));
// Hub's light or dark mode, which Hub 3.0 and Hub 2.0 follow.
const MODE = opt('mode', 'dark') === 'light' ? 'light' : 'dark';
const ctx = { mode: MODE, now: Date.now() };

const VIEWPORTS = [
  { name: '360x740', width: 360, height: 740, mobile: true },
  { name: '390x844', width: 390, height: 844, mobile: true },
  { name: '844x390', width: 844, height: 390, mobile: true },
  { name: '700', width: 700, height: 900, mobile: false },
  { name: '1280', width: 1280, height: 800, mobile: false },
];

// ---- tools -----------------------------------------------------------------
function resolveFrom(dirs, names) {
  for (const dir of dirs) for (const name of names) {
    const p = path.join(dir, name);
    if (existsSync(p)) return p;
  }
  return null;
}
const globalRoot = (() => {
  try {
    return execSync('npm root -g').toString().trim();
  } catch {
    return '';
  }
})();
const moduleDirs = [path.join(app, 'node_modules'), path.join(root, 'node_modules'), globalRoot].filter(Boolean);
const pwDir = process.env.QPLUS_PLAYWRIGHT || resolveFrom(moduleDirs, ['playwright', 'playwright-core']);
if (!pwDir) {
  console.error('Playwright not found. Install it globally (npm i -g playwright && npx playwright install chromium),\nor install playwright-core somewhere and set QPLUS_PLAYWRIGHT=<its folder> and QPLUS_CHROMIUM=<a Chromium-based browser>.');
  process.exit(1);
}
const pw = await import(pathToFileURL(resolveFrom([pwDir], ['index.mjs', 'index.js'])).href);
const chromium = pw.chromium ?? pw.default?.chromium;
const axePath = resolveFrom(moduleDirs.map((d) => path.join(d, 'axe-core')), ['axe.min.js']);
const AXE_SOURCE = axePath ? readFileSync(axePath, 'utf8') : null;
if (!AXE_SOURCE) console.warn('axe-core not found (npm i -D axe-core in the app): accessibility audit skipped.');

if (args.includes('--build') || !existsSync(path.join(app, 'dist', 'index.html'))) {
  console.log(`Building ${appName}…`);
  execSync('npm run build', { cwd: app, stdio: 'inherit' });
}

// ---- page setup ------------------------------------------------------------
function baseSource(theme) {
  return `
    try { localStorage.setItem(${JSON.stringify(config.themeKey)}, JSON.stringify(${JSON.stringify(theme)})); } catch (e) {}
    window._qdnTheme = ${JSON.stringify(MODE)};
    window._qdnName = ${JSON.stringify(config.name)};
    window.__calls = [];
  `;
}
// The app's answers define window.__qplusAnswer; every request is counted here.
const qortalSource = () => `
  ${config.qortal(ctx)}
  const __answer = async (p) => {
    window.__calls.push(p.action + (p.identifier ? ':' + p.identifier : ''));
    return window.__qplusAnswer(p);
  };
  window.qortalRequest = __answer;
  window.qortalRequestWithTimeout = (p) => __answer(p);
`;

async function routeAssets(page) {
  // Builds use relative asset paths (vite base ""), which Hub resolves itself.
  // Under a deep route the preview server would 404, so map them back.
  await page.route(/\/(assets\/[^/?]+|favicon\.ico)(\?.*)?$/, (route) => {
    const url = new URL(route.request().url());
    const m = url.pathname.match(/\/(assets\/[^/]+|favicon\.ico)$/);
    if (!m || url.pathname === '/' + m[1]) return route.continue();
    return route.continue({ url: `${url.origin}/${m[1]}${url.search}` });
  });
}

function startPreview() {
  // Its own process group, so the real vite process dies with the npx wrapper.
  const child = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: app, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('vite preview did not start')), 20000);
    child.stdout.on('data', (d) => { if (String(d).includes('http')) { clearTimeout(t); resolve(child); } });
    child.stderr.on('data', (d) => process.stderr.write(d));
    child.on('exit', (c) => reject(new Error(`vite preview exited ${c}`)));
  });
}

// ---- run -------------------------------------------------------------------
const preview = await startPreview();
const browser = await chromium.launch({ headless: true, ...(process.env.QPLUS_CHROMIUM ? { executablePath: process.env.QPLUS_CHROMIUM, args: ['--no-sandbox'] } : {}) });
if (config.setup) await config.setup({ browser, ctx });
const report = [];
try {
  for (const theme of themes) {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
        isMobile: vp.mobile,
        hasTouch: vp.mobile,
        reducedMotion: 'reduce',
      });
      await context.addInitScript(baseSource(theme));
      for (const s of config.initScripts?.(ctx) ?? []) await context.addInitScript(s);
      await context.addInitScript(qortalSource());
      for (const screen of config.screens) {
        if (onlyScreens.length && !onlyScreens.includes(screen.key)) continue;
        if (screen.mobileOnly && !vp.mobile) continue;
        const page = await context.newPage();
        if (vp.mobile) {
          // Playwright's touch emulation leaves the hover/pointer media
          // features alone; a real phone reports hover:none and pointer:coarse.
          const cdp = await context.newCDPSession(page);
          await cdp.send('Emulation.setEmulatedMedia', {
            features: [
              { name: 'hover', value: 'none' },
              { name: 'any-hover', value: 'none' },
              { name: 'pointer', value: 'coarse' },
              { name: 'any-pointer', value: 'coarse' },
              { name: 'prefers-reduced-motion', value: 'reduce' },
            ],
          });
        }
        page.__fetches = [];
        const errors = [];
        page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
        page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 160)));
        await routeAssets(page);
        await page.route(/\/(arbitrary|names|lists|addresses|transactions|blocks|crosschain|chat|groups|admin)\//, async (route) => {
          const url = new URL(route.request().url());
          page.__fetches.push(url.pathname + url.search);
          const handled = config.route ? await config.route(route, url, ctx) : false;
          if (!handled) await route.fulfill({ status: 404, body: '' });
        });
        let ok = true;
        try {
          await page.goto(`http://127.0.0.1:${PORT}${screen.path}?theme=${MODE}`, { waitUntil: 'load', timeout: 12000 });
          await page.waitForSelector('#root > *', { timeout: 8000 }).catch(() => {});
          for (const label of config.dismiss ?? []) {
            const b = page.getByRole('button', { name: label });
            if (await b.count()) await b.first().click({ timeout: 2500 }).catch(() => {});
          }
          if (screen.after) await screen.after(page);
          await page.waitForTimeout(300);
        } catch (e) {
          ok = false;
          if (!screen.optional) errors.push('nav: ' + String(e).slice(0, 120));
        }
        const file = `${screen.key}-${vp.name}-${theme}${MODE === 'light' ? '-light' : ''}.png`;
        // A full-page capture stretches the viewport to the document height,
        // which flips a landscape-phone media query (max-height) back to the
        // desktop layout. Landscape gets two viewport shots instead: the top,
        // and scrolled to the bottom (bottom bar, hidden header).
        const landscape = vp.mobile && vp.width > vp.height;
        await page.screenshot({ path: path.join(shots, file), fullPage: !screen.overlay && !landscape });
        if (landscape && !screen.overlay) {
          await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
          await page.waitForTimeout(400);
          await page.screenshot({ path: path.join(shots, file.replace('.png', '-scrolled.png')) });
          await page.evaluate(() => window.scrollTo(0, 0));
        }
        const metrics = await page.evaluate(() => {
          const doc = document.documentElement;
          const overflowX = doc.scrollWidth > window.innerWidth + 1;
          const unlabeled = [...document.querySelectorAll('button, a[role=button]')].filter((b) => {
            const name = (b.getAttribute('aria-label') || b.textContent || '').trim();
            return !name && !b.getAttribute('aria-labelledby');
          }).length;
          const small = [...document.querySelectorAll('button')].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && (r.width < 40 || r.height < 40); }).length;
          const smallText = [...document.querySelectorAll('p, span, li, a, button, h1, h2, h3, h4, div')].filter((el) => { if (!el.textContent?.trim() || el.children.length) return false; const s = parseFloat(getComputedStyle(el).fontSize); return s > 0 && s < 13; }).length;
          return { overflowX, unlabeled, small, smallText, calls: (window.__calls || []).length, actions: (window.__calls || []).reduce((m, a) => { const k = a.split(':')[0]; m[k] = (m[k] || 0) + 1; return m; }, {}) };
        });
        const searches = page.__fetches.filter((u) => u.includes('/resources/search')).length;
        let axe = [];
        if (AXE_SOURCE) {
          try {
            await page.addScriptTag({ content: AXE_SOURCE });
            axe = await page.evaluate(async () => {
              const r = await window.axe.run(document, {
                runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
                resultTypes: ['violations'],
              });
              return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, sample: v.nodes.slice(0, 2).map((n) => n.target.join(' ')) }));
            });
          } catch (e) {
            errors.push('axe: ' + String(e).slice(0, 120));
          }
        }
        const ignore = config.ignoreErrors ?? /qortalRequest|favicon/;
        report.push({ screen: screen.key, viewport: vp.name, theme, ok, errors: errors.filter((e) => !ignore.test(e)), ...metrics, searches, fetches: page.__fetches.length, axe });
        await page.close();
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  try {
    process.kill(-preview.pid, 'SIGTERM');
  } catch {
    preview.kill();
  }
}

// ---- report ----------------------------------------------------------------
const bad = report.filter((r) => r.errors.length || r.overflowX || r.unlabeled);
const lines = [];
lines.push(`${appName}: ${report.length} captures  console errors: ${report.filter((r) => r.errors.length).length}  overflow-x: ${report.filter((r) => r.overflowX).length}  unlabeled buttons: ${report.filter((r) => r.unlabeled).length}`);
for (const r of report.filter((r) => r.theme === themes[0])) {
  lines.push(`${r.screen.padEnd(13)} ${r.viewport.padEnd(8)} ${r.theme.padEnd(6)} searches=${r.searches} fetches=${r.fetches} hub-calls=${r.calls} ${JSON.stringify(r.actions)} small-targets=${r.small} small-text=${r.smallText}${r.overflowX ? ' OVERFLOW-X' : ''}${r.unlabeled ? ' UNLABELED=' + r.unlabeled : ''}`);
}
for (const r of bad) lines.push(`!! ${r.screen} ${r.viewport} ${r.theme}: ${r.errors.join(' | ')}${r.overflowX ? ' OVERFLOW-X' : ''}${r.unlabeled ? ' UNLABELED=' + r.unlabeled : ''}`);
const byRule = new Map();
for (const r of report) for (const v of r.axe || []) {
  const entry = byRule.get(v.id) || { impact: v.impact, screens: new Set(), nodes: 0, sample: v.sample };
  entry.screens.add(`${r.screen}@${r.viewport}/${r.theme}`);
  entry.nodes += v.nodes;
  byRule.set(v.id, entry);
}
lines.push(AXE_SOURCE ? `axe rules violated: ${byRule.size}` : 'axe: skipped');
for (const [id, e] of [...byRule.entries()].sort((a, b) => b[1].nodes - a[1].nodes)) {
  lines.push(`axe ${id} (${e.impact}) nodes=${e.nodes} on ${e.screens.size} captures, e.g. ${[...e.screens][0]} ${JSON.stringify(e.sample)}`);
}
// One report per theme set and mode (nothing in the repo reads a fixed
// report.json, so none is written).
const ALL_THEMES = ['hub30', 'hub20', 'black', 'white'];
const themeTag = themes.length === ALL_THEMES.length && ALL_THEMES.every((t) => themes.includes(t)) ? 'all' : themes.join(',');
const reportFile = path.join(shots, `report-${themeTag}-${MODE}.json`);
writeFileSync(reportFile, JSON.stringify(report, null, 1));
lines.push(`Report: ${path.relative(root, reportFile)}`);
console.log(lines.join('\n'));
// The preview server's pipes would otherwise keep the process alive.
process.exit(bad.length || byRule.size ? 2 : 0);
