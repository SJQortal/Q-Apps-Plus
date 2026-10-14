#!/usr/bin/env node
/**
 * Testnet scenarios: the app's real write flows against the private testnet.
 *
 *   npm run test:testnet                    every scenario
 *   npm run test:testnet -- --only join,kick
 *   npm run test:testnet -- --list
 *
 * Needs the testnet running (testnet/testnet.mjs start) and its world
 * (testnet/setup.mjs). Starts the dev server with vite.testnet.config.ts on
 * 127.0.0.1:5176 and a Chromium (QPLUS_CHROMIUM, or Playwright's own); each
 * test account gets its own browser context, signed in through the test
 * signer. Scenarios call the app's own flows in the page (window.__qmpTestnet)
 * or click through its screens, then check the outcome against what Core
 * did. Results (block heights, outcomes) are printed and saved in
 * ~/.qmp-testnet/results/.
 *
 * `npm test` never runs these: they take minutes of real 60-second blocks.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { TESTNET_HOME, assertTestnet, getJson, height, sleep, waitForConfirmed, waitForHeight } from './lib/node.mjs';
import { account, fund, freshAccounts, readWorld } from './lib/world.mjs';
import { hubRequest } from './lib/hub.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, '..');
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const PORT = Number(opt('port') ?? process.env.QMP_TESTNET_PORT ?? 5176);
const BASE = `http://127.0.0.1:${PORT}`;

async function loadScenarios() {
  const dir = path.join(here, 'scenarios');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort();
  const all = [];
  for (const f of files) {
    const mod = await import(pathToFileURL(path.join(dir, f)).href);
    for (const s of [].concat(mod.default ?? [])) all.push({ ...s, file: f });
  }
  return all;
}

class Failure extends Error {}

function makeContext(browser, scenario, results) {
  const pages = [];
  const record = (key, value) => {
    results.records[key] = value;
    console.log(`  [${scenario.name}] ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
  };
  const ctx = {
    record,
    log: (msg) => console.log(`  [${scenario.name}] ${msg}`),
    expect(condition, message, detail) {
      results.checks.push({ ok: Boolean(condition), message, detail });
      if (!condition) throw new Failure(`${message}${detail !== undefined ? ` (${JSON.stringify(detail)})` : ''}`);
      console.log(`  [${scenario.name}] ✓ ${message}`);
    },
    check(condition, message, detail) {
      results.checks.push({ ok: Boolean(condition), message, detail, soft: true });
      console.log(`  [${scenario.name}] ${condition ? '✓' : '✗'} ${message}${condition ? '' : ` ${JSON.stringify(detail ?? '')}`}`);
      return Boolean(condition);
    },
    account,
    group: (key) => {
      const g = readWorld().groups[key];
      if (!g) throw new Error(`No group "${key}": run testnet/setup.mjs`);
      return g;
    },
    height,
    waitForHeight,
    waitForConfirmed,
    sleep,
    get: getJson,
    tx: (signature) => getJson(`/transactions/signature/${encodeURIComponent(signature)}`),
    async waitFor(fn, { label = 'condition', timeoutMs = 15 * 60_000, everyMs = 3_000 } = {}) {
      const start = Date.now();
      for (;;) {
        const value = await fn();
        if (value) return value;
        if (Date.now() - start > timeoutMs) throw new Failure(`Timed out waiting for ${label}`);
        await sleep(everyMs);
      }
    },
    /** Fresh, funded accounts for this scenario. */
    async fresh(prefix, count = 1, amount = '5') {
      const labels = freshAccounts(prefix, count);
      await fund(labels, amount);
      return labels;
    },
    /** Answer as Hub would for `as`, outside the app (setup steps). */
    hub: (as, request) => hubRequest(account(as), request),
    /** Queue Hub behaviours for `as`'s next dialog in `extra.group` (default: the scenario's): decline, timeout, decodeError. */
    async behaviour(as, mode, { group = scenario.group, ...extra } = {}) {
      await fetch(`${BASE}/qmp-testnet-control/behaviour`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ as, group, mode, ...extra }),
      });
    },
    async signerLog(since) {
      return (await fetch(`${BASE}/qmp-testnet-control/log?since=${since}`)).json();
    },
    /** The app in a browser, signed in as `as`, using group `group`. */
    async open(as, { group = scenario.group ?? 'main', route = '/', viewport, reducedMotion } = {}) {
      const context = await browser.newContext({
        viewport: viewport ?? { width: 1280, height: 900 },
        ...(reducedMotion ? { reducedMotion } : {}),
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      const sep = route.includes('?') ? '&' : '?';
      await page.goto(`${BASE}${route}${sep}as=${encodeURIComponent(as)}&group=${encodeURIComponent(group)}`);
      await page.waitForFunction(() => window.__qmpTestnet?.ready === true, null, { timeout: 60_000 });
      const me = account(as);
      const signer = { address: me.address, publicKey: me.publicKey, name: readWorld().names[as] ?? null };
      const wrapper = {
        page,
        as,
        signer,
        errors,
        /** Call one of the app's write flows (src/writes/flows.ts) as this account. */
        flow: (name, ...flowArgs) =>
          page.evaluate(
            async ({ name: n, signer: s, flowArgs: a }) => {
              const flows = window.__qmpTestnet.flows;
              return flows[n](s, ...a);
            },
            { name, signer, flowArgs }
          ),
        /** Run code in the page with the app's modules (window.__qmpTestnet). */
        evaluate: (fn, arg) => page.evaluate(fn, arg),
        close: () => context.close(),
      };
      pages.push(wrapper);
      return wrapper;
    },
    async closeAll() {
      for (const p of pages) await p.close().catch(() => {});
    },
  };
  return ctx;
}

async function main() {
  const scenarios = await loadScenarios();
  if (args.includes('--list')) {
    for (const s of scenarios) console.log(`${s.name.padEnd(24)} ${s.title}`);
    return;
  }
  const only = (opt('only') ?? '').split(',').filter(Boolean);
  const chosen = only.length ? scenarios.filter((s) => only.includes(s.name)) : scenarios;
  if (!chosen.length) throw new Error('No scenarios chosen');

  await assertTestnet({ fresh: true });
  if (!Object.keys(readWorld().groups).length) throw new Error('No test world yet: run node testnet/setup.mjs');

  const { createServer } = await import('vite');
  const server = await createServer({
    root: appDir,
    configFile: path.join(appDir, 'vite.testnet.config.ts'),
    logLevel: 'warn',
    server: { port: PORT },
  });
  await server.listen();
  const { chromium } = await import('playwright-core');
  const executablePath =
    process.env.QPLUS_CHROMIUM ?? path.join(os.homedir(), '.cache/ms-playwright/chromium-1243/chrome-linux64/chrome');
  const browser = await chromium.launch({ executablePath, headless: true });

  const startHeight = await height();
  console.log(`Testnet at block ${startHeight}; ${chosen.length} scenario(s).`);
  const all = [];
  const concurrency = Number(opt('parallel') ?? 6);
  const queue = [...chosen];
  const runOne = async (scenario) => {
    const results = { name: scenario.name, title: scenario.title, records: {}, checks: [], startHeight: await height() };
    const ctx = makeContext(browser, scenario, results);
    const started = Date.now();
    console.log(`▶ ${scenario.name}: ${scenario.title}`);
    try {
      await scenario.run(ctx);
      results.status = results.checks.some((c) => !c.ok) ? 'passed with notes' : 'passed';
    } catch (error) {
      results.status = 'failed';
      results.error = error instanceof Failure ? error.message : String(error?.stack ?? error);
    } finally {
      await ctx.closeAll();
    }
    results.endHeight = await height();
    results.minutes = Math.round((Date.now() - started) / 6000) / 10;
    console.log(`${results.status === 'failed' ? '✗' : '✓'} ${scenario.name}: ${results.status}${results.error ? ` — ${results.error}` : ''}`);
    all.push(results);
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (queue.length) await runOne(queue.shift());
    })
  );
  await browser.close();
  await server.close();

  const dir = path.join(TESTNET_HOME, 'results');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify({ startHeight, endHeight: await height(), scenarios: all }, null, 1));
  console.log(`\n${all.filter((r) => r.status !== 'failed').length}/${all.length} passed. Results: ${file}`);
  if (all.some((r) => r.status === 'failed')) process.exitCode = 1;
}

await main();
