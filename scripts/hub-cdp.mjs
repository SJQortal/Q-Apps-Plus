#!/usr/bin/env node
// Talk to a running Qortal Hub over the Chrome DevTools Protocol, for testing
// + apps in Hub Dev Mode from a local session (no Computer use needed).
// Hub must be started with --remote-debugging-port=9222 (docs/HUB-TESTING.md).
//
//   node scripts/hub-cdp.mjs targets                  list Hub windows and app iframes
//   node scripts/hub-cdp.mjs shot [match] [file.png]  screenshot a Hub window
//   node scripts/hub-cdp.mjs eval <match> '<js>'      evaluate JS in a window or app frame
//   node scripts/hub-cdp.mjs console <match> [secs]   print console output and errors for N seconds
//   node scripts/hub-cdp.mjs click <match> <x> <y>    click at viewport (CSS px) coordinates of a window
//   node scripts/hub-cdp.mjs type <match> '<text>'    type text into the focused field
//
// <match> is a substring of a target's URL or title (default: the first page).
// Read-only by intent: never use eval/click to publish, sign, send or buy.

import { writeFileSync } from 'node:fs';

const PORT = process.env.HUB_CDP_PORT || 9222;
const [cmd = 'targets', ...args] = process.argv.slice(2);

async function listTargets() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/list`).catch(() => null);
  if (!res) {
    console.error(`No DevTools endpoint on 127.0.0.1:${PORT}. Start Hub with --remote-debugging-port=${PORT}.`);
    process.exit(1);
  }
  return res.json();
}

function pick(targets, match, types = ['page', 'iframe']) {
  const pool = targets.filter((t) => types.includes(t.type));
  const hit = match ? pool.find((t) => t.url.includes(match) || t.title.includes(match)) : pool[0];
  if (!hit) {
    console.error(`No target matches "${match ?? ''}". Run: node scripts/hub-cdp.mjs targets`);
    process.exit(1);
  }
  return hit;
}

function connect(target) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) {
      listeners.forEach((fn) => fn(msg));
    }
  };
  const ready = new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error('WebSocket connection failed'));
  });
  return {
    ready,
    send: (method, params = {}) =>
      new Promise((resolve, reject) => {
        const n = ++id;
        pending.set(n, { resolve, reject });
        ws.send(JSON.stringify({ id: n, method, params }));
      }),
    on: (fn) => listeners.push(fn),
    close: () => ws.close(),
  };
}

const fmt = (a) => (a.value !== undefined ? JSON.stringify(a.value) : a.description ?? a.type);

const targets = await listTargets();

if (cmd === 'targets') {
  for (const t of targets) console.log(`${t.type.padEnd(8)} ${t.title.slice(0, 40).padEnd(40)} ${t.url.slice(0, 110)}`);
} else if (cmd === 'shot') {
  const [match, file = 'hub-shot.png'] = args;
  const t = pick(targets, match, ['page']);
  const c = connect(t);
  await c.ready;
  const { data } = await c.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(file, Buffer.from(data, 'base64'));
  console.log(`Saved ${file} (${t.title || t.url})`);
  c.close();
} else if (cmd === 'eval') {
  const [match, expr] = args;
  const c = connect(pick(targets, match));
  await c.ready;
  const r = await c.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  console.log(r.exceptionDetails ? `Exception: ${r.exceptionDetails.exception?.description}` : JSON.stringify(r.result.value, null, 2));
  c.close();
} else if (cmd === 'console') {
  const [match, secs = '10'] = args;
  const t = pick(targets, match);
  const c = connect(t);
  await c.ready;
  c.on((m) => {
    if (m.method === 'Runtime.consoleAPICalled') console.log(`[${m.params.type}] ${m.params.args.map(fmt).join(' ')}`);
    if (m.method === 'Runtime.exceptionThrown') console.log(`[exception] ${m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text}`);
    if (m.method === 'Log.entryAdded') console.log(`[${m.params.entry.level}] ${m.params.entry.text} ${m.params.entry.url ?? ''}`);
  });
  await c.send('Runtime.enable');
  await c.send('Log.enable');
  console.log(`Listening to ${t.title || t.url} for ${secs}s…`);
  await new Promise((r) => setTimeout(r, Number(secs) * 1000));
  c.close();
} else if (cmd === 'click') {
  const [match, x, y] = args;
  const c = connect(pick(targets, match, ['page']));
  await c.ready;
  for (const type of ['mousePressed', 'mouseReleased'])
    await c.send('Input.dispatchMouseEvent', { type, x: Number(x), y: Number(y), button: 'left', clickCount: 1 });
  console.log(`Clicked ${x},${y}`);
  c.close();
} else if (cmd === 'type') {
  const [match, text] = args;
  const c = connect(pick(targets, match, ['page']));
  await c.ready;
  await c.send('Input.insertText', { text });
  console.log(`Typed ${JSON.stringify(text)}`);
  c.close();
} else {
  console.error('Commands: targets | shot | eval | console | click | type');
  process.exit(1);
}
