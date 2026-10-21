/**
 * Q-Share+ for the shared screenshot check (scripts/screens.mjs):
 *
 *   scripts/screens.mjs Q-Share+ [--only home,share] [--themes hub30] [--mode light]
 *
 * Fixtures: 24 shares from three publishers (one with a "+" in its name), a
 * four-file share (image, text, PDF, audio), a comment thread with a reply and
 * two collections. Publishing is always declined, so nothing can be sent.
 */
const NAME = 'Tester';
const ID = (n) => `qshare_file_share-number-${n}_id00${n}_metadata`;
const COUNT = 24;
const now = Date.now();
const rows = Array.from({ length: COUNT }, (_, i) => ({
  name: i % 3 === 0 ? NAME : i % 3 === 1 ? 'Alice Wonder' : 'bob+builder',
  service: 'DOCUMENT',
  identifier: ID(i + 1),
  created: now - i * 3600_000 * 7,
  updated: now - i * 3600_000 * 7,
  size: 1200,
  metadata: {
    title: `Share number ${i + 1}: ${['Photos from the coast', 'Firmware build', 'Podcast episode', 'Album art', 'Long report with an unusually long title that wraps on phones'][i % 5]}`,
    description: `**cat:${[6, 1, 3, 5, 6][i % 5]}**A description`,
  },
}));
const body = (i) => ({
  title: rows[i - 1].metadata.title,
  version: 1,
  fullDescription: 'Shared files. Lists work: one, two.',
  htmlDescription:
    '<h2>About this share</h2><p>Some <strong>formatted</strong> text with a <a href="qortal://APP/Q-Tube">link</a>.</p><ul><li>one</li><li>two</li></ul><pre class="ql-syntax" spellcheck="false">const x = 1;\n</pre>',
  commentsId: `qshare_file__cm_id00${i}`,
  category: String([6, 1, 3, 5, 6][(i - 1) % 5]),
  files: [
    { filename: 'photo-of-the-coast.png', identifier: `qshare_file_p_${i}`, name: rows[i - 1].name, service: 'FILE', mimetype: 'image/png', size: 245_000 },
    { filename: 'notes.txt', identifier: `qshare_file_t_${i}`, name: rows[i - 1].name, service: 'FILE', mimetype: 'text/plain', size: 2_048 },
    { filename: 'manual-with-a-long-file-name-for-wrapping.pdf', identifier: `qshare_file_d_${i}`, name: rows[i - 1].name, service: 'FILE', mimetype: 'application/pdf', size: 3_400_000 },
    { filename: 'song.mp3', identifier: `qshare_file_a_${i}`, name: rows[i - 1].name, service: 'FILE', mimetype: 'audio/mpeg', size: 5_100_000 },
  ],
});
// Replaced in setup() by a visible 64×64 gradient, so avatars show in the shots.
let PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAQklEQVR42u3OMQEAAAgDINc/9Mzg14MGLUmHCgUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFbzwB2GwADvYAAAAASUVORK5CYII=',
  'base64'
);
const json = (route, data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });

export default {
  name: 'Q-Share+',
  themeKey: 'qshareplus-ui-theme',
  dismiss: ['I understand'],

  async setup({ browser }) {
    const gen = await browser.newPage({ viewport: { width: 64, height: 64 } });
    await gen.setContent('<div style="width:64px;height:64px;background:linear-gradient(135deg,#f59e0b,#3b82f6)"></div>');
    PNG = await gen.screenshot({ clip: { x: 0, y: 0, width: 64, height: 64 } });
    await gen.close();
  },

  // Marks the one-time disclaimer as accepted before the app boots, in the
  // IndexedDB store localforage uses (q-share-general / keyvaluepairs, v2).
  initScripts: () => [
    `try {
      const req = indexedDB.open('q-share-general', 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('keyvaluepairs')) db.createObjectStore('keyvaluepairs');
        if (!db.objectStoreNames.contains('local-forage-detect-blob-support')) db.createObjectStore('local-forage-detect-blob-support');
      };
      req.onsuccess = () => {
        const db = req.result;
        try { db.transaction('keyvaluepairs', 'readwrite').objectStore('keyvaluepairs').put(true, 'general-consent'); } catch (e) {}
        db.close();
      };
    } catch (e) {}`,
  ],

  // Runs in the page: defines window.__qplusAnswer(request).
  qortal: () => `
    const bodies = ${JSON.stringify(Object.fromEntries(rows.map((r, i) => [r.identifier, body(i + 1)])))};
    window.__qplusAnswer = async (p) => {
      switch (p.action) {
        case 'GET_USER_ACCOUNT': return { address: 'QTesterAddress', publicKey: 'pk' };
        case 'GET_ACCOUNT_NAMES': return [{ name: '${NAME}', owner: 'QTesterAddress' }, { name: 'Second Name', owner: 'QTesterAddress' }];
        case 'GET_PRIMARY_NAME': return '${NAME}';
        case 'GET_QDN_RESOURCE_URL': return '/arbitrary/' + p.service + '/' + p.name + '/' + p.identifier;
        case 'FETCH_QDN_RESOURCE': return bodies[p.identifier] || (p.identifier && p.identifier.startsWith('qshare_collection_') ? { version: 1, title: 'Holiday pack', description: 'Photos and notes', items: [{ name: '${NAME}', identifier: '${ID(1)}' }, { name: 'Alice Wonder', identifier: '${ID(2)}' }], created: ${now}, updated: ${now} } : null);
        case 'GET_LIST_ITEMS': return p.list_name === 'followedNames' ? ['Alice Wonder'] : ['spammer'];
        case 'LIST_QDN_RESOURCES': return [{ size: 1000 }];
        case 'SHOW_PDF_READER': return true;
        case 'GET_QDN_RESOURCE_STATUS': return { status: 'READY', percentLoaded: 100, localChunkCount: 1, totalChunkCount: 1 };
        case 'GET_QDN_RESOURCE_PROPERTIES': return { filename: 'file.bin', mimeType: 'application/octet-stream' };
        case 'ADD_LIST_ITEMS': case 'DELETE_LIST_ITEM': return true;
        case 'PUBLISH_QDN_RESOURCE': case 'PUBLISH_MULTIPLE_QDN_RESOURCES': throw { error: 'User declined request' };
        default: return null;
      }
    };
  `,

  // Core endpoints the app fetches directly. Return true when answered.
  async route(route, url) {
    const p = url.pathname;
    const sp = url.searchParams;
    if (p.endsWith('/arbitrary/resources')) return json(route, [{ size: 1000 }]).then(() => true); // the Follow tooltip's size list
    if (p.endsWith('/resources/search')) {
      let list = rows;
      const ident = sp.get('identifier') || '';
      const name = sp.get('name');
      const query = sp.get('query') || '';
      if (ident.startsWith('qshare_collection_')) {
        list = [
          { name: NAME, service: 'DOCUMENT', identifier: 'qshare_collection_holiday-pack_ab12cd', created: now, updated: now, metadata: { title: 'Holiday pack', description: 'Photos and notes' } },
          { name: 'Alice Wonder', service: 'DOCUMENT', identifier: 'qshare_collection_tools_ef34gh', created: now - 86400000, updated: now - 86400000, metadata: { title: 'Tools', description: '' } },
        ];
      } else if (sp.get('service') === 'BLOG_COMMENT') {
        list = query.includes('_base_')
          ? [1, 2].map((n) => ({ name: n === 1 ? 'Alice Wonder' : NAME, service: 'BLOG_COMMENT', identifier: `qcomment_v1_qshare_${'id001_metadata'.slice(-12)}_base_c${n}0000`, created: now - n * 3600_000 }))
          : [{ name: 'bob+builder', service: 'BLOG_COMMENT', identifier: `qcomment_v1_qshare_${'id001_metadata'.slice(-12)}_reply_c10000_r1`, created: now - 1800_000 }];
      } else if (ident.startsWith('qshare_file_') && ident.endsWith('_metadata')) {
        list = rows.filter((r) => r.identifier === ident);
      }
      if (name) list = list.filter((r) => r.name === name);
      if (sp.get('followedonly') === 'true') list = list.filter((r) => r.name === 'Alice Wonder');
      const offset = Number(sp.get('offset') || 0);
      const limit = Number(sp.get('limit') || 20);
      if (sp.get('reverse') === 'false') list = [...list].reverse();
      await json(route, list.slice(offset, offset + limit));
      return true;
    }
    const send = (contentType, body) => route.fulfill({ status: 200, contentType, body }).then(() => true);
    if (p.includes('/THUMBNAIL/')) return send('image/png', PNG);
    if (p.includes('/BLOG_COMMENT/')) return send('text/plain', 'A comment with enough words to wrap on a phone screen, and a qortal://APP/Q-Tube link.');
    if (p.includes('/FILE/')) {
      if (p.includes('_p_')) return send('image/png', PNG);
      if (p.includes('_t_')) return send('text/plain', 'Line one of the notes.\nLine two.\n');
      // PDFs open in Hub's reader, which checks for a PDF header.
      if (p.includes('_d_')) return send('application/pdf', '%PDF-1.4\n%mock\n');
      return send('application/octet-stream', Buffer.alloc(16));
    }
    return false;
  },

  // overlay: a sheet, dialog or menu is open, so capture the viewport, not the full page.
  screens: [
    { key: 'home', path: '/', after: async (page) => page.waitForSelector('li, [role=status]', { timeout: 8000 }).catch(() => {}) },
    { key: 'home-filters', path: '/', mobileOnly: true, overlay: true, after: async (page) => { await page.getByRole('button', { name: /^Filters/ }).first().click({ timeout: 2500 }); await page.waitForTimeout(400); } },
    { key: 'share', path: `/share/${NAME}/${ID(1)}`, after: async (page) => page.waitForSelector('text=Share number 1', { timeout: 8000 }).catch(() => {}) },
    { key: 'profile', path: `/channel/${encodeURIComponent('Alice Wonder')}`, after: async (page) => page.waitForSelector('li, [role=status]', { timeout: 8000 }).catch(() => {}) },
    { key: 'settings', path: '/settings' },
    { key: 'collections', path: '/collections', optional: true },
    { key: 'collection', path: `/collection/${NAME}/qshare_collection_holiday-pack_ab12cd`, optional: true },
    { key: 'publish', path: '/', overlay: true, after: async (page) => { await page.getByRole('button', { name: /share files/i }).first().click({ timeout: 2500 }); await page.waitForTimeout(500); } },
    { key: 'account-menu', path: '/', overlay: true, after: async (page) => { await page.getByRole('button', { name: /account menu/i }).first().click({ timeout: 2500 }); await page.waitForTimeout(400); } },
  ],
};
