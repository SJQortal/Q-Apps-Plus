/**
 * Visual check harness (DESIGN.md → Mobile → Check). Serves the production
 * build with `vite preview`, mocks qortalRequest and the Core endpoints the
 * app reads, and screenshots every screen at the required sizes in all four
 * themes. It also reports console errors, sideways overflow, icon buttons
 * without an accessible name, and how many Qortal calls each screen made.
 *
 *   npm run build && node e2e/screens.mjs [--only home,share] [--themes hub30]
 *
 * Nothing here publishes or touches a node: every call is answered locally.
 * Screenshots land in e2e/shots/ (git-ignored).
 */
import { execSync, spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.resolve(here, "..");
const shots = path.join(here, "shots");
mkdirSync(shots, { recursive: true });

const globalRoot = execSync("npm root -g").toString().trim();
const { chromium } = await import(path.join(globalRoot, "playwright", "index.mjs"));

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const onlyScreens = opt("only", "").split(",").filter(Boolean);
const themes = opt("themes", "hub30,hub20,black,white").split(",");
const PORT = Number(opt("port", "4173"));

const VIEWPORTS = [
  { name: "360x740", width: 360, height: 740, mobile: true },
  { name: "390x844", width: 390, height: 844, mobile: true },
  { name: "844x390", width: 844, height: 390, mobile: true },
  { name: "700", width: 700, height: 900, mobile: false },
  { name: "1280", width: 1280, height: 800, mobile: false },
];

// ---- fixtures -----------------------------------------------------------
const NAME = "Tester";
const ID = (n) => `qshare_file_share-number-${n}_id00${n}_metadata`;
const COUNT = 24;
const now = Date.now();
const rows = Array.from({ length: COUNT }, (_, i) => ({
  name: i % 3 === 0 ? NAME : i % 3 === 1 ? "Alice Wonder" : "bob+builder",
  service: "DOCUMENT",
  identifier: ID(i + 1),
  created: now - i * 3600_000 * 7,
  updated: now - i * 3600_000 * 7,
  size: 1200,
  metadata: {
    title: `Share number ${i + 1}: ${["Photos from the coast", "Firmware build", "Podcast episode", "Album art", "Long report with an unusually long title that wraps on phones"][i % 5]}`,
    description: `**cat:${[6, 1, 3, 5, 6][i % 5]}**A description`,
  },
}));
const body = (i) => ({
  title: rows[i - 1].metadata.title,
  version: 1,
  fullDescription: "Shared files. Lists work: one, two.",
  htmlDescription:
    "<h2>About this share</h2><p>Some <strong>formatted</strong> text with a <a href=\"qortal://APP/Q-Tube\">link</a>.</p><ul><li>one</li><li>two</li></ul><pre class=\"ql-syntax\" spellcheck=\"false\">const x = 1;\n</pre>",
  commentsId: `qshare_file__cm_id00${i}`,
  category: String([6, 1, 3, 5, 6][(i - 1) % 5]),
  files: [
    { filename: "photo-of-the-coast.png", identifier: `qshare_file_p_${i}`, name: rows[i - 1].name, service: "FILE", mimetype: "image/png", size: 245_000 },
    { filename: "notes.txt", identifier: `qshare_file_t_${i}`, name: rows[i - 1].name, service: "FILE", mimetype: "text/plain", size: 2_048 },
    { filename: "manual-with-a-long-file-name-for-wrapping.pdf", identifier: `qshare_file_d_${i}`, name: rows[i - 1].name, service: "FILE", mimetype: "application/pdf", size: 3_400_000 },
    { filename: "song.mp3", identifier: `qshare_file_a_${i}`, name: rows[i - 1].name, service: "FILE", mimetype: "audio/mpeg", size: 5_100_000 },
  ],
});
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAQklEQVR42u3OMQEAAAgDINc/9Mzg14MGLUmHCgUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFbzwB2GwADvYAAAAASUVORK5CYII=",
  "base64"
);

function qortalMockSource() {
  return `
    window._qdnTheme = window._qdnTheme || 'dark';
    window._qdnName = 'Q-Share+';
    window.__calls = [];
    const bodies = ${JSON.stringify(Object.fromEntries(rows.map((r, i) => [r.identifier, body(i + 1)])))};
    const answer = async (p) => {
      window.__calls.push(p.action + (p.identifier ? ':' + p.identifier : ''));
      switch (p.action) {
        case 'GET_USER_ACCOUNT': return { address: 'QTesterAddress', publicKey: 'pk' };
        case 'GET_ACCOUNT_NAMES': return [{ name: '${NAME}', owner: 'QTesterAddress' }, { name: 'Second Name', owner: 'QTesterAddress' }];
        case 'GET_PRIMARY_NAME': return '${NAME}';
        case 'GET_QDN_RESOURCE_URL': return '/arbitrary/' + p.service + '/' + p.name + '/' + p.identifier;
        case 'FETCH_QDN_RESOURCE': return bodies[p.identifier] || (p.identifier && p.identifier.startsWith('qshare_collection_') ? { version: 1, title: 'Holiday pack', description: 'Photos and notes', items: [{ name: '${NAME}', identifier: '${ID(1)}' }, { name: 'Alice Wonder', identifier: '${ID(2)}' }], created: ${now}, updated: ${now} } : null);
        case 'GET_LIST_ITEMS': return p.list_name === 'followedNames' ? ['Alice Wonder'] : ['spammer'];
        case 'LIST_QDN_RESOURCES': return [{ size: 1000 }];
        case 'GET_QDN_RESOURCE_STATUS': return { status: 'READY', percentLoaded: 100, localChunkCount: 1, totalChunkCount: 1 };
        case 'GET_QDN_RESOURCE_PROPERTIES': return { filename: 'file.bin', mimeType: 'application/octet-stream' };
        case 'ADD_LIST_ITEMS': case 'DELETE_LIST_ITEM': return true;
        case 'PUBLISH_QDN_RESOURCE': case 'PUBLISH_MULTIPLE_QDN_RESOURCES': throw { error: 'User declined request' };
        default: return null;
      }
    };
    window.qortalRequest = answer;
    window.qortalRequestWithTimeout = (p) => answer(p);
  `;
}

async function routeCore(page) {
  await page.route("**/arbitrary/**", async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname;
    const sp = url.searchParams;
    page.__fetches.push(p + url.search);
    if (p.endsWith("/resources/search")) {
      let list = rows;
      const ident = sp.get("identifier") || "";
      const name = sp.get("name");
      const query = sp.get("query") || "";
      if (ident.startsWith("qshare_collection_")) {
        list = [
          { name: NAME, service: "DOCUMENT", identifier: "qshare_collection_holiday-pack_ab12cd", created: now, updated: now, metadata: { title: "Holiday pack", description: "Photos and notes" } },
          { name: "Alice Wonder", service: "DOCUMENT", identifier: "qshare_collection_tools_ef34gh", created: now - 86400000, updated: now - 86400000, metadata: { title: "Tools", description: "" } },
        ];
      } else if (sp.get("service") === "BLOG_COMMENT") {
        const base = query.includes("_base_");
        list = base
          ? [1, 2].map((n) => ({ name: n === 1 ? "Alice Wonder" : NAME, service: "BLOG_COMMENT", identifier: `qcomment_v1_qshare_${"id001_metadata".slice(-12)}_base_c${n}0000`, created: now - n * 3600_000 }))
          : [{ name: "bob+builder", service: "BLOG_COMMENT", identifier: `qcomment_v1_qshare_${"id001_metadata".slice(-12)}_reply_c10000_r1`, created: now - 1800_000 }];
      } else if (ident.startsWith("qshare_file_") && ident.endsWith("_metadata")) {
        list = rows.filter((r) => r.identifier === ident);
      }
      if (name) list = list.filter((r) => r.name === name);
      if (sp.get("followedonly") === "true") list = list.filter((r) => r.name === "Alice Wonder");
      const offset = Number(sp.get("offset") || 0);
      const limit = Number(sp.get("limit") || 20);
      if (sp.get("reverse") === "false") list = [...list].reverse();
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(list.slice(offset, offset + limit)) });
    }
    if (p.includes("/THUMBNAIL/")) return route.fulfill({ status: 200, contentType: "image/png", body: PNG });
    if (p.includes("/BLOG_COMMENT/")) return route.fulfill({ status: 200, contentType: "text/plain", body: "A comment with enough words to wrap on a phone screen, and a qortal://APP/Q-Tube link." });
    if (p.includes("/FILE/")) {
      if (p.includes("_p_")) return route.fulfill({ status: 200, contentType: "image/png", body: PNG });
      if (p.includes("_t_")) return route.fulfill({ status: 200, contentType: "text/plain", body: "Line one of the notes.\nLine two.\n" });
      return route.fulfill({ status: 200, contentType: "application/octet-stream", body: Buffer.alloc(16) });
    }
    return route.fulfill({ status: 404, body: "" });
  });
}

const SCREENS = [
  { key: "home", path: "/", after: async (page) => page.waitForSelector("li, [role=status]", { timeout: 8000 }).catch(() => {}) },
  { key: "home-filters", path: "/", mobileOnly: true, after: async (page) => { await page.getByRole("button", { name: /^Filters/ }).first().click({ timeout: 2500 }); await page.waitForTimeout(400); } },
  { key: "share", path: `/share/${NAME}/${ID(1)}`, after: async (page) => page.waitForSelector("text=Share number 1", { timeout: 8000 }).catch(() => {}) },
  { key: "profile", path: `/channel/${encodeURIComponent("Alice Wonder")}`, after: async (page) => page.waitForSelector("li, [role=status]", { timeout: 8000 }).catch(() => {}) },
  { key: "settings", path: "/settings" },
  { key: "collections", path: "/collections", optional: true },
  { key: "collection", path: `/collection/${NAME}/qshare_collection_holiday-pack_ab12cd`, optional: true },
  { key: "publish", path: "/", after: async (page) => { await page.getByRole("button", { name: /share files/i }).first().click({ timeout: 2500 }); await page.waitForTimeout(500); } },
  { key: "account-menu", path: "/", after: async (page) => { await page.getByRole("button", { name: /account menu/i }).first().click({ timeout: 2500 }); await page.waitForTimeout(400); } },
];

function startPreview() {
  const child = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort", "--host", "127.0.0.1"], { cwd: app, stdio: ["ignore", "pipe", "pipe"] });
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("vite preview did not start")), 20000);
    child.stdout.on("data", (d) => { if (String(d).includes("http")) { clearTimeout(t); resolve(child); } });
    child.stderr.on("data", (d) => process.stderr.write(d));
    child.on("exit", (c) => reject(new Error(`vite preview exited ${c}`)));
  });
}

const preview = await startPreview();
const browser = await chromium.launch({ headless: true });
const report = [];
try {
  for (const theme of themes) {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 1,
        isMobile: vp.mobile,
        hasTouch: vp.mobile,
        reducedMotion: "reduce",
      });
      await context.addInitScript(`try { localStorage.setItem('qshareplus-ui-theme', JSON.stringify('${theme}')); } catch (e) {}`);
      await context.addInitScript(qortalMockSource());
      for (const screen of SCREENS) {
        if (onlyScreens.length && !onlyScreens.includes(screen.key)) continue;
        if (screen.mobileOnly && !vp.mobile) continue;
        const page = await context.newPage();
        page.__fetches = [];
        const errors = [];
        page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
        page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 160)));
        await routeCore(page);
        let ok = true;
        try {
          await page.goto(`http://127.0.0.1:${PORT}${screen.path}?theme=dark`, { waitUntil: "load", timeout: 12000 });
          if (screen.after) await screen.after(page);
          await page.waitForTimeout(300);
        } catch (e) {
          ok = false;
          if (!screen.optional) errors.push("nav: " + String(e).slice(0, 120));
        }
        const file = `${screen.key}-${vp.name}-${theme}.png`;
        await page.screenshot({ path: path.join(shots, file), fullPage: !screen.key.includes("filters") && !screen.key.includes("publish") && !screen.key.includes("menu") });
        const metrics = await page.evaluate(() => {
          const doc = document.documentElement;
          const overflowX = doc.scrollWidth > window.innerWidth + 1;
          const unlabeled = [...document.querySelectorAll("button, a[role=button]")].filter((b) => {
            const name = (b.getAttribute("aria-label") || b.textContent || "").trim();
            const labelled = b.getAttribute("aria-labelledby");
            return !name && !labelled;
          }).length;
          const small = [...document.querySelectorAll("button")].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && (r.width < 40 || r.height < 40); }).length;
          const smallText = [...document.querySelectorAll("p, span, li, a, button, h1, h2, h3, h4, div")].filter((el) => { if (!el.textContent?.trim() || el.children.length) return false; const s = parseFloat(getComputedStyle(el).fontSize); return s > 0 && s < 13; }).length;
          return { overflowX, unlabeled, small, smallText, calls: (window.__calls || []).length, actions: (window.__calls || []).reduce((m, a) => { const k = a.split(":")[0]; m[k] = (m[k] || 0) + 1; return m; }, {}) };
        });
        const searches = page.__fetches.filter((u) => u.includes("/resources/search")).length;
        report.push({ screen: screen.key, viewport: vp.name, theme, ok, errors: errors.filter((e) => !/qortalRequest|favicon/.test(e)), ...metrics, searches });
        await page.close();
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  preview.kill();
}

const bad = report.filter((r) => r.errors.length || r.overflowX || r.unlabeled);
const lines = [];
lines.push(`screens: ${report.length}  with console errors: ${report.filter((r) => r.errors.length).length}  overflow-x: ${report.filter((r) => r.overflowX).length}  unlabeled buttons: ${report.filter((r) => r.unlabeled).length}`);
for (const r of report.filter((r) => r.theme === themes[0])) {
  lines.push(`${r.screen.padEnd(13)} ${r.viewport.padEnd(8)} ${r.theme.padEnd(6)} searches=${r.searches} hub-calls=${r.calls} ${JSON.stringify(r.actions)} small-targets=${r.small} small-text=${r.smallText}${r.overflowX ? " OVERFLOW-X" : ""}${r.unlabeled ? " UNLABELED=" + r.unlabeled : ""}`);
}
for (const r of bad) lines.push(`!! ${r.screen} ${r.viewport} ${r.theme}: ${r.errors.join(" | ")}${r.overflowX ? " OVERFLOW-X" : ""}${r.unlabeled ? " UNLABELED=" + r.unlabeled : ""}`);
writeFileSync(path.join(shots, "report.json"), JSON.stringify(report, null, 1));
console.log(lines.join("\n"));
