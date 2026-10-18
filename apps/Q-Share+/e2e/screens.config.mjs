/**
 * Q-Share+ for the shared screenshot check (scripts/screens.mjs):
 *
 *   scripts/screens.mjs Q-Share+ [--only home,share] [--themes hub30] [--mode light]
 *
 * Fixtures: 24 shares from three publishers (one with a "+" in its name), a
 * four-file share (image, text, PDF, audio), a comment thread with a reply,
 * three collections (one with folders and covers, one a copy of it by
 * bob+builder), an album of five tracks that plays as a playlist (silent
 * WAVs) and a share of 120 files. Even-numbered shares have a thumbnail; the
 * odd ones show their first image on cards.
 * Publishing is always declined, so nothing can be sent.
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
  ...(i % 2 === 0 ? { thumbnail: { service: 'THUMBNAIL', name: rows[i - 1].name, identifier: `qshare_thumb_share-number-${i}_th00${i}` } } : {}),
});
// The album that plays as a playlist, and a share with 120 files.
const ALBUM = 'qshare_file_live-in-tokyo_pl0001_metadata';
const MANY = 'qshare_file_field-recordings_mn0001_metadata';
const extraRows = [
  { name: 'Alice Wonder', service: 'DOCUMENT', identifier: ALBUM, created: now - 600_000, updated: now - 600_000, size: 900, metadata: { title: 'Live in Tokyo', description: '**cat:3**Five tracks' } },
  { name: NAME, service: 'DOCUMENT', identifier: MANY, created: now - 900_000, updated: now - 900_000, size: 900, metadata: { title: 'Field recordings', description: '**cat:3**A lot of files' } },
];
const track = (n, title) => ({ filename: `${String(n).padStart(2, '0')} ${title}.mp3`, identifier: `qshare_file_pl_t${n}`, name: 'Alice Wonder', service: 'FILE', mimetype: 'audio/mpeg', size: 4_200_000 + n * 1000 });
const extraBodies = {
  [ALBUM]: {
    title: 'Live in Tokyo', version: 1, fullDescription: 'Five tracks.', htmlDescription: '<p>Five tracks, recorded live.</p>', commentsId: 'qshare_file__cm_pl0001', category: '3',
    files: [track(1, 'Opening'), track(2, 'A song with a rather long title that wraps'), track(3, 'Interlude'), track(4, 'Encore'), track(5, 'Goodnight'),
      { filename: 'booklet.pdf', identifier: 'qshare_file_pl_d1', name: 'Alice Wonder', service: 'FILE', mimetype: 'application/pdf', size: 900_000 }],
  },
  [MANY]: {
    title: 'Field recordings', version: 1, fullDescription: 'Many files.', htmlDescription: '<p>Many files.</p>', commentsId: 'qshare_file__cm_mn0001', category: '3',
    files: Array.from({ length: 120 }, (_, i) => ({ filename: `recording-${String(i + 1).padStart(3, '0')}.zip`, identifier: `qshare_file_mn_${i}`, name: NAME, service: 'FILE', mimetype: 'application/zip', size: 120_000 })),
  },
};
const collectionBody = {
  version: 1, title: 'Holiday pack', description: 'Photos and notes', created: now, updated: now,
  cover: { service: 'THUMBNAIL', name: NAME, identifier: 'qshare_cover_holiday1' },
  items: [{ name: NAME, identifier: ID(1) }, { name: 'Alice Wonder', identifier: ID(2) }],
  folders: [
    { id: 'live01', title: 'Live recordings', description: 'Concerts', cover: { service: 'THUMBNAIL', name: NAME, identifier: 'qshare_cover_live0001' },
      items: [{ name: 'Alice Wonder', identifier: ALBUM }], folders: [{ id: 'tokyo1', title: 'Tokyo', description: '', items: [{ name: 'Alice Wonder', identifier: ALBUM }], folders: [] }] },
    { id: 'docs01', title: 'Documents with a long folder name that wraps', description: '', items: [{ name: 'bob+builder', identifier: ID(3) }], folders: [] },
    { id: 'empty1', title: 'Empty', description: '', items: [], folders: [] },
  ],
};
const HOLIDAY = 'qshare_collection_holiday-pack_ab12cd';
const TOOLS = 'qshare_collection_tools_ef34gh';
const COPY = 'qshare_collection_holiday-pack_cp78ij';
const collections = {
  [HOLIDAY]: collectionBody,
  [COPY]: { ...collectionBody, created: now - 3600_000, updated: now - 3600_000, copiedFrom: { name: NAME, identifier: HOLIDAY, title: 'Holiday pack' } },
};
const collectionRows = [
  { name: NAME, service: 'DOCUMENT', identifier: HOLIDAY, created: now, updated: now, metadata: { title: 'Holiday pack', description: 'Photos and notes' } },
  { name: 'bob+builder', service: 'DOCUMENT', identifier: COPY, created: now - 3600_000, updated: now - 3600_000, metadata: { title: 'Holiday pack', description: 'Photos and notes' } },
  { name: 'Alice Wonder', service: 'DOCUMENT', identifier: TOOLS, created: now - 86400000, updated: now - 86400000, metadata: { title: 'Tools', description: '' } },
];
/** A silent mono 8-bit WAV of `seconds`, so the playlist really plays. */
function silentWav(seconds) {
  const rate = 4000;
  const data = rate * seconds;
  const b = Buffer.alloc(44 + data, 128);
  b.write('RIFF', 0); b.writeUInt32LE(36 + data, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate, 28);
  b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write('data', 36); b.writeUInt32LE(data, 40);
  return b;
}
const WAV = silentWav(200);

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
    await gen.setContent('<body style="margin:0"><div style="width:64px;height:64px;background:linear-gradient(135deg,#f59e0b,#3b82f6)"></div></body>');
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
    const bodies = ${JSON.stringify({ ...Object.fromEntries(rows.map((r, i) => [r.identifier, body(i + 1)])), ...extraBodies })};
    const collection = ${JSON.stringify(collectionBody)};
    const collections = ${JSON.stringify(collections)};
    window.__qplusAnswer = async (p) => {
      switch (p.action) {
        case 'GET_USER_ACCOUNT': return { address: 'QTesterAddress', publicKey: 'pk' };
        case 'GET_ACCOUNT_NAMES': return [{ name: '${NAME}', owner: 'QTesterAddress' }, { name: 'Second Name', owner: 'QTesterAddress' }];
        case 'GET_PRIMARY_NAME': return '${NAME}';
        case 'GET_QDN_RESOURCE_URL': return '/arbitrary/' + p.service + '/' + p.name + '/' + p.identifier;
        case 'FETCH_QDN_RESOURCE': return bodies[p.identifier] || (p.identifier && p.identifier.startsWith('qshare_collection_') ? collections[p.identifier] || collection : null);
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
    if (p.endsWith('/transactions/unitfee')) return json(route, '1000000').then(() => true); // publish fees: 0.01 QORT
    if (p.endsWith('/transactions/unconfirmed')) return json(route, []).then(() => true); // room for a batch
    if (p.endsWith('/blocks/last')) return json(route, { height: 2744531, timestamp: Date.now() }).then(() => true); // notification checks: the node's indexed-up-to time
    if (p.endsWith('/resources/search')) {
      let list = rows;
      const ident = sp.get('identifier') || '';
      const name = sp.get('name');
      const query = sp.get('query') || '';
      if (ident.startsWith('qshare_collection_')) {
        list = collectionRows;
      } else if (sp.get('service') === 'BLOG_COMMENT') {
        list = query.includes('_base_')
          ? [1, 2].map((n) => ({ name: n === 1 ? 'Alice Wonder' : NAME, service: 'BLOG_COMMENT', identifier: `qcomment_v1_qshare_${'id001_metadata'.slice(-12)}_base_c${n}0000`, created: now - n * 3600_000 }))
          : [{ name: 'bob+builder', service: 'BLOG_COMMENT', identifier: `qcomment_v1_qshare_${'id001_metadata'.slice(-12)}_reply_c10000_r1`, created: now - 1800_000 }];
      } else if (ident.startsWith('qshare_file_') && ident.endsWith('_metadata')) {
        list = [...rows, ...extraRows].filter((r) => r.identifier === ident);
      }
      if (name) list = list.filter((r) => r.name === name);
      if (sp.get('followedonly') === 'true') list = list.filter((r) => r.name === 'Alice Wonder');
      const offset = Number(sp.get('offset') || 0);
      const limit = Number(sp.get('limit') || 20);
      if (sp.get('reverse') === 'false') list = [...list].reverse();
      await json(route, list.slice(offset, offset + limit));
      return true;
    }
    // Cards ask the node whether a share's first image is there before showing it.
    if (p.includes('/arbitrary/resource/status/')) return json(route, { status: 'READY', percentLoaded: 100 }).then(() => true);
    const send = (contentType, body) => route.fulfill({ status: 200, contentType, body }).then(() => true);
    if (p.includes('/THUMBNAIL/')) return send('image/png', PNG);
    if (p.includes('/BLOG_COMMENT/')) return send('text/plain', 'A comment with enough words to wrap on a phone screen, and a qortal://APP/Q-Tube link.');
    if (p.includes('/FILE/')) {
      if (p.includes('_p_')) return send('image/png', PNG);
      if (p.includes('_pl_t') || p.includes('_a_')) return send('audio/wav', WAV);
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
    { key: 'collection', path: `/collection/${NAME}/${HOLIDAY}`, optional: true, after: async (page) => page.waitForSelector('text=Live recordings', { timeout: 8000 }).catch(() => {}) },
    { key: 'folder', path: `/collection/${NAME}/${HOLIDAY}/folder/live01`, after: async (page) => page.waitForSelector('text=Live in Tokyo', { timeout: 8000 }).catch(() => {}) },
    { key: 'folder-new', path: `/collection/${NAME}/${HOLIDAY}/folder/live01`, overlay: true, after: async (page) => { await page.getByRole('button', { name: 'New folder' }).first().click({ timeout: 4000 }); await page.waitForTimeout(400); } },
    // bob+builder's copy of Holiday pack: the "Copy of … by Tester" line, and Copy to my collections.
    { key: 'collection-copied', path: `/collection/${encodeURIComponent('bob+builder')}/${COPY}`, after: async (page) => page.waitForSelector('text=Copy of', { timeout: 8000 }).catch(() => {}) },
    { key: 'collection-copy', path: `/collection/${encodeURIComponent('Alice Wonder')}/${TOOLS}`, overlay: true, after: async (page) => { await page.getByRole('button', { name: 'Copy to my collections' }).first().click({ timeout: 4000 }); await page.waitForTimeout(500); } },
    { key: 'share-many', path: `/share/${NAME}/${MANY}`, after: async (page) => page.waitForSelector('text=recording-050.zip', { timeout: 8000 }).catch(() => {}) },
    // Play all starts the player bar; the shot is taken with it playing.
    { key: 'playlist', path: `/share/${encodeURIComponent('Alice Wonder')}/${ALBUM}`, after: async (page) => { await page.getByRole('button', { name: 'Play all' }).first().click({ timeout: 4000 }); await page.getByRole('region', { name: 'Player' }).waitFor({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(800); } },
    { key: 'player-sheet', path: `/share/${encodeURIComponent('Alice Wonder')}/${ALBUM}`, mobileOnly: true, overlay: true, after: async (page) => { await page.getByRole('button', { name: 'Play all' }).first().click({ timeout: 4000 }); await page.getByRole('button', { name: /Open the player/ }).click({ timeout: 4000 }); await page.waitForTimeout(500); } },
    { key: 'publish-many', path: '/', overlay: true, after: async (page) => { await page.getByRole('button', { name: /share files/i }).first().click({ timeout: 2500 }); await page.setInputFiles('[data-testid=share-file-input]', Array.from({ length: 25 }, (_, i) => ({ name: `track-${i + 1}.mp3`, mimeType: 'audio/mpeg', buffer: Buffer.from('x') }))); await page.waitForTimeout(600); } },
    // A real image: the thumbnail is made on the page from it.
    { key: 'publish-thumbnail', path: '/', overlay: true, after: async (page) => { await page.getByRole('button', { name: /share files/i }).first().click({ timeout: 2500 }); await page.setInputFiles('[data-testid=share-file-input]', [{ name: 'beach.png', mimeType: 'image/png', buffer: PNG }, { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('x') }]); await page.getByText('Made from beach.png.').waitFor({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(300); } },
    { key: 'publish', path: '/', overlay: true, after: async (page) => { await page.getByRole('button', { name: /share files/i }).first().click({ timeout: 2500 }); await page.waitForTimeout(500); } },
    { key: 'account-menu', path: '/', overlay: true, after: async (page) => { await page.getByRole('button', { name: /account menu/i }).first().click({ timeout: 2500 }); await page.waitForTimeout(400); } },
    // Opening the bell runs the first check: a comment by bob+builder on share 1, Alice Wonder's Tools collection holding it, and bob+builder's copy of Holiday pack.
    { key: 'notifications', path: '/', overlay: true, after: async (page) => { await page.getByRole('button', { name: /^Notifications/ }).first().click({ timeout: 2500 }); await page.getByText(/added .* to Tools/).first().waitFor({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(400); } },
    // Last: the List choice is a setting, kept for the screens after it.
    { key: 'collection-list', path: `/collection/${NAME}/${HOLIDAY}`, after: async (page) => { await page.getByRole('button', { name: 'List' }).first().click({ timeout: 4000 }); await page.waitForTimeout(400); } },
  ],
};
