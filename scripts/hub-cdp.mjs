#!/usr/bin/env node
// Talk to a running Qortal Hub over the Chrome DevTools Protocol, for testing
// + apps in Hub Dev Mode from a local session (no Computer use needed).
// Hub must be started with --remote-debugging-port=9222 (docs/HUB-TESTING.md).
// Set HUB_CDP_PORT to use another port (one Hub instance per app being tested).
// Each DevTools command fails after 30 s; set HUB_CDP_TIMEOUT (ms) to change that.
//
//   node scripts/hub-cdp.mjs targets                       list Hub windows and app iframes
//   node scripts/hub-cdp.mjs shot [match] [file] [scale]   screenshot a Hub window (.jpg = small JPEG; scale e.g. 0.5)
//   node scripts/hub-cdp.mjs eval <match> '<js>'           evaluate JS in a window or app frame
//   node scripts/hub-cdp.mjs console <match> [secs]        print console output and errors for N seconds
//   node scripts/hub-cdp.mjs click <match> <x> <y>         click at viewport (CSS px) coordinates of a window
//   node scripts/hub-cdp.mjs type <match> '<text>'         type text into the focused field
//   node scripts/hub-cdp.mjs size <w> <h> [--touch]        hold the app frame at w×h CSS px (plus phone touch) until Ctrl+C
//   node scripts/hub-cdp.mjs tap <selector | x,y>          touch tap in the app frame (frame CSS px, or an element's centre)
//   node scripts/hub-cdp.mjs swipe <x1,y1> <x2,y2>         touch drag in the app frame, e.g. pull-to-refresh
//   node scripts/hub-cdp.mjs requests [secs] [--reload]    log every qortalRequest the app sends, then count them
//   node scripts/hub-cdp.mjs calls [--list]                Core requests the app frame made (/arbitrary, /names, …)
//
// <match> is a substring of a target's URL or title (default: the first page).
// The app-frame commands use the frame whose URL contains --app (default "12393",
// the node's dev proxy). Read-only by intent: never use eval/click/tap to
// publish, sign, send or buy.

import { writeFileSync } from 'node:fs';

const PORT = process.env.HUB_CDP_PORT || 9222;
// Milliseconds to wait for each DevTools command before giving up.
const SEND_TIMEOUT = Number(process.env.HUB_CDP_TIMEOUT) || 30000;
const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const v = argv[i + 1];
  argv.splice(i, v && !v.startsWith('--') ? 2 : 1);
  return v && !v.startsWith('--') ? v : true;
};
const APP = String(flag('app') ?? '12393');
const TOUCH = !!flag('touch');
const RELOAD = !!flag('reload');
const LIST = !!flag('list');
const [cmd = 'targets', ...args] = argv;

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

const hubPage = (targets) => pick(targets, 'Qortal Hub', ['page']);
const appFrame = (targets) => pick(targets, APP, ['iframe', 'page']);

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
    const timer = setTimeout(() => reject(new Error(`WebSocket did not open within ${SEND_TIMEOUT} ms`)), SEND_TIMEOUT);
    ws.onopen = () => (clearTimeout(timer), resolve());
    ws.onerror = () => (clearTimeout(timer), reject(new Error('WebSocket connection failed')));
  });
  // A closed socket fails whatever is still waiting instead of leaving it hanging.
  ws.addEventListener('close', () => {
    for (const { reject } of pending.values()) reject(new Error('DevTools connection closed'));
    pending.clear();
  });
  return {
    ready,
    closed: new Promise((resolve) => ws.addEventListener('close', resolve)),
    // Every command errors out after SEND_TIMEOUT ms: some (captureScreenshot
    // while Hub's window is behind others) otherwise never answer.
    send: (method, params = {}) =>
      new Promise((resolve, reject) => {
        const n = ++id;
        const timer = setTimeout(() => {
          pending.delete(n);
          reject(new Error(`${method} got no answer within ${SEND_TIMEOUT} ms (set HUB_CDP_TIMEOUT to wait longer)`));
        }, SEND_TIMEOUT);
        pending.set(n, {
          resolve: (v) => (clearTimeout(timer), resolve(v)),
          reject: (e) => (clearTimeout(timer), reject(e)),
        });
        ws.send(JSON.stringify({ id: n, method, params }));
      }),
    on: (fn) => listeners.push(fn),
    close: () => ws.close(),
  };
}

async function evaluate(c, expression) {
  const r = await c.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
}

// Where a frame's viewport sits in the Hub window, in CSS px. Hub nests the
// app's iframe in an about:srcdoc iframe below its top bar, so the offset adds
// up every iframe element from the frame's owner to the top, then repeats for
// each out-of-process parent target.
const OWNER_OFFSET = `function () {
  let x = 0, y = 0;
  for (let el = this; el; el = el.ownerDocument.defaultView.frameElement) {
    const b = el.getBoundingClientRect();
    const s = el.ownerDocument.defaultView.getComputedStyle(el);
    x += b.x + el.clientLeft + parseFloat(s.paddingLeft);
    y += b.y + el.clientTop + parseFloat(s.paddingTop);
  }
  return [x, y];
}`;

async function frameOffset(targets, frame) {
  let [x, y] = [0, 0];
  for (let t = frame; t.parentId; ) {
    const parent = targets.find((p) => p.id === t.parentId);
    if (!parent) break;
    const c = connect(parent);
    await c.ready;
    const { backendNodeId } = await c.send('DOM.getFrameOwner', { frameId: t.id });
    const { object } = await c.send('DOM.resolveNode', { backendNodeId });
    const { result } = await c.send('Runtime.callFunctionOn', { objectId: object.objectId, functionDeclaration: OWNER_OFFSET, returnByValue: true });
    c.close();
    x += result.value[0];
    y += result.value[1];
    t = parent;
  }
  return [x, y];
}

const PHONE_MEDIA = [
  { name: 'hover', value: 'none' },
  { name: 'any-hover', value: 'none' },
  { name: 'pointer', value: 'coarse' },
  { name: 'any-pointer', value: 'coarse' },
];

const fmt = (a) => (a.value !== undefined ? JSON.stringify(a.value) : a.description ?? a.type);
const parsePoint = (s) => s.split(',').map(Number);

// Logs each request q-apps.js sends (it routes all of them through
// window.executeQortalRequestImmediate). Long strings are cut so payloads
// such as file data stay out of the log.
const REQUEST_LOGGER = `(() => {
  try { performance.setResourceTimingBufferSize(5000); } catch (e) {}
  const wrap = () => {
    const f = window.executeQortalRequestImmediate;
    if (!f || f.__qplusLog) return !!f;
    const g = function (req, ...rest) {
      try {
        const brief = JSON.stringify(req, (k, v) => (typeof v === 'string' && v.length > 80 ? v.slice(0, 80) + '…' : v));
        console.debug('[qplus-request]', req && req.action, brief.slice(0, 300));
      } catch (e) {}
      return f.call(this, req, ...rest);
    };
    g.__qplusLog = true;
    window.executeQortalRequestImmediate = g;
    return true;
  };
  if (!wrap()) { document.addEventListener('readystatechange', wrap); setTimeout(wrap, 0); }
})();`;

const targets = await listTargets();

if (cmd === 'targets') {
  for (const t of targets) console.log(`${t.type.padEnd(8)} ${t.title.slice(0, 40).padEnd(40)} ${t.url.slice(0, 110)}`);
} else if (cmd === 'shot') {
  const [match, file = 'hub-shot.png', scale] = args;
  const t = pick(targets, match, ['page']);
  const c = connect(t);
  await c.ready;
  // Chromium never answers captureScreenshot while Hub's window is behind
  // other windows, so raise it first.
  await c.send('Page.enable');
  await c.send('Page.bringToFront');
  const jpeg = /\.jpe?g$/i.test(file);
  const params = jpeg ? { format: 'jpeg', quality: 70 } : { format: 'png' };
  if (scale) {
    // Clip units include Hub's page zoom, so the visible area is the CSS
    // viewport times the zoom.
    const { cssVisualViewport: v } = await c.send('Page.getLayoutMetrics');
    const zoom = v.zoom || 1;
    params.clip = { x: 0, y: 0, width: v.clientWidth * zoom, height: v.clientHeight * zoom, scale: Number(scale) };
  }
  const { data } = await c.send('Page.captureScreenshot', params);
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
} else if (cmd === 'size') {
  // Electron has no Browser.setWindowBounds, so the size is emulated on the Hub
  // page and held until Ctrl+C. Hub zooms its page and re-applies the zoom after
  // a resize, so the page size is corrected until the app frame has the size
  // asked for. mobile:false keeps the zoom stable; touch is emulated in the app
  // frame instead, and re-applied because any other session that detaches from
  // the frame (every eval) resets it.
  const [w, h] = args.map(Number);
  if (!w || !h) {
    console.error('Usage: hub-cdp.mjs size <width> <height> [--touch]');
    process.exit(1);
  }
  const page = connect(hubPage(targets));
  await page.ready;
  let pw = w;
  let ph = h;
  let got = { w: 0, h: 0 };
  for (let i = 0; i < 6; i++) {
    await page.send('Emulation.setDeviceMetricsOverride', { width: Math.round(pw), height: Math.round(ph), deviceScaleFactor: 0, mobile: false });
    await new Promise((r) => setTimeout(r, 500));
    const frame = connect(appFrame(await listTargets()));
    await frame.ready;
    got = await evaluate(frame, '({ w: innerWidth, h: innerHeight })');
    frame.close();
    if (Math.abs(got.w - w) <= 1 && Math.abs(got.h - h) <= 2) break;
    pw += (w - got.w) * (pw / Math.max(got.w, 1));
    ph += (h - got.h) * (ph / Math.max(got.h, 1));
  }
  console.log(`App frame ${got.w}×${got.h} (Hub page held at ${Math.round(pw)}×${Math.round(ph)})${TOUCH ? ', touch on' : ''}. Ctrl+C to release.`);
  let frame = null;
  const applyTouch = async () => {
    try {
      if (!frame) {
        frame = connect(appFrame(await listTargets()));
        await frame.ready;
        frame.closed.then(() => (frame = null));
      }
      await frame.send('Emulation.setEmulatedMedia', { features: PHONE_MEDIA });
      await frame.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    } catch {
      frame = null;
    }
  };
  if (TOUCH) {
    await applyTouch();
    setInterval(applyTouch, 2000);
  }
  const release = async () => {
    await page.send('Emulation.clearDeviceMetricsOverride').catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', release);
  process.on('SIGTERM', release);
  setInterval(() => {}, 1 << 30);
} else if (cmd === 'tap' || cmd === 'swipe') {
  // Touch input goes to the app frame's own target, but Chromium reads its
  // coordinates in the Hub window's viewport, so frame CSS px are moved by
  // where the frame sits in Hub (about 124 px down, below Hub's top bar).
  // (Sent to the page target, even window coordinates land too high.)
  const target = appFrame(targets);
  const frame = connect(target);
  await frame.ready;
  let points;
  if (cmd === 'tap' && !/^[\d.]+,[\d.]+$/.test(args[0] ?? '')) {
    const sel = JSON.stringify(args[0] ?? '');
    const r = await evaluate(frame, `(() => { const el = document.querySelector(${sel}); if (!el) return null; el.scrollIntoView({ block: 'center' }); const b = el.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; })()`);
    if (!r) {
      console.error(`No element matches ${sel} in the app frame.`);
      process.exit(1);
    }
    points = [r];
  } else {
    points = args.slice(0, cmd === 'tap' ? 1 : 2).map(parsePoint);
  }
  // Measured after the selector's scrollIntoView, in case that scrolled Hub too.
  const [ox, oy] = await frameOffset(targets, target);
  const toPoint = ([x, y]) => ({ x: x + ox, y: y + oy });
  await frame.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const touch = (type, pts) => frame.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(toPoint) });
  const at = `in the app frame (frame at ${Math.round(ox)},${Math.round(oy)} in Hub)`;
  if (cmd === 'tap') {
    await touch('touchStart', points);
    await touch('touchEnd', []);
    console.log(`Tapped ${points[0].map(Math.round).join(',')} ${at}`);
  } else {
    const [[x1, y1], [x2, y2]] = points;
    await touch('touchStart', [[x1, y1]]);
    for (let i = 1; i <= 12; i++) {
      await touch('touchMove', [[x1 + ((x2 - x1) * i) / 12, y1 + ((y2 - y1) * i) / 12]]);
      await new Promise((r) => setTimeout(r, 25));
    }
    await touch('touchEnd', []);
    console.log(`Swiped ${x1},${y1} → ${x2},${y2} ${at}`);
  }
  frame.close();
} else if (cmd === 'requests') {
  // Installs the logger in the current document and in every document the
  // frame loads next. Dev Mode only injects q-apps.js at "/", so --reload
  // reloads at "/" with Hub's query string; navigate with the app's own UI.
  const [secs = '20'] = args;
  const t = appFrame(targets);
  const c = connect(t);
  await c.ready;
  const seen = [];
  const t0 = Date.now();
  c.on((m) => {
    if (m.method !== 'Runtime.consoleAPICalled') return;
    const [tag, action, brief] = m.params.args.map((a) => a.value);
    if (tag !== '[qplus-request]') return;
    seen.push(action);
    console.log(`+${((Date.now() - t0) / 1000).toFixed(1)}s ${String(action).padEnd(32)} ${brief ?? ''}`);
  });
  await c.send('Runtime.enable');
  await c.send('Page.enable');
  await c.send('Page.addScriptToEvaluateOnNewDocument', { source: REQUEST_LOGGER });
  await evaluate(c, REQUEST_LOGGER);
  if (RELOAD) await evaluate(c, `location.href = location.origin + '/' + location.search`);
  console.log(`Logging qortalRequest in ${t.url.slice(0, 60)} for ${secs}s…`);
  await new Promise((r) => setTimeout(r, Number(secs) * 1000));
  const counts = seen.reduce((m, a) => ((m[a] = (m[a] || 0) + 1), m), {});
  console.log(`\n${seen.length} requests: ${JSON.stringify(counts)}`);
  c.close();
} else if (cmd === 'calls') {
  // The app frame's own fetches to the node (search, resource bodies, avatars,
  // names), grouped. Resource timings start at the frame's last load.
  const c = connect(appFrame(targets));
  await c.ready;
  const urls = await evaluate(
    c,
    `performance.getEntriesByType('resource').map((e) => e.name)
      .filter((n) => /\\/(arbitrary|names|lists|addresses|transactions|blocks|crosschain|chat|groups)\\b/.test(n))
      .map((n) => n.replace(/^https?:\\/\\/[^/]+/, ''))`
  );
  const group = (u) => {
    const p = u.split('?')[0].split('/').filter(Boolean);
    if (p[0] === 'arbitrary' && p[1] === 'resources') return `/arbitrary/resources/${p[2] ?? ''}`;
    if (p[0] === 'arbitrary' && p[1] === 'resource') return `/arbitrary/resource/${p[2] ?? ''}`;
    if (p[0] === 'arbitrary') return `/arbitrary/${p[1]}/…`;
    return `/${p[0]}/${p[1] ?? ''}`;
  };
  const counts = urls.reduce((m, u) => ((m[group(u)] = (m[group(u)] || 0) + 1), m), {});
  for (const [k, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(4)}  ${k}`);
  console.log(`${String(urls.length).padStart(4)}  total`);
  if (LIST) urls.forEach((u) => console.log('      ' + u.slice(0, 160)));
  c.close();
} else {
  console.error('Commands: targets | shot | eval | console | click | type | size | tap | swipe | requests | calls');
  process.exit(1);
}
