/**
 * Q-Mail+ for the shared screenshot check (scripts/screens.mjs):
 *
 *   scripts/screens.mjs Q-Mail+ [--only inbox,inbox-open] [--themes hub30] [--mode light]
 *
 * Fixtures (docs/apps/Q-Mail+.md → Data contract, binding): a signed-in
 * account "Tester GO" that also owns "bob+builder"; an inbox of 30
 * MAIL_PRIVATE rows from four senders (one with a "+", one non-ASCII), some
 * with a cached subject, some locked (DECRYPT_DATA throws); one message with
 * four attachments (PNG, text, a valid one-page PDF, WAV) and five Cc names,
 * one long (the reader folds them; Reply all fills Cc); 53 qortal_qmail_ rows, so the paged alias
 * scan reads two pages; a watched alias
 * with mail; sent rows for both owned names (plus a tombstone that must stay
 * hidden); a group with threads and posts; a draft, archived ids and read
 * state in localStorage. Every publish and save is declined, so nothing can
 * be sent or spent.
 *
 * Impostor names: "Simon James" and an impostor's copy, "Simon\u2800James"
 * (U+2800 BRAILLE PATTERN BLANK, which Hub strikes through), each send one
 * recent inbox message and both come back from SEARCH_NAMES, so the inbox,
 * the reader (impostor-open) and the composer's suggestions (compose-names)
 * show the strike next to the real name.
 *
 * Reference-only history (1.0.1 replies): Simon James's message carries six
 * threadV2 references and no copies (earlier-refs): one not sent to us (a
 * locked id), our own deleted sent message (the tombstone), one the node
 * can't fetch, and three that load, so "Show earlier" shows every state and
 * "Show 1 older message".
 *
 * Encryption is mocked end to end: FETCH_QDN_RESOURCE answers a token that
 * names the resource, DECRYPT_DATA turns the token into the base64 body the
 * app expects (UTF-8 JSON for mail, raw bytes for attachments), and
 * ENCRYPT_DATA/DECRYPT_DATA round-trip the subject cache.
 */
const NAME = 'Tester GO';
const SECOND = 'bob+builder';
const ALIAS = 'support-desk';
const ADDRESS = 'QTesterGO11111111111111111111AbCdEf';
const ALICE = 'Alice Wonder';
const ALICE_ADDRESS = 'QAliceWonder22222222222222222Al1c3W';
const ZOE = 'Zoë Ångström';
const ZOE_ADDRESS = 'QZoeAngstrom33333333333333333Zo3e1A';
const MARCUS = "Marcus O'Neil";
const MARCUS_ADDRESS = 'QMarcusONeil44444444444444444M4rcus';
const NAMELESS_ADDRESS = 'QNoNameMember5555555555555555NoNm3x';
const SIMON = 'Simon James';
const SIMON_ADDRESS = 'QSimonJames666666666666666666S1m0nJ';
// An impostor's copy of the name above: the space is U+2800 BRAILLE PATTERN BLANK.
const IMPOSTOR = 'Simon\u2800James';
const IMPOSTOR_ADDRESS = 'QImpostor77777777777777777777Imp0st';
// A long registered name (25 characters) among the Cc names.
const LONG_NAME = 'Custom Node on Qortal Hub';
const LONG_ADDRESS = 'QCustomNodeQortalHub88888888CuNoQH';
const GROUP_ID = 7;
const GROUP_NAME = 'Qortal Builders';

const OWNERS = {
  [NAME]: ADDRESS,
  [SECOND]: ADDRESS,
  [ALICE]: ALICE_ADDRESS,
  [ZOE]: ZOE_ADDRESS,
  [MARCUS]: MARCUS_ADDRESS,
  [SIMON]: SIMON_ADDRESS,
  [IMPOSTOR]: IMPOSTOR_ADDRESS,
  [LONG_NAME]: LONG_ADDRESS,
};
const suffix = (address) => address.slice(-6);
const now = Date.now();
const HOUR = 3600_000;

// ---- identifiers (data contract §2, verbatim builders) ---------------------
const inboxId = (recipient, address, id) => `_mail_qortal_qmail_${recipient.slice(0, 20)}_${suffix(address)}_mail_${id}`;
const aliasId = (alias, id) => `_mail_qortal_qmail_${alias}_mail_${id}`;
const threadId = (token) => `qortal_qmail_thread_group${GROUP_ID}_${token}`;
const postId = (token, uid) => `qortal_qmail_thmsg_group${GROUP_ID}_${token}_${uid}`;
const attachmentId = (a, b) => `attachments_qmail_${a}_${b}`;

const SENDERS = [ALICE, SECOND, ZOE, MARCUS];
const SUBJECTS = [
  'Photos, notes and the spec',
  'Re: Minting rewards this week',
  'Group call on Thursday?',
  'A very long subject line that keeps going so the row has to truncate it with an ellipsis on phones',
  '',
  'Trade bot logs',
  'Welcome aboard',
];

// ---- attachments -----------------------------------------------------------
const ATTACHMENTS = [
  { identifier: attachmentId('img01', 'a1'), filename: 'img01.png', originalFilename: 'coast-photo.png', type: 'image/png', size: 2_480 },
  { identifier: attachmentId('txt01', 'b2'), filename: 'txt01.txt', originalFilename: 'notes.txt', type: 'text/plain', size: 96 },
  { identifier: attachmentId('pdf01', 'c3'), filename: 'pdf01.pdf', originalFilename: 'spec-sheet.pdf', type: 'application/pdf', size: 640 },
  { identifier: attachmentId('aud01', 'd4'), filename: 'aud01.wav', originalFilename: 'voice-note.wav', type: 'audio/wav', size: 4_844 },
];
const attachmentRefs = (publisher) => ATTACHMENTS.map((a) => ({ ...a, name: publisher, service: 'ATTACHMENT_PRIVATE' }));

/** A minimal, valid one-page PDF with one text object (pdf.js renders it). */
function makePdf(text) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 360 240] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    null, // the content stream, filled below
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const stream = `BT /F1 20 Tf 24 150 Td (${text.replace(/[\\()]/g, '\\$&')}) Tj ET\nBT /F1 11 Tf 24 110 Td (Rendered by pdf.js inside Q-Mail+) Tj ET`;
  objects[3] = `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`;
  let out = '%PDF-1.4\n%âãÏÓ\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

/** A 0.3 s 8 kHz mono 8-bit WAV: a quiet sine, enough for <audio> to show a duration. */
function makeWav() {
  const rate = 8000;
  const samples = Math.round(rate * 0.3);
  const data = Buffer.alloc(samples);
  for (let i = 0; i < samples; i += 1) data[i] = 128 + Math.round(40 * Math.sin((2 * Math.PI * 440 * i) / rate));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + samples, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate, 28);
  header.writeUInt16LE(1, 32);
  header.writeUInt16LE(8, 34);
  header.write('data', 36);
  header.writeUInt32LE(samples, 40);
  return Buffer.concat([header, data]);
}

// Replaced in setup() by a visible 64×64 gradient, so avatars and the image
// attachment show in the shots.
let PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAQklEQVR42u3OMQEAAAgDINc/9Mzg14MGLUmHCgUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFbzwB2GwADvYAAAAASUVORK5CYII=',
  'base64'
);
const PDF = makePdf('Spec sheet: Q-Mail+ attachments');
const WAV = makeWav();
const TEXT = 'Line one of the notes.\nLine two, with a qortal://APP/Q-Share link.\nLine three.\n';

// ---- search rows (what Core returns) --------------------------------------
const row = (name, service, identifier, created, metadata) => ({
  name,
  service,
  identifier,
  created,
  updated: created,
  size: 1800,
  ...(metadata ? { metadata } : {}),
});

const INBOX = Array.from({ length: 30 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  return row(SENDERS[i % 4], 'MAIL_PRIVATE', inboxId(NAME, ADDRESS, `m${n}`), now - i * 5 * HOUR - (i % 3) * 600_000);
});
// The real name and the impostor's copy, each with one recent message.
const LOOKALIKE_INBOX = [
  row(SIMON, 'MAIL_PRIVATE', inboxId(NAME, ADDRESS, 'sj1'), now - 0.5 * HOUR),
  row(IMPOSTOR, 'MAIL_PRIVATE', inboxId(NAME, ADDRESS, 'im1'), now - 0.25 * HOUR),
];
const SECOND_INBOX = [
  row(ALICE, 'MAIL_PRIVATE', inboxId(SECOND, ADDRESS, 'b01'), now - 2 * HOUR),
  row(ZOE, 'MAIL_PRIVATE', inboxId(SECOND, ADDRESS, 'b02'), now - 30 * HOUR),
  row(MARCUS, 'MAIL_PRIVATE', aliasId(SECOND, 'b03'), now - 50 * HOUR),
];
const ALIAS_INBOX = [
  row(ALICE, 'MAIL_PRIVATE', aliasId(ALIAS, 'a01'), now - 1 * HOUR),
  row(ZOE, 'MAIL_PRIVATE', aliasId(ALIAS, 'a02'), now - 26 * HOUR),
  row(MARCUS, 'MAIL_PRIVATE', aliasId(ALIAS, 'a03'), now - 80 * HOUR),
];
const SENT = [
  row(NAME, 'MAIL_PRIVATE', inboxId(ALICE, ALICE_ADDRESS, 's01'), now - 3 * HOUR),
  row(NAME, 'MAIL_PRIVATE', inboxId(ALICE, ALICE_ADDRESS, 's02'), now - 20 * HOUR),
  row(NAME, 'MAIL_PRIVATE', inboxId(ALICE, ALICE_ADDRESS, 's03'), now - 44 * HOUR),
  row(NAME, 'MAIL_PRIVATE', inboxId(ZOE, ZOE_ADDRESS, 's04'), now - 7 * HOUR),
  row(NAME, 'MAIL_PRIVATE', inboxId(ZOE, ZOE_ADDRESS, 's05'), now - 100 * HOUR),
  row(NAME, 'MAIL_PRIVATE', aliasId(ALIAS, 's06'), now - 12 * HOUR),
  row(NAME, 'MAIL_PRIVATE', inboxId(MARCUS, MARCUS_ADDRESS, 's07'), now - 200 * HOUR),
  row(SECOND, 'MAIL_PRIVATE', inboxId(ALICE, ALICE_ADDRESS, 's08'), now - 9 * HOUR),
  // A deleted sent message (tombstone): must stay hidden in the Sent list.
  row(NAME, 'MAIL_PRIVATE', inboxId(ALICE, ALICE_ADDRESS, 's09'), now - 60 * HOUR, { title: '__qmail_deleted__', tags: ['qmail-deleted'] }),
];
const THREADS = [
  { token: 't1', name: ALICE, title: 'Welcome to the builders group', created: now - 300 * HOUR },
  { token: 't2', name: NAME, title: 'Release checklist for Q-Mail+ 4.0', created: now - 72 * HOUR },
  { token: 't3', name: ZOE, title: 'Translating the apps: who takes which language?', created: now - 40 * HOUR },
  { token: 't4', name: MARCUS, title: 'Thread whose title lives only in the JSON header', created: now - 10 * HOUR, noDescription: true },
];
const THREAD_ROWS = [
  ...THREADS.map((t) => row(t.name, 'MAIL', threadId(t.token), t.created, t.noDescription ? undefined : { description: t.title })),
  // Group 70 shares the substring query of group 7 and must be filtered out.
  row(ALICE, 'MAIL', `qortal_qmail_thread_group70_zz`, now - HOUR, { description: 'Not our group' }),
];
const POSTS = [
  { id: postId('t1', 'p1'), name: ALICE, token: 't1', created: now - 299 * HOUR, html: '<p>Welcome, everyone. This thread is for introductions.</p><ul><li>say hello</li><li>tell us what you build</li></ul>' },
  { id: postId('t1', 'p2'), name: NAME, token: 't1', created: now - 250 * HOUR, html: '<p>Hi all, I work on the <strong>+ apps</strong>.</p>' },
  { id: postId('t1', 'p3'), name: ZOE, token: 't1', created: now - 6 * HOUR, html: '<p>Hej! Jag översätter apparna till svenska.</p><pre class="ql-syntax" spellcheck="false">npm run build\n</pre>' },
  { id: postId('t2', 'p1'), name: NAME, token: 't2', created: now - 71 * HOUR, html: '<p>Checklist:</p><ol><li>build</li><li>screens</li><li>Hub check</li></ol>' },
  { id: postId('t3', 'p1'), name: ZOE, token: 't3', created: now - 39 * HOUR, html: '<p>Swedish is taken.</p>' },
  { id: postId('t4', 'p1'), name: MARCUS, token: 't4', created: now - 9 * HOUR, html: '<p>The description was left empty on purpose.</p>' },
];
const POST_ROWS = POSTS.map((p) => row(p.name, 'MAIL_PRIVATE', p.id, p.created));
const THUMB_ROWS = [row(ALICE, 'THUMBNAIL', `qortal_group_avatar_${GROUP_ID}`, now - 500 * HOUR)];
const ALL_ROWS = [...INBOX, ...LOOKALIKE_INBOX, ...SECOND_INBOX, ...ALIAS_INBOX, ...SENT, ...THREAD_ROWS, ...POST_ROWS, ...THUMB_ROWS];

// ---- decrypted bodies (data contract §3a, §7) ------------------------------
const BODY_HTML =
  '<p>Hi there,</p><p>Here are the files from the <strong>coast trip</strong>, plus the notes we talked about:</p><ul><li>photos from the harbour</li><li>the spec sheet, as a PDF</li><li>a short voice note</li></ul><p>The build command, for reference:</p><pre class="ql-syntax" spellcheck="false">cd "apps/Q-Mail+" &amp;&amp; npm run build\n</pre><p>Links open in Hub: <a href="qortal://APP/Q-Share" rel="noopener noreferrer" target="_blank">qortal://APP/Q-Share</a></p><p>— sent from a phone</p>';

const LOCKED = new Set([inboxId(NAME, ADDRESS, 'm04'), inboxId(NAME, ADDRESS, 'm09'), inboxId(NAME, ADDRESS, 'm15'), inboxId(NAME, ADDRESS, 'm23')]);

/** The in-memory shape of an earlier message that a reply carries in threadV2. */
const earlierMessage = (identifier, user, createdAt) => ({
  id: identifier,
  identifier,
  user,
  name: user,
  subject: 'Minting rewards this week',
  createdAt,
  version: 1,
  attachments: [],
  textContentV2: '<p>Did the rewards land for everyone this week? Mine came through on Tuesday.</p>',
  generalData: { thread: [], threadV2: [] },
  recipient: user === NAME ? ALICE : NAME,
});

const mailBody = (r, index, recipientName) => {
  const subject = SUBJECTS[index % SUBJECTS.length];
  const hasFiles = index === 0; // m01: the four-attachment message the screens open
  // m01 also carries one earlier message, so "Show earlier" renders in the reader.
  const isReply = subject.startsWith('Re:') || index === 0;
  const earlierId = inboxId(r.name, OWNERS[r.name] || ADDRESS, `e${index}`);
  return {
    subject,
    createdAt: r.created,
    version: 1,
    attachments: hasFiles ? attachmentRefs(r.name) : [],
    textContentV2: hasFiles
      ? BODY_HTML
      : `<p>Message ${index + 1} from ${r.name}.</p><ul><li>one</li><li>two</li></ul><pre class="ql-syntax" spellcheck="false">echo "${index + 1}"\n</pre>`,
    generalData: {
      thread: [],
      threadV2: isReply
        ? [{ reference: { identifier: earlierId, name: recipientName, service: 'MAIL_PRIVATE' }, data: earlierMessage(earlierId, recipientName, r.created - 3 * HOUR) }]
        : [],
    },
    recipient: recipientName,
    // m01 went to two more people in Cc (the + app's additive to/cc fields),
    // so Reply all fills the composer's Cc row.
    to: hasFiles ? [recipientName] : recipientName,
    // Five Cc names, one long: the reader folds them into "and 2 more".
    cc: hasFiles ? [ZOE, MARCUS, SECOND, SIMON, LONG_NAME] : [],
  };
};

const BODIES = {};
INBOX.forEach((r, i) => {
  BODIES[r.identifier] = mailBody(r, i, NAME);
});
SECOND_INBOX.forEach((r, i) => {
  BODIES[r.identifier] = mailBody(r, i + 3, SECOND);
});
LOOKALIKE_INBOX.forEach((r, i) => {
  BODIES[r.identifier] = {
    ...mailBody(r, i + 5, NAME),
    subject: ['Q-Mail+ test build is ready', 'Urgent: confirm your wallet for the airdrop'][i],
    textContentV2: `<p>Message from ${r.name}.</p>`,
  };
});
// A 1.0.1 reply: references only, oldest first (earlier-refs).
const historyRef = (name, identifier) => ({ reference: { identifier, name, service: 'MAIL_PRIVATE' } });
BODIES[LOOKALIKE_INBOX[0].identifier].generalData.threadV2 = [
  historyRef(SECOND, inboxId(NAME, ADDRESS, 'm02')),
  historyRef(MARCUS, inboxId(NAME, ADDRESS, 'm04')), // locked: not sent to us
  historyRef(NAME, inboxId(ALICE, ALICE_ADDRESS, 's09')), // our deleted sent message (tombstone)
  historyRef(SIMON, inboxId(NAME, ADDRESS, 'gone')), // the node can't fetch it
  historyRef(ZOE, inboxId(NAME, ADDRESS, 'm03')),
  historyRef(NAME, inboxId(ALICE, ALICE_ADDRESS, 's02')), // our own reply, sent by us
];
ALIAS_INBOX.forEach((r, i) => {
  BODIES[r.identifier] = { ...mailBody(r, i + 5, ALIAS), recipient: NAME, to: ALIAS };
});
SENT.forEach((r, i) => {
  const recipient = [ALICE, ALICE, ALICE, ZOE, ZOE, ALIAS, MARCUS, ALICE, ALICE][i];
  BODIES[r.identifier] = {
    subject: ['Thanks for the photos', 'Re: Minting rewards this week', 'Meetup notes', 'Översättning', 'Re: Translating', 'Ticket #42', 'Logs attached', 'From my second name', '__qmail_deleted__'][i],
    createdAt: r.created,
    version: 1,
    attachments: [],
    textContentV2: `<p>Sent message ${i + 1} to ${recipient}.</p>`,
    generalData: { thread: [], threadV2: [] },
    recipient: recipient === ALIAS ? ALICE : recipient,
  };
});
THREADS.forEach((t) => {
  BODIES[threadId(t.token)] = { title: t.title, groupId: String(GROUP_ID), createdAt: t.created, name: t.name };
});
POSTS.forEach((p) => {
  const thread = THREADS.find((t) => t.token === p.token);
  BODIES[p.id] = {
    subject: thread.title,
    createdAt: p.created,
    version: 1,
    attachments: p.id === postId('t1', 'p3') ? attachmentRefs(p.name).slice(0, 2) : [],
    textContentV2: p.html,
    name: p.name,
    threadOwner: thread.name,
  };
});

// ---- local state the app reads at boot (data contract §12) -----------------
const utf8b64 = (value) => Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
/** What ENCRYPT_DATA hands back for a subject, and what the cache stores. */
const encryptedSubject = (subject) => `ENCSUBJ:${utf8b64(subject)}`;

const SUBJECT_CACHE = {};
INBOX.slice(0, 14).forEach((r, i) => {
  if (LOCKED.has(r.identifier)) return;
  const body = BODIES[r.identifier];
  SUBJECT_CACHE[r.identifier] = { timestamp: r.created, subject: body.subject ? encryptedSubject(body.subject) : '', attachments: body.attachments.length > 0 };
});
const READ_STATE = {};
[0, 2, 4, 5, 7, 10, 11, 13].forEach((i) => {
  READ_STATE[INBOX[i].identifier] = INBOX[i].created + 60_000;
});
const ARCHIVED = {
  [INBOX[6].identifier]: { at: now - 2 * HOUR },
  [INBOX[11].identifier]: { at: now - 30 * HOUR },
  [INBOX[16].identifier]: { at: now - 70 * HOUR },
};
const DRAFTS = {
  [`${NAME.toLowerCase()}::${ALICE.toLowerCase()}`]: {
    draftId: `${NAME}-${ALICE}-Draft-${now - HOUR}`,
    fromName: NAME,
    toName: ALICE,
    subject: 'Notes for the meetup',
    value: '<p>Hi Alice,</p><p>Here is what I have so far:</p><ul><li>venue</li><li>agenda</li></ul>',
    aliasValue: '',
    showAlias: false,
    showBCC: false,
    bccNames: [],
    updatedAt: now - HOUR,
    attachments: [{ name: 'agenda.pdf', size: 120_000, type: 'application/pdf' }],
  },
  [`thread::${GROUP_ID}::new`]: {
    draftId: `${NAME}-${GROUP_NAME}-Draft-${now - 5 * HOUR}`,
    fromName: NAME,
    toName: GROUP_NAME,
    subject: 'Next release',
    value: '<p>Shall we aim for Friday?</p>',
    aliasValue: '',
    showAlias: false,
    showBCC: false,
    bccNames: [],
    updatedAt: now - 5 * HOUR,
    kind: 'thread',
    groupId: String(GROUP_ID),
    groupName: GROUP_NAME,
    threadId: null,
    threadTitle: 'Next release',
  },
};
const LOCAL_STORAGE = {
  'qmail-general-consent': 'true',
  'tourStatus-qmail': 'dismissed',
  [`qmail_persistance_${NAME}`]: JSON.stringify(SUBJECT_CACHE),
  [`qmail_read_state_${ADDRESS}`]: JSON.stringify(READ_STATE),
  [`qmail_archived_${ADDRESS}`]: JSON.stringify(ARCHIVED),
  [`qmail_compose_drafts_${ADDRESS}`]: JSON.stringify(DRAFTS),
  [`qmail_watched_aliases_${ADDRESS}`]: JSON.stringify([ALIAS]),
  [`qmail_alias_reply_links_${ADDRESS}`]: JSON.stringify({ [ALIAS]: 'helpdesk-reply' }),
};

const json = (route, data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });

// ---- Playwright helpers used by the screens --------------------------------
const waitForInbox = (page) => page.waitForSelector('[data-message-row]', { timeout: 10000 }).catch(() => {});

/**
 * Click a navigation target by accessible name: the bottom bar, the rail or
 * the floating Compose when one is on screen, else the item inside the
 * mailboxes drawer (phones and 700 px Hub panes keep the rail in a drawer).
 */
async function goTo(page, name) {
  await waitForInbox(page);
  const direct = page.getByRole('button', { name });
  if ((await direct.count()) && (await direct.first().isVisible())) {
    await direct.first().click({ timeout: 2500 });
    return;
  }
  const menu = page.getByRole('button', { name: 'Open mailboxes menu' });
  if (await menu.count()) {
    await menu.first().click({ timeout: 2500 });
    await page.waitForTimeout(250);
  }
  await page.getByRole('button', { name }).first().click({ timeout: 4000 });
}

async function openMessage(page) {
  await waitForInbox(page);
  // The inbox groups by sender: expand Alice's group, then open m01 (the
  // four-attachment message, whose subject is in the local cache).
  const group = page.getByRole('button', { name: /^Alice Wonder/ }).first();
  if ((await group.getAttribute('aria-expanded')) === 'false') await group.click({ timeout: 4000 });
  await page.getByRole('button', { name: /Photos, notes and the spec/ }).first().click({ timeout: 4000 });
  await page.waitForSelector('article', { timeout: 8000 }).catch(() => {});
  // Playwright's tap leaves a mouse pointer where the row was, over the
  // reader's Archive / Mark unread icons, and their hover tooltips would open;
  // a real phone has no pointer there.
  await page.mouse.move(1, 1);
  await page.waitForTimeout(300);
}

/** Open the impostor's message: the reader's From line carries the strike. */
async function openImpostorMessage(page) {
  await waitForInbox(page);
  // One message, so the sender has a row of its own (locked until opened).
  await page.getByRole('button', { name: new RegExp(IMPOSTOR) }).first().click({ timeout: 4000 });
  await page.waitForSelector('article', { timeout: 8000 }).catch(() => {});
  await page.mouse.move(1, 1);
  await page.waitForTimeout(300);
}

async function openAttachment(page, label) {
  await openMessage(page);
  await page.getByRole('button', { name: label }).first().click({ timeout: 4000 });
  await page.waitForSelector('[role=dialog]', { timeout: 6000 }).catch(() => {});
}

async function openThreads(page) {
  await goTo(page, /^Threads/);
  await page.waitForSelector('text=Groups', { timeout: 8000 }).catch(() => {});
}

async function openGroup(page) {
  await openThreads(page);
  await page.getByRole('button', { name: new RegExp(GROUP_NAME) }).first().click({ timeout: 4000 });
  await page.waitForSelector(`text=${THREADS[1].title}`, { timeout: 8000 }).catch(() => {});
}

export default {
  name: NAME,
  themeKey: 'qmailplus-ui-theme',
  dismiss: [],

  async setup({ browser }) {
    const gen = await browser.newPage({ viewport: { width: 64, height: 64 } });
    await gen.setContent('<div style="width:64px;height:64px;background:linear-gradient(135deg,#f59e0b,#3b82f6)"></div>');
    PNG = await gen.screenshot({ clip: { x: 0, y: 0, width: 64, height: 64 } });
    await gen.close();
  },

  // Consent and the first-run tips already seen; drafts, read state, the
  // archive, the subject cache and the watched alias in place before boot.
  initScripts: () => [
    `try { const entries = ${JSON.stringify(LOCAL_STORAGE)}; for (const k in entries) localStorage.setItem(k, entries[k]); } catch (e) {}`,
  ],

  // Runs in the page: defines window.__qplusAnswer(request).
  qortal: () => `
    const NAME = ${JSON.stringify(NAME)};
    const ADDRESS = ${JSON.stringify(ADDRESS)};
    const OWNERS = ${JSON.stringify(OWNERS)};
    const BODIES = ${JSON.stringify(BODIES)};
    const LOCKED = new Set(${JSON.stringify([...LOCKED])});
    const FILES = {
      ${JSON.stringify(ATTACHMENTS[0].identifier)}: ${JSON.stringify(PNG.toString('base64'))},
      ${JSON.stringify(ATTACHMENTS[1].identifier)}: ${JSON.stringify(Buffer.from(TEXT, 'utf8').toString('base64'))},
      ${JSON.stringify(ATTACHMENTS[2].identifier)}: ${JSON.stringify(PDF.toString('base64'))},
      ${JSON.stringify(ATTACHMENTS[3].identifier)}: ${JSON.stringify(WAV.toString('base64'))},
    };
    const PROPS = ${JSON.stringify(Object.fromEntries(ATTACHMENTS.map((a) => [a.identifier, { filename: a.originalFilename, mimeType: a.type }])))};
    const AVATARS = new Set(${JSON.stringify([NAME, SECOND, ALICE, MARCUS])});
    const utf8b64 = (value) => {
      const bytes = new TextEncoder().encode(JSON.stringify(value));
      let bin = '';
      bytes.forEach((b) => { bin += String.fromCharCode(b); });
      return btoa(bin);
    };
    const decline = () => { throw { error: 'User declined request' }; };
    window.__qplusAnswer = async (p) => {
      switch (p.action) {
        case 'GET_USER_ACCOUNT': return { address: ADDRESS, publicKey: 'pk_' + ADDRESS };
        case 'GET_ACCOUNT_NAMES': return [{ name: NAME, owner: ADDRESS }, { name: ${JSON.stringify(SECOND)}, owner: ADDRESS }];
        case 'GET_PRIMARY_NAME': return NAME;
        case 'GET_NAME_DATA': {
          const owner = OWNERS[String(p.name || '').trim()];
          return owner ? { name: String(p.name).trim(), owner } : {};
        }
        case 'GET_ACCOUNT_DATA': return { address: p.address, publicKey: 'pk_' + p.address };
        case 'SEARCH_NAMES': {
          const q = String(p.query || '').toLowerCase();
          return Object.keys(OWNERS).filter((n) => n.toLowerCase().startsWith(q)).map((n) => ({ name: n, owner: OWNERS[n] }));
        }
        case 'GET_QDN_RESOURCE_URL':
          if (p.service === 'THUMBNAIL') {
            if (String(p.identifier).startsWith('qortal_group_avatar_') || AVATARS.has(p.name)) {
              return '/arbitrary/THUMBNAIL/' + encodeURIComponent(p.name) + '/' + encodeURIComponent(p.identifier);
            }
            return 'Resource does not exist';
          }
          return '/arbitrary/' + p.service + '/' + encodeURIComponent(p.name) + '/' + encodeURIComponent(p.identifier);
        case 'GET_QDN_RESOURCE_STATUS': return { status: 'READY', percentLoaded: 100, localChunkCount: 1, totalChunkCount: 1 };
        case 'GET_QDN_RESOURCE_PROPERTIES': return PROPS[p.identifier] || { filename: 'file.bin', mimeType: 'application/octet-stream' };
        case 'FETCH_QDN_RESOURCE': {
          if (p.service === 'DOCUMENT_PRIVATE') throw { error: 'Resource does not exist' };
          if (String(p.identifier).endsWith('_mail_gone')) throw { error: 'Resource does not exist' };
          if (p.service === 'MAIL' && p.encoding !== 'base64') return BODIES[p.identifier] || null; // thread header JSON
          return 'ENCRES:' + p.service + ':' + p.identifier;
        }
        case 'DECRYPT_DATA': {
          const token = String(p.encryptedData || '');
          if (token.startsWith('ENCSUBJ:')) return token.slice('ENCSUBJ:'.length);
          if (!token.startsWith('ENCRES:')) throw { error: 'Unable to decrypt' };
          const [, service, ...rest] = token.split(':');
          const identifier = rest.join(':');
          if (LOCKED.has(identifier)) throw { error: 'Unable to decrypt' };
          if (service === 'ATTACHMENT_PRIVATE') {
            if (!FILES[identifier]) throw { error: 'Unable to decrypt' };
            return FILES[identifier];
          }
          const body = BODIES[identifier];
          if (!body) throw { error: 'Unable to decrypt' };
          return utf8b64(body);
        }
        case 'ENCRYPT_DATA': return 'ENCSUBJ:' + p.data64;
        case 'GET_LIST_ITEMS': return [];
        case 'SHOW_PDF_READER':
          // A screen sets window.__noPdfReader to play an older Hub or GO without
          // Hub's reader, so the card falls back to the bundled pdf.js viewer.
          if (window.__noPdfReader) throw { error: 'Unknown action: SHOW_PDF_READER' };
          return true;
        case 'ADD_LIST_ITEMS': case 'DELETE_LIST_ITEM': case 'NOTIFICATION_MARK_SEEN': return true;
        case 'PUBLISH_QDN_RESOURCE': case 'PUBLISH_MULTIPLE_QDN_RESOURCES': case 'SAVE_FILE': case 'SEND_COIN': return decline();
        default: return null;
      }
    };
  `,

  // Core endpoints the app fetches directly. Return true when answered.
  async route(route, url) {
    const p = url.pathname;
    const sp = url.searchParams;
    if (p.endsWith('/resources/search')) {
      const service = sp.get('service');
      // Core takes several names (the merged probes send all owned names).
      const names = sp.getAll('name');
      const ident = (sp.get('identifier') || '').toLowerCase();
      const query = (sp.get('query') || '').toLowerCase();
      let list = ALL_ROWS.filter((r) => {
        if (service && r.service !== service) return false;
        if (names.length && !names.includes(r.name)) return false;
        if (ident && !r.identifier.toLowerCase().includes(ident)) return false;
        if (query) {
          const hay = [r.identifier, r.name, r.metadata?.title || '', r.metadata?.description || ''].join('\n').toLowerCase();
          if (!hay.includes(query)) return false;
        }
        return true;
      });
      list = [...list].sort((a, b) => (sp.get('reverse') === 'false' ? a.created - b.created : b.created - a.created));
      if (sp.get('includemetadata') === 'false') list = list.map(({ metadata: _m, ...rest }) => rest);
      const offset = Number(sp.get('offset') || 0);
      const limit = Number(sp.get('limit') || 20);
      await json(route, list.slice(offset, offset + limit));
      return true;
    }
    if (p.startsWith('/groups/member/')) {
      return json(route, [{ groupId: GROUP_ID, groupName: GROUP_NAME, owner: ALICE_ADDRESS, isOpen: false, memberCount: 4, created: now - 1000 * HOUR }]).then(() => true);
    }
    if (p.startsWith('/groups/members/')) {
      return json(route, {
        members: [
          { member: ALICE_ADDRESS, isAdmin: true, joined: now - 1000 * HOUR },
          { member: ADDRESS, isAdmin: false, joined: now - 800 * HOUR },
          { member: ZOE_ADDRESS, isAdmin: false, joined: now - 600 * HOUR },
          { member: MARCUS_ADDRESS, isAdmin: false, joined: now - 400 * HOUR },
          { member: NAMELESS_ADDRESS, isAdmin: false, joined: now - 100 * HOUR },
        ],
      }).then(() => true);
    }
    if (p.startsWith('/names/address/')) {
      const address = decodeURIComponent(p.slice('/names/address/'.length));
      const found = Object.entries(OWNERS).filter(([, owner]) => owner === address).map(([n, owner]) => ({ name: n, owner }));
      // The primary name first, as Core does.
      found.sort((a, b) => (a.name === NAME ? -1 : b.name === NAME ? 1 : 0));
      return json(route, found).then(() => true);
    }
    const send = (contentType, body) => route.fulfill({ status: 200, contentType, body }).then(() => true);
    if (p.includes('/THUMBNAIL/')) return send('image/png', PNG);
    return false;
  },

  // overlay: a sheet, dialog or menu is open, so capture the viewport, not the full page.
  screens: [
    { key: 'inbox', path: '/', after: waitForInbox },
    { key: 'inbox-open', path: '/', after: openMessage },
    { key: 'impostor-open', path: '/', after: openImpostorMessage },
    { key: 'archived', path: '/', after: async (page) => { await goTo(page, /^Archived/); await waitForInbox(page); } },
    { key: 'sent', path: '/', after: async (page) => { await goTo(page, /^Sent/); await page.waitForSelector('text=To:', { timeout: 8000 }).catch(() => {}); } },
    {
      key: 'sent-delete',
      path: '/',
      overlay: true,
      after: async (page) => {
        await goTo(page, /^Sent/);
        await page.getByRole('button', { name: 'Delete sent message' }).first().click({ timeout: 8000 });
        await page.waitForSelector('[role=dialog]', { timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(300);
      },
    },
    { key: 'aliases', path: '/', after: async (page) => { await goTo(page, /^Aliases/); await page.waitForSelector(`text=${ALIAS}`, { timeout: 8000 }).catch(() => {}); } },
    {
      // One capped run of the paged alias scan: page progress and coverage.
      key: 'alias-scan',
      path: '/',
      after: async (page) => {
        await goTo(page, /^Aliases/);
        await page.getByRole('button', { name: /^(Start alias scan|Scan more|Check new mail)$/ }).first().click({ timeout: 8000 });
        await page.waitForSelector('[data-testid=alias-scan-coverage]', { timeout: 10000 }).catch(() => {});
        await page.getByRole('button', { name: /^(Scan more|Check new mail)$/ }).first().waitFor({ timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(300);
      },
    },
    {
      key: 'alias-inbox',
      path: '/',
      after: async (page) => {
        await goTo(page, /^Aliases/);
        await page.getByRole('button', { name: 'Open Inbox' }).first().click({ timeout: 8000 });
        await waitForInbox(page);
      },
    },
    { key: 'drafts', path: '/', after: async (page) => { await goTo(page, /^Drafts/); await page.waitForSelector('text=Notes for the meetup', { timeout: 8000 }).catch(() => {}); } },
    { key: 'threads', path: '/', after: openThreads },
    { key: 'group', path: '/', after: openGroup },
    {
      key: 'thread',
      path: '/',
      after: async (page) => {
        await openGroup(page);
        await page.getByRole('button', { name: new RegExp(THREADS[0].title) }).first().click({ timeout: 4000 });
        await page.waitForSelector('article', { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(300);
      },
    },
    {
      // Files being attached, as tiles in rows (a photo, a long-named text file, a PDF).
      key: 'compose-attachments',
      path: '/',
      after: async (page) => {
        await goTo(page, /^Compose$/);
        await page.waitForSelector('.ql-editor', { timeout: 8000 }).catch(() => {});
        await page.locator('input[type=file]').first().setInputFiles([
          { name: 'harbour-photo.png', mimeType: 'image/png', buffer: PNG },
          { name: 'meeting notes for the Qortal builders call.txt', mimeType: 'text/plain', buffer: Buffer.from('Agenda: Q-Mail+ 1.0.1') },
          { name: 'spec-sheet.pdf', mimeType: 'application/pdf', buffer: Buffer.from(makePdf('Spec sheet')) },
        ]);
        await page.getByRole('list', { name: 'Attachments' }).waitFor({ timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(300);
      },
    },
    {
      key: 'compose-attachment-preview',
      path: '/',
      overlay: true,
      after: async (page) => {
        await goTo(page, /^Compose$/);
        await page.waitForSelector('.ql-editor', { timeout: 8000 }).catch(() => {});
        await page.locator('input[type=file]').first().setInputFiles([{ name: 'harbour-photo.png', mimeType: 'image/png', buffer: PNG }]);
        await page.getByRole('button', { name: 'Preview harbour-photo.png' }).click({ timeout: 4000 });
        await page.waitForSelector('[role=dialog] img', { timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(300);
      },
    },
    {
      // To, Cc and Bcc open, with a name checked into Cc.
      key: 'compose',
      path: '/',
      after: async (page) => {
        await goTo(page, /^Compose$/);
        await page.waitForSelector('.ql-editor', { timeout: 8000 }).catch(() => {});
        await page.getByPlaceholder('Type a name or joined group').first().fill(ALICE);
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: /^Cc$/ }).first().click({ timeout: 4000 });
        await page.getByRole('button', { name: /^Bcc$/ }).first().click({ timeout: 4000 });
        const cc = page.getByRole('textbox', { name: 'Cc name' }).first();
        await cc.fill(ZOE);
        await cc.press('Enter');
        await page.getByRole('button', { name: new RegExp(ZOE) }).first().waitFor({ timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(300);
      },
    },
    {
      // The To suggestions for "Simon": the real name and the struck impostor.
      key: 'compose-names',
      path: '/',
      overlay: true,
      after: async (page) => {
        await goTo(page, /^Compose$/);
        await page.waitForSelector('.ql-editor', { timeout: 8000 }).catch(() => {});
        await page.getByPlaceholder('Type a name or joined group').first().fill('Simon');
        await page.getByRole('option', { name: new RegExp(IMPOSTOR) }).first().waitFor({ timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(300);
      },
    },
    {
      key: 'reply',
      path: '/',
      after: async (page) => {
        await openMessage(page);
        await page.getByRole('button', { name: /^Reply$/ }).first().click({ timeout: 4000 });
        await page.waitForSelector('.ql-editor', { timeout: 8000 }).catch(() => {});
      },
    },
    {
      // m01 has five Cc names: Reply all puts them in the composer's Cc row.
      key: 'reply-all',
      path: '/',
      after: async (page) => {
        await openMessage(page);
        await page.getByRole('button', { name: /^Reply all$/ }).first().click({ timeout: 4000 });
        await page.waitForSelector('.ql-editor', { timeout: 8000 }).catch(() => {});
        await page.getByRole('button', { name: new RegExp(MARCUS) }).first().waitFor({ timeout: 4000 }).catch(() => {});
        await page.waitForTimeout(300);
      },
    },
    {
      // A 1.0.1 reply: its earlier messages load by reference on Show earlier.
      key: 'earlier-refs',
      path: '/',
      after: async (page) => {
        await waitForInbox(page);
        await page.getByRole('button', { name: new RegExp(SIMON) }).first().click({ timeout: 4000 });
        await page.waitForSelector('article', { timeout: 8000 }).catch(() => {});
        await page.getByRole('button', { name: /^Show earlier/ }).first().click({ timeout: 4000 });
        await page.getByText('This message could not be loaded.').first().waitFor({ timeout: 8000 }).catch(() => {});
        await page.getByText('Sent message 2 to').first().waitFor({ timeout: 8000 }).catch(() => {});
        await page.getByRole('button', { name: /^Show 1 older message/ }).first().scrollIntoViewIfNeeded().catch(() => {});
        await page.mouse.move(1, 1);
        await page.waitForTimeout(400);
      },
    },
    { key: 'attachment-image', path: '/', overlay: true, after: async (page) => { await openAttachment(page, /^Open coast-photo\.png/); await page.waitForSelector('[role=dialog] img', { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(300); } },
    // The PDF card, as in Q-Share+: Open PDF hands the decrypted file to Hub's
    // own reader (answered by the mock), then Download turns into Save.
    { key: 'attachment-pdf', path: '/', after: async (page) => { await openMessage(page); await page.getByRole('button', { name: /^Open PDF spec-sheet\.pdf/ }).first().click({ timeout: 4000 }); await page.getByRole('button', { name: /^Save spec-sheet\.pdf/ }).first().waitFor({ timeout: 8000 }).catch(() => {}); await page.waitForTimeout(400); } },
    // Without Hub's reader (older Hub, GO) the same button opens the bundled viewer.
    { key: 'attachment-pdf-viewer', path: '/', overlay: true, after: async (page) => { await openMessage(page); await page.evaluate(() => { window.__noPdfReader = true; }); await page.getByRole('button', { name: /^Open PDF spec-sheet\.pdf/ }).first().click({ timeout: 4000 }); await page.waitForSelector('[role=dialog] canvas', { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(600); } },
    {
      key: 'search-all',
      path: '/',
      after: async (page) => {
        await waitForInbox(page);
        const box = page.getByRole('searchbox', { name: /^Search/ }).first();
        await box.fill('minting');
        await page.getByRole('button', { name: 'All mail' }).first().click({ timeout: 4000 });
        await page.waitForSelector('text=across your mail', { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(500);
      },
    },
    { key: 'settings', path: '/settings', after: async (page) => page.waitForSelector('text=Appearance', { timeout: 8000 }).catch(() => {}) },
    {
      // Settings → Mail → Show group threads off, then back to mail: no Threads
      // in the rail or the bottom bar (four items on phones).
      key: 'threads-hidden',
      path: '/settings',
      after: async (page) => {
        await page.waitForSelector('text=Appearance', { timeout: 8000 }).catch(() => {});
        await page.getByRole('switch', { name: 'Show group threads' }).first().click({ timeout: 4000 });
        await page.getByRole('button', { name: 'Back to mail' }).first().click({ timeout: 4000 });
        await waitForInbox(page);
        await page.waitForTimeout(300);
      },
    },
    { key: 'whats-new', path: '/settings', overlay: true, after: async (page) => { await page.waitForSelector('text=Appearance', { timeout: 8000 }).catch(() => {}); await page.getByRole('button', { name: "What's new" }).first().click({ timeout: 4000 }); await page.waitForSelector('text=The first Q-Mail+ release', { timeout: 8000 }).catch(() => {}); await page.waitForTimeout(300); } },
    {
      // A row's menu: right click here; a long press on a phone opens the same (a sheet below 600 px).
      key: 'row-menu',
      path: '/',
      overlay: true,
      after: async (page) => {
        await waitForInbox(page);
        const row = page.locator('[data-message-row] button').first();
        await row.click({ button: 'right', position: { x: 60, y: 20 }, timeout: 4000 });
        await page.getByRole('menuitem').first().waitFor({ timeout: 3000 }).catch(() => {});
        await page.getByRole('button', { name: 'Archive' }).first().waitFor({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(400);
      },
    },
    {
      // A row's attachments without opening it: the paperclip, else "Attachments" in the row's menu.
      key: 'row-attachments',
      path: '/',
      overlay: true,
      after: async (page) => {
        await waitForInbox(page);
        const clip = page.getByRole('button', { name: /^Attachments: / }).first();
        const hasClip = await clip.waitFor({ timeout: 3000 }).then(() => true, () => false);
        if (hasClip) {
          await clip.click({ timeout: 4000 });
        } else {
          await page.locator('[data-message-row] button').first().click({ button: 'right', position: { x: 60, y: 20 }, timeout: 4000 });
          // A menu item from 600 px, a button in the phone sheet.
          await page.getByRole('menuitem', { name: 'Attachments' }).or(page.getByRole('button', { name: 'Attachments', exact: true })).first().click({ timeout: 3000 });
        }
        await page.getByText('coast-photo.png').first().waitFor({ timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(400);
      },
    },
    { key: 'menu', path: '/', mobileOnly: true, overlay: true, after: async (page) => { await waitForInbox(page); await page.getByRole('button', { name: 'Open mailboxes menu' }).first().click({ timeout: 2500 }); await page.waitForTimeout(400); } },
    {
      key: 'shortcuts',
      path: '/',
      overlay: true,
      after: async (page) => {
        await waitForInbox(page);
        // Keyboard shortcuts exist on the desktop layout only (≥ 900 px).
        await page.keyboard.press('?');
        await page.waitForSelector('[data-qmail-shortcuts-help]', { timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(300);
      },
    },
  ],
};
