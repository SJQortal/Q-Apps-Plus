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
 * odd ones show their first image on cards. Four more collections, one per
 * space, reached only by their links, so lists and notifications don't change.
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
// Others' shares only, so the notification check finds nothing new in them.
for (const [id, title, n] of [['qshare_collection_film-night-picks_fn1234', 'Film night picks', 3], ['qshare_collection_field-guides_fg1234', 'Field guides', 1], ['qshare_collection_live-sets_ls1234', 'Live sets', 2]]) {
  collections[id] = { version: 1, title, description: '', created: now, updated: now, items: [{ name: 'Alice Wonder', identifier: ID(2) }, { name: 'bob+builder', identifier: ID(3) }, { name: 'Alice Wonder', identifier: ALBUM }].slice(0, n) };
}
const collectionRows = [
  { name: NAME, service: 'DOCUMENT', identifier: HOLIDAY, created: now, updated: now, metadata: { title: 'Holiday pack', description: 'Photos and notes' } },
  { name: 'bob+builder', service: 'DOCUMENT', identifier: COPY, created: now - 3600_000, updated: now - 3600_000, metadata: { title: 'Holiday pack', description: 'Photos and notes' } },
  { name: 'Alice Wonder', service: 'DOCUMENT', identifier: TOOLS, created: now - 86400000, updated: now - 86400000, metadata: { title: 'Tools', description: '' } },
  // More by others, for Explore collections.
  { name: 'bob+builder', service: 'DOCUMENT', identifier: 'qshare_collection_film-night-picks_fn1234', created: now - 2 * 86400000, updated: now - 2 * 86400000, metadata: { title: 'Film night picks', description: 'Old films worth an evening, with subtitles' } },
  { name: 'Carol Ann', service: 'DOCUMENT', identifier: 'qshare_collection_field-guides_fg1234', created: now - 5 * 86400000, updated: now - 5 * 86400000, metadata: { title: 'Field guides with a long title that wraps on a phone', description: 'Birds, trees and mushrooms' } },
  { name: 'Alice Wonder', service: 'DOCUMENT', identifier: 'qshare_collection_live-sets_ls1234', created: now - 9 * 86400000, updated: now - 9 * 86400000, metadata: { title: 'Live sets', description: 'Concert recordings' } },
];
// One collection per space, under Tester, with folders. Their shares and the
// collections themselves are in no search but their own exact one, so the home
// list, Explore and the notification check never see them.
const DAY = 86400000;
const spaceShare = (key, title, user, age, files, thumb) => {
  const id = `qshare_file_${key}_sp${key.length}_metadata`;
  return {
    id, user,
    row: { name: user, service: 'DOCUMENT', identifier: id, created: now - age * DAY, updated: now - age * DAY, size: 900, metadata: { title, description: `**cat:6**${title}` } },
    body: {
      title, version: 1, fullDescription: `${title}.`, htmlDescription: `<p>${title}.</p>`, commentsId: `qshare_file__cm_${key}`, category: '6', created: now - age * DAY,
      files: files.map((f, i) => ({ name: user, service: 'FILE', ...f, identifier: `qshare_file_${key}${f.mark}${i}` })).map(({ mark, ...f }) => f),
      ...(thumb ? { thumbnail: { service: 'THUMBNAIL', name: user, identifier: `qshare_thumb_sp_${key}` } } : {}),
    },
  };
};
const song = (n, title) => ({ filename: `${String(n).padStart(2, '0')} ${title}.mp3`, mimetype: 'audio/mpeg', size: 3_800_000 + n * 91_000, mark: '_a_' });
const film = (name, size) => ({ filename: `${name}.webm`, mimetype: 'video/webm', size, mark: '_v_' });
const pdf = (name, size) => ({ filename: `${name}.pdf`, mimetype: 'application/pdf', size, mark: '_d_' });
const epub = (name, size) => ({ filename: `${name}.epub`, mimetype: 'application/epub+zip', size, mark: '_e_' });
const photo = (name) => ({ filename: `${name}.jpg`, mimetype: 'image/jpeg', size: 640_000 + name.length * 20_000, mark: '_p_' });
const SONGS = ['Harbour lights', 'Slow tide', 'A song with a rather long title that takes its time to finish', 'Paper boats', 'Night ferry', 'Home by morning'];
const MUSIC_SHARES = [
  spaceShare('tide', 'Tidal hours', 'Alice Wonder', 12, SONGS.map((t, i) => song(i + 1, t)), true),
  spaceShare('kiln', 'Kiln sessions, recorded live over three cold nights in a converted pottery', 'bob+builder', 40, SONGS.slice(0, 4).map((t, i) => song(i + 1, t)), true),
  spaceShare('demo', 'First demos', NAME, 90, [song(1, 'Untitled one'), song(2, 'Untitled two'), { filename: 'lyrics.pdf', mimetype: 'application/pdf', size: 210_000, mark: '_d_' }], false),
  spaceShare('solo', 'One single', 'Carol Ann', 120, [song(1, 'One single')], false),
  spaceShare('liner', 'Liner notes', 'Carol Ann', 130, [pdf('liner-notes', 800_000)], false),
];
const FILM_SHARES = [
  spaceShare('north', 'The long way north', 'Alice Wonder', 8, [film('the-long-way-north', 842_000_000)], true),
  spaceShare('lamps', 'Lamplighters of a city that forgot how to sleep, and the people who stayed awake', 'bob+builder', 20, [film('lamplighters', 1_260_000_000)], true),
  spaceShare('salt', 'Salt roads', NAME, 33, [film('salt-roads', 610_000_000)], true),
  spaceShare('orch', 'Orchard', 'Carol Ann', 45, [film('orchard', 420_000_000)], false),
  spaceShare('stn', 'Station eleven nights', 'Alice Wonder', 60, ['Arrival', 'The depot', 'Signals', 'Last train'].map((t, i) => film(`episode-${i + 1}-${t.toLowerCase().replace(' ', '-')}`, 310_000_000 + i * 8_000_000)), true),
  spaceShare('stills', 'Behind the scenes', NAME, 70, [photo('behind-1'), pdf('call-sheet', 300_000)], false),
];
const BOOK_SHARES = [
  spaceShare('atlas', 'An atlas of quiet places', 'Alice Wonder', 10, [pdf('an-atlas-of-quiet-places', 18_400_000), epub('an-atlas-of-quiet-places', 4_200_000)], true),
  spaceShare('bees', 'Keeping bees', NAME, 16, [epub('keeping-bees', 1_900_000)], false),
  spaceShare('bridge', 'The complete and unabridged history of bridges, with notes on the people who crossed them', 'bob+builder', 28, [pdf('history-of-bridges', 42_000_000)], false),
  spaceShare('stars', 'Reading the stars', 'Carol Ann', 41, [pdf('reading-the-stars', 7_700_000)], true),
  spaceShare('bread', 'Bread', NAME, 55, [epub('bread', 900_000), pdf('bread-print-edition', 11_000_000)], false),
  spaceShare('tree', 'Common trees', 'Alice Wonder', 63, [pdf('common-trees', 5_100_000)], true),
  spaceShare('sail', 'Small boat sailing', 'bob+builder', 80, [epub('small-boat-sailing', 2_300_000)], false),
  spaceShare('ink', 'Ink and paper', 'Carol Ann', 95, [pdf('ink-and-paper', 3_300_000)], false),
];
const ALBUM_SHARES = [
  ...['Morning at the pier', 'Fog over the bay', 'Red door', 'The market', 'Low sun', 'Fishing nets', 'Salt flats', 'Lighthouse steps', 'Blue hour'].map((t, i) => spaceShare(`one${i}`, t, i % 3 === 2 ? 'Alice Wonder' : NAME, 30 + i * 40, [photo(t.toLowerCase().replace(/ /g, '-'))], i % 2 === 0)),
  spaceShare('walk', 'Coast walk, three days from the headland to the harbour and back again', NAME, 22, Array.from({ length: 14 }, (_, i) => photo(`coast-walk-${i + 1}`)), true),
  spaceShare('wed', 'Wedding', 'bob+builder', 300, [...Array.from({ length: 5 }, (_, i) => photo(`wedding-${i + 1}`)), { filename: 'running-order.txt', mimetype: 'text/plain', size: 1_400, mark: '_t_' }], false),
  spaceShare('zip', 'Originals', NAME, 340, [{ filename: 'originals.zip', mimetype: 'application/zip', size: 90_000_000, mark: '_z_' }], false),
];
const spaceBy = (list) => Object.fromEntries(list.map((s) => [s.id, s.body]));
const itemsOf = (list) => list.map((s) => ({ name: s.user, identifier: s.id }));
const GONE = spaceShare('gone', 'deleted', 'Carol Ann', 150, [], false);
GONE.body = 'D'; // The delete marker Torq and qapp-core publish.
const SPACE_SHARES = [...MUSIC_SHARES, ...FILM_SHARES, ...BOOK_SHARES, ...ALBUM_SHARES, GONE];
const spaceRows = SPACE_SHARES.map((s) => s.row);
const spaceBodies = spaceBy(SPACE_SHARES);
const SPACE_MUSIC = 'qshare_collection_late-night-records_sm0001';
const SPACE_CINEMA = 'qshare_collection_film-club_sc0001';
const SPACE_LIBRARY = 'qshare_collection_reading-room_sl0001';
const SPACE_ALBUM = 'qshare_collection_the-coast_sa0001';
const SPACE_VISITOR = 'qshare_collection_borrowed-records_sv0001';
const spaceCover = (key) => ({ service: 'THUMBNAIL', name: NAME, identifier: `qshare_cover_sp_${key}` });
Object.assign(collections, {
  [SPACE_MUSIC]: {
    version: 1, title: 'Late night records', description: 'Quiet albums for after dark.', created: now - 200 * DAY, updated: now - DAY, space: 'music', cover: spaceCover('music'),
    items: itemsOf([...MUSIC_SHARES.slice(0, 2), ...MUSIC_SHARES.slice(3), GONE]),
    folders: [
      { id: 'sm_demos', title: 'Demos and rough takes', description: 'Before the albums', items: itemsOf(MUSIC_SHARES.slice(2, 4)), folders: [{ id: 'sm_older', title: 'Older', description: '', items: itemsOf(MUSIC_SHARES.slice(3, 4)), folders: [] }] },
      { id: 'sm_live', title: 'Live', description: '', cover: spaceCover('live'), items: itemsOf(MUSIC_SHARES.slice(1, 2)), folders: [] },
      { id: 'sm_empty', title: 'For later', description: '', items: [], folders: [] },
    ],
  },
  [SPACE_CINEMA]: {
    version: 1, title: 'Film club', description: 'What we are watching this winter, one film a fortnight.', created: now - 100 * DAY, updated: now - DAY, space: 'cinema',
    items: itemsOf([...FILM_SHARES, GONE]),
    folders: [
      { id: 'sc_docs', title: 'Documentaries', description: '', items: itemsOf(FILM_SHARES.slice(1, 2)), folders: [] },
      { id: 'sc_short', title: 'Short films with a long folder name that wraps', description: '', cover: spaceCover('short'), items: itemsOf(FILM_SHARES.slice(3, 4)), folders: [] },
      { id: 'sc_soon', title: 'Coming soon', description: '', items: [], folders: [] },
    ],
  },
  [SPACE_LIBRARY]: {
    version: 1, title: 'The reading room', description: 'Books worth keeping, as PDF and EPUB.', created: now - 150 * DAY, updated: now - DAY, space: 'library',
    items: itemsOf([...BOOK_SHARES, GONE]),
    folders: [
      { id: 'sl_nature', title: 'Nature', description: 'Field notes', items: itemsOf(BOOK_SHARES.slice(5, 6)), folders: [] },
      { id: 'sl_craft', title: 'Craft and making things by hand', description: '', items: itemsOf(BOOK_SHARES.slice(4, 5)), folders: [] },
    ],
  },
  [SPACE_ALBUM]: {
    version: 1, title: 'The coast', description: 'Two years along the same few miles of shore.', created: now - 400 * DAY, updated: now - DAY, space: 'album', cover: spaceCover('album'),
    items: itemsOf([...ALBUM_SHARES, GONE]),
    folders: [
      { id: 'sa_walk', title: 'Coast walk', description: '', items: itemsOf(ALBUM_SHARES.slice(9, 10)), folders: [] },
      { id: 'sa_people', title: 'People', description: '', cover: spaceCover('people'), items: itemsOf(ALBUM_SHARES.slice(10, 11)), folders: [] },
    ],
  },
  // A visitor's view: by another name, so Copy shows and Move and Remove don't.
  [SPACE_VISITOR]: {
    version: 1, title: 'Borrowed records', description: 'Lent to me by friends.', created: now - 50 * DAY, updated: now - 2 * DAY, space: 'music',
    items: itemsOf(MUSIC_SHARES.slice(0, 2)),
    folders: [{ id: 'sv_more', title: 'More', description: '', items: itemsOf(MUSIC_SHARES.slice(3, 4)), folders: [] }],
  },
});
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
/** An ID3v2.3 tag holding `image` as the front cover, for a Range read of a track's art. */
function id3Cover(image) {
  const safe = (n) => [(n >> 21) & 127, (n >> 14) & 127, (n >> 7) & 127, n & 127];
  const be = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const body = Buffer.concat([Buffer.from([0]), Buffer.from('image/png\0'), Buffer.from([3, 0]), image]);
  const frame = Buffer.concat([Buffer.from('APIC'), Buffer.from(be(body.length)), Buffer.from([0, 0]), body]);
  return Buffer.concat([Buffer.from('ID3'), Buffer.from([3, 0, 0, ...safe(frame.length)]), frame]);
}

// Replaced in setup() by a visible 64×64 gradient, so avatars show in the shots.
let PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAQklEQVR42u3OMQEAAAgDINc/9Mzg14MGLUmHCgUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFbzwB2GwADvYAAAAASUVORK5CYII=',
  'base64'
);
// Replaced in setup(): pictures of different shapes and colours, and a short real
// video. Only the space fixtures use them, so the other screens stay as they were.
let PICS = [PNG];
let WEBM = Buffer.alloc(16);
const hash = (text) => [...text].reduce((sum, c) => (sum * 31 + c.charCodeAt(0)) >>> 0, 7);
const picFor = (text) => PICS[hash(text) % PICS.length];
const json = (route, data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });

export default {
  name: 'Q-Share+',
  themeKey: 'qshareplus-ui-theme',
  dismiss: ['I understand'],

  async setup({ browser }) {
    const gen = await browser.newPage({ viewport: { width: 64, height: 64 } });
    await gen.setContent('<body style="margin:0"><div style="width:64px;height:64px;background:linear-gradient(135deg,#f59e0b,#3b82f6)"></div></body>');
    PNG = await gen.screenshot({ clip: { x: 0, y: 0, width: 64, height: 64 } });
    // The shapes photos and thumbnails really come in.
    const shapes = [[900, 600, '#0f766e', '#f59e0b'], [600, 900, '#7c2d12', '#fde68a'], [960, 540, '#1e3a8a', '#f472b6'], [700, 700, '#14532d', '#a3e635'], [900, 600, '#111827', '#60a5fa'], [960, 540, '#581c87', '#fb923c'], [600, 900, '#0c4a6e', '#bae6fd'], [800, 600, '#e5e7eb', '#475569']];
    PICS = [];
    for (const [width, height, from, to] of shapes) {
      await gen.setViewportSize({ width, height });
      await gen.setContent(`<body style="margin:0"><div style="width:${width}px;height:${height}px;background:radial-gradient(circle at 30% 25%,${to},transparent 60%),linear-gradient(160deg,${from},#000)"></div></body>`);
      PICS.push(await gen.screenshot({ clip: { x: 0, y: 0, width, height } }));
    }
    // A real two-second video, recorded from a canvas, for the cinema's player.
    const webm = await gen.evaluate(() => new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = 640; canvas.height = 360;
      const c = canvas.getContext('2d');
      const recorder = new MediaRecorder(canvas.captureStream(15), { mimeType: 'video/webm' });
      const parts = [];
      recorder.ondataavailable = (e) => parts.push(e.data);
      recorder.onstop = async () => { const b = new Uint8Array(await new Blob(parts).arrayBuffer()); resolve(Array.from(b)); };
      let t = 0;
      const timer = setInterval(() => { t += 1; c.fillStyle = `hsl(${t * 6}, 60%, 30%)`; c.fillRect(0, 0, 640, 360); }, 66);
      recorder.start();
      setTimeout(() => { clearInterval(timer); recorder.stop(); }, 2000);
    })).catch(() => null);
    if (webm) WEBM = Buffer.from(webm);
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
    const bodies = ${JSON.stringify({ ...Object.fromEntries(rows.map((r, i) => [r.identifier, body(i + 1)])), ...extraBodies, ...spaceBodies })};
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
        // Core's query: anywhere in the name, identifier, title or description, any case.
        const q = query.toLowerCase();
        list = q ? collectionRows.filter((r) => [r.name, r.identifier, r.metadata.title, r.metadata.description].some((f) => f.toLowerCase().includes(q))) : collectionRows;
      } else if (sp.get('service') === 'BLOG_COMMENT') {
        list = query.includes('_base_')
          ? [1, 2].map((n) => ({ name: n === 1 ? 'Alice Wonder' : NAME, service: 'BLOG_COMMENT', identifier: `qcomment_v1_qshare_${'id001_metadata'.slice(-12)}_base_c${n}0000`, created: now - n * 3600_000 }))
          : [{ name: 'bob+builder', service: 'BLOG_COMMENT', identifier: `qcomment_v1_qshare_${'id001_metadata'.slice(-12)}_reply_c10000_r1`, created: now - 1800_000 }];
      } else if (ident.startsWith('qshare_file_') && ident.endsWith('_metadata')) {
        list = [...rows, ...extraRows, ...spaceRows].filter((r) => r.identifier === ident);
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
    if (p.includes('_sp_')) return send('image/png', picFor(p));
    if (p.includes('/THUMBNAIL/')) return send('image/png', PNG);
    if (p.includes('/BLOG_COMMENT/')) return send('text/plain', 'A comment with enough words to wrap on a phone screen, and a qortal://APP/Q-Tube link.');
    if (p.includes('/FILE/')) {
      if (p.includes('_v_')) return send('video/webm', WEBM);
      if (/qshare_file_[a-z]+\d?_p_/.test(p)) return send('image/png', picFor(p));
      if (p.includes('_p_')) return send('image/png', PNG);
      if (p.includes('_pl_t') || p.includes('_a_')) {
        // Art comes by a closed Range; the player's is open-ended (bytes=0-).
        if (/bytes=\d+-\d+/.test(route.request().headers().range ?? '')) return send('audio/mpeg', id3Cover(/qshare_file_[a-z]+_a_/.test(p) ? picFor(p) : PNG));
        return send('audio/wav', WAV);
      }
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
    { key: 'share-remove', path: `/share/${NAME}/${ID(1)}`, overlay: true, after: async (page) => { await page.getByRole('button', { name: 'Remove from QDN' }).first().click({ timeout: 8000 }); await page.getByText(/in fees/).waitFor({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(400); } },
    { key: 'profile', path: `/channel/${encodeURIComponent('Alice Wonder')}`, after: async (page) => page.waitForSelector('li, [role=status]', { timeout: 8000 }).catch(() => {}) },
    { key: 'settings', path: '/settings' },
    { key: 'collections', path: '/collections', optional: true },
    { key: 'collection', path: `/collection/${NAME}/${HOLIDAY}`, optional: true, after: async (page) => page.waitForSelector('text=Live recordings', { timeout: 8000 }).catch(() => {}) },
    { key: 'folder', path: `/collection/${NAME}/${HOLIDAY}/folder/live01`, after: async (page) => page.waitForSelector('text=Live in Tokyo', { timeout: 8000 }).catch(() => {}) },
    { key: 'collection-edit', path: `/collection/${NAME}/${HOLIDAY}`, overlay: true, after: async (page) => { await page.getByRole('button', { name: 'Edit' }).first().click({ timeout: 4000 }); await page.getByRole('radiogroup', { name: 'Space' }).scrollIntoViewIfNeeded({ timeout: 4000 }); await page.waitForTimeout(400); } },
    { key: 'folder-new', path: `/collection/${NAME}/${HOLIDAY}/folder/live01`, overlay: true, after: async (page) => { await page.getByRole('button', { name: 'New folder' }).first().click({ timeout: 4000 }); await page.waitForTimeout(400); } },
    // bob+builder's copy of Holiday pack: the "Copy of … by Tester" line, and Copy to my collections.
    { key: 'collection-copied', path: `/collection/${encodeURIComponent('bob+builder')}/${COPY}`, after: async (page) => page.waitForSelector('text=Copy of', { timeout: 8000 }).catch(() => {}) },
    { key: 'collection-copy', path: `/collection/${encodeURIComponent('Alice Wonder')}/${TOOLS}`, overlay: true, after: async (page) => { await page.getByRole('button', { name: 'Copy to my collections' }).first().click({ timeout: 4000 }); await page.waitForTimeout(500); } },
    // Under the filters (in the Filters sheet on phones): other people's collections, with their own search.
    { key: 'explore', path: '/', overlay: true, after: async (page) => { if (await page.getByRole('button', { name: /^Filters/ }).first().isVisible().catch(() => false)) await page.getByRole('button', { name: /^Filters/ }).first().click({ timeout: 2500 }); await page.getByRole('button', { name: 'Explore collections' }).first().click({ timeout: 4000 }); await page.getByRole('button', { name: /^Open Film night picks/ }).waitFor({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(400); } },
    { key: 'explore-search', path: '/', overlay: true, after: async (page) => { if (await page.getByRole('button', { name: /^Filters/ }).first().isVisible().catch(() => false)) await page.getByRole('button', { name: /^Filters/ }).first().click({ timeout: 2500 }); await page.getByRole('button', { name: 'Explore collections' }).first().click({ timeout: 4000 }); await page.getByRole('textbox', { name: 'Search collections' }).fill('live', { timeout: 4000 }); await page.getByRole('button', { name: /^Open Live sets/ }).waitFor({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(400); } },
    // Add to collection: collections folded, the first with folders opened by its arrow.
    { key: 'add-to-collection', path: `/share/${NAME}/${ID(1)}`, overlay: true, after: async (page) => { await page.getByRole('button', { name: /^(Add to collection$|In collection$|Collect(ed)?:)/ }).first().click({ timeout: 8000 }); await page.getByRole('menuitemcheckbox').first().waitFor({ timeout: 6000 }).catch(() => {}); await page.locator('[data-testid^="folders-"]').first().click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(500); } },
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
    // A collection per space.
    { key: 'space-music', path: `/collection/${NAME}/${SPACE_MUSIC}`, after: async (page) => { await page.waitForSelector('text=Tidal hours', { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(800); } },
    // In a folder, playing: the player bar over the page.
    { key: 'space-music-folder', path: `/collection/${NAME}/${SPACE_MUSIC}/folder/sm_demos`, after: async (page) => { await page.getByRole('button', { name: 'Play all' }).first().click({ timeout: 8000 }); await page.getByRole('region', { name: 'Player' }).waitFor({ timeout: 4000 }).catch(() => {}); await page.mouse.move(1, 1); await page.waitForTimeout(800); } },
    // A folder two deep holding one album: the trail ends with it, no header row repeats the hero, and its menu sits right of Edit.
    { key: 'space-music-solo', path: `/collection/${NAME}/${SPACE_MUSIC}/folder/sm_older`, after: async (page) => { await page.getByRole('table', { name: 'Tracks' }).waitFor({ timeout: 8000 }).catch(() => {}); await page.waitForTimeout(800); } },
    // By bob+builder: Copy to my collections, no owner's buttons.
    { key: 'space-visitor', path: `/collection/${encodeURIComponent('bob+builder')}/${SPACE_VISITOR}`, after: async (page) => { await page.waitForSelector('text=Tidal hours', { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(800); } },
    { key: 'space-cinema', path: `/collection/${NAME}/${SPACE_CINEMA}`, after: async (page) => { await page.waitForSelector('text=Salt roads', { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(800); } },
    { key: 'space-cinema-player', path: `/collection/${NAME}/${SPACE_CINEMA}`, overlay: true, after: async (page) => { await page.getByRole('button', { name: 'Play Station eleven nights' }).first().click({ timeout: 8000 }); await page.getByRole('dialog').waitFor({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(1500); } },
    { key: 'space-cinema-film', path: `/collection/${NAME}/${SPACE_CINEMA}`, overlay: true, after: async (page) => { await page.getByRole('button', { name: 'Play Salt roads' }).first().click({ timeout: 8000 }); await page.getByRole('dialog').waitFor({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(1500); } },
    // A folder with nothing in it: the stage with no picture, and the empty state.
    { key: 'space-cinema-empty', path: `/collection/${NAME}/${SPACE_CINEMA}/folder/sc_soon`, after: async (page) => { await page.waitForSelector('h1', { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(600); } },
    { key: 'space-library', path: `/collection/${NAME}/${SPACE_LIBRARY}`, after: async (page) => { await page.waitForSelector('text=Keeping bees', { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(800); } },
    { key: 'space-library-book', path: `/collection/${NAME}/${SPACE_LIBRARY}`, overlay: true, after: async (page) => { await page.getByRole('button', { name: /^Keeping bees by/ }).first().click({ timeout: 8000 }); await page.waitForTimeout(600); } },
    { key: 'space-library-catalogue', path: `/collection/${NAME}/${SPACE_LIBRARY}`, after: async (page) => { await page.getByRole('button', { name: 'Catalogue' }).click({ timeout: 8000 }); await page.getByRole('heading', { name: 'Books' }).scrollIntoViewIfNeeded(); await page.evaluate(() => { localStorage.removeItem('qshareplus-library-view'); window.scrollBy(0, 200); }); await page.mouse.move(1, 1); await page.waitForTimeout(600); } },
    { key: 'space-library-folder', path: `/collection/${NAME}/${SPACE_LIBRARY}/folder/sl_nature`, after: async (page) => { await page.waitForSelector('text=Common trees', { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(800); } },
    { key: 'space-album', path: `/collection/${NAME}/${SPACE_ALBUM}`, after: async (page) => { await page.waitForSelector('text=Coast walk', { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(1000); } },
    { key: 'space-album-folder', path: `/collection/${NAME}/${SPACE_ALBUM}/folder/sa_people`, after: async (page) => { await page.waitForSelector('text=Wedding', { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(800); } },
    { key: 'space-album-lightbox', path: `/collection/${NAME}/${SPACE_ALBUM}`, overlay: true, after: async (page) => { await page.getByRole('button', { name: /^Open .*from Morning at the pier/ }).first().click({ timeout: 8000 }); await page.waitForTimeout(1200); } },
    { key: 'space-picker', path: `/collection/${NAME}/${SPACE_MUSIC}`, overlay: true, after: async (page) => { await page.getByRole('button', { name: 'Edit' }).first().click({ timeout: 8000 }); await page.getByRole('radiogroup', { name: 'Space' }).scrollIntoViewIfNeeded({ timeout: 4000 }); await page.waitForTimeout(400); } },
    // Last: the List choice is a setting, kept for the screens after it.
    { key: 'collection-list', path: `/collection/${NAME}/${HOLIDAY}`, after: async (page) => { await page.getByRole('button', { name: 'List' }).first().click({ timeout: 4000 }); await page.mouse.move(1, 1); await page.waitForTimeout(400); } },
  ],
};
