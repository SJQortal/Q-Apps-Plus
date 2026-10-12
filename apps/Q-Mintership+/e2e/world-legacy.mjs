/**
 * The original Q-Mintership's data in the mock world (read-only History):
 * nomination cards (BLOG_POST Minter-board-card-*), Minter Admin proposals
 * (QM-AR-card-*), their comments and chain polls, and one encrypted admin
 * card (MAIL_PRIVATE card-MAC-*). Shapes follow what a mainnet node answered
 * on 2026-10-12; every name, address and text here is made up.
 *
 * world.legacy = { resources: [{ service, name, identifier, created, updated?, body }], polls }
 * Tests can push more resources or polls before rendering.
 */
import { ADDR, NOW, PEOPLE, fakeKey } from './world.mjs';

const DAY = 86_400_000;

/** Add the old boards' records to `world`. */
export function extendLegacy(world) {
  const resources = [];
  const polls = {};
  const addressOf = (name) => world.names.get(name) ?? null;
  const add = (service, name, identifier, created, body, updated) =>
    resources.push({ service, name, identifier, created, body, ...(updated ? { updated } : {}) });
  const poll = (cardId, ownerName, yes, no) => {
    polls[`${cardId}-poll`] = {
      owner: addressOf(ownerName),
      description: `Mintership Board Poll for a nominee (published by ${ownerName})`,
      published: NOW - 30 * DAY,
      yes,
      no,
    };
  };
  const comment = (cardId, name, uid, created, content, replyTo) =>
    add('BLOG_POST', name, `comment-${cardId}-${uid}`, created, {
      content,
      creator: name,
      timestamp: created - 1_000,
      ...(replyTo ? { replyTo } : {}),
    });

  // 1. A nomination from the board's last months: the nominee is signing now.
  const signing = 'Minter-board-card-bQ7xK2';
  const bob = PEOPLE.nominatedSigning.name;
  add('BLOG_POST', PEOPLE.nominator.name, signing, NOW - 6 * DAY, {
    header: `${bob} for the MINTER group`,
    content:
      `<p><strong>${bob}</strong> has run a public node since spring &amp; answers questions in the minting chat most days.</p>` +
      '<p><br></p><p>Builds tools for newcomers:<br>see <a href="qortal://APP/Q-Tube/channel/bob%2Bbuilder">the channel</a>.</p>' +
      '<script>window.__legacyScriptRan = true</script><img src="x" onerror="window.__legacyImgRan = true">' +
      '<ul><li>Node online 24/7</li><li>Helps in Q-Chat</li></ul>',
    links: ['qortal://APP/Q-Tube/channel/bob%2Bbuilder', 'https://example.com/not-a-qortal-link'],
    nominee: bob,
    nomineeAddress: ADDR.nominatedSigning,
    nominator: PEOPLE.nominator.name,
    nominatorAddress: ADDR.nominator,
    creator: bob,
    creatorAddress: ADDR.nominatedSigning,
    publishedBy: PEOPLE.nominator.name,
    publishedByAddress: ADDR.nominator,
    timestamp: NOW - 6 * DAY - 2_000,
    poll: `${signing}-poll`,
  });
  poll(signing, PEOPLE.nominator.name, 9, 1);
  comment(
    signing,
    PEOPLE.admin.name,
    'c0mm01',
    NOW - 5 * DAY,
    '<p>Happy to sign once the invite is up.</p>'
  );
  comment(
    signing,
    bob,
    'c0mm02',
    NOW - 4 * DAY,
    '<p>Thank you all! My node has been up for 200 days.</p><p><br></p>'
  );
  comment(signing, 'Admin B', 'c0mm03', NOW - 3 * DAY, '<p>Signed &#x2705;</p>', {
    identifier: `comment-${signing}-c0mm02`,
    creator: bob,
    timestamp: NOW - 4 * DAY,
    content: '<p>Thank you all! My node has been up for 200 days.</p>',
  });
  // Someone else publishing under the same identifier later is not the card.
  add('BLOG_POST', PEOPLE.left.name, signing, NOW - 2 * DAY, {
    header: 'Not the real card',
    content: '<p>Copy</p>',
    nominee: PEOPLE.left.name,
    nomineeAddress: ADDR.left,
    poll: `${signing}-poll`,
  });

  // 2. An early card the nominee posted for themselves (creator = nominee), later kicked.
  const kicked = 'Minter-board-card-Kt3mPq';
  add(
    'BLOG_POST',
    PEOPLE.kicked.name,
    kicked,
    NOW - 420 * DAY,
    {
      header: 'Please invite me to MINTER',
      content: '<div>I have kept a node online for a year.</div><div>Level 3 and climbing.</div>',
      links: [],
      creator: PEOPLE.kicked.name,
      creatorAddress: ADDR.kicked,
      timestamp: NOW - 420 * DAY,
      poll: `${kicked}-poll`,
    },
    NOW - 410 * DAY
  );
  poll(kicked, PEOPLE.kicked.name, 12, 2);
  for (let i = 0; i < 23; i++) {
    comment(
      kicked,
      i % 2 ? 'Admin C' : PEOPLE.learner.name,
      `k${String(i).padStart(5, '0')}`,
      NOW - (419 - i) * DAY,
      `<p>Comment number ${i + 1} on this card.</p>`
    );
  }

  // 3. A long title, plain-text content (as the MA Helper wrote it), and a poll Core doesn't have.
  const long = 'Minter-board-card-9f2c4e1a7b3d';
  add('BLOG_POST', 'Admin C', long, NOW - 40 * DAY, {
    header:
      'A very long nomination title that keeps going so the History list has to wrap it on a 360 pixel phone screen',
    content:
      'Ünïcode Ñame keeps a node online and translates guides.\n\nActive on 40 distinct days.\nqortal://APP/Q-Blog/ExampleBlog',
    links: [],
    nominee: PEOPLE.expired.name,
    nomineeAddress: ADDR.expired,
    nominatedByName: 'Admin C',
    nominatedByAddress: addressOf('Admin C'),
    nominationCard: true,
    maHelperOrigin: true,
    timestamp: NOW - 40 * DAY,
    poll: `${long}-poll`,
  });

  // 4. Minter Admin proposals (AR board): one to add, one to remove.
  const promote = 'QM-AR-card-Pr0m0t';
  add('BLOG_POST', PEOPLE.admin.name, promote, NOW - 12 * DAY, {
    minterName: PEOPLE.promote.name,
    minterAddress: ADDR.promote,
    header: `Make ${PEOPLE.promote.name} a Minter Admin`,
    content: '<p>Signs quickly and reads every card.</p>',
    links: [],
    creator: PEOPLE.admin.name,
    timestamp: NOW - 12 * DAY,
    poll: `${promote}-poll`,
    promotionCard: true,
  });
  poll(promote, PEOPLE.admin.name, 6, 0);
  comment(promote, 'Admin D ΑΩ', 'ar0001', NOW - 11 * DAY, '<p>Agreed.</p>');
  const demote = 'QM-AR-card-D3m0te';
  add('BLOG_POST', 'Admin D ΑΩ', demote, NOW - 70 * DAY, {
    minterName: PEOPLE.demote.name,
    minterAddress: ADDR.demote,
    header: 'Step down as Minter Admin?',
    content: '<p>Has not signed in a while.</p>',
    links: [],
    creator: 'Admin D ΑΩ',
    timestamp: NOW - 70 * DAY,
    poll: `${demote}-poll`,
    promotionCard: 'false',
  });
  poll(demote, 'Admin D ΑΩ', 4, 3);

  // 5. Older nominations of plain members, so History pages through more than 20.
  for (let i = 0; i < 22; i++) {
    const name = `Member ${i + 1}`;
    const id = `Minter-board-card-old${String(i).padStart(3, '0')}`;
    const by = i % 3 === 0 ? PEOPLE.nominator.name : `Admin ${String.fromCharCode(69 + (i % 5))}`;
    add('BLOG_POST', by, id, NOW - (100 + i * 15) * DAY, {
      header: `${name} for MINTER`,
      content: `<p>Nominating ${name}: a steady node and a friendly face.</p>`,
      links: [],
      nominee: name,
      nomineeAddress: addressOf(name),
      nominator: by,
      nominatorAddress: addressOf(by),
      creator: name,
      creatorAddress: addressOf(name),
      publishedBy: by,
      publishedByAddress: addressOf(by),
      timestamp: NOW - (100 + i * 15) * DAY,
      poll: `${id}-poll`,
    });
    if (i % 2 === 0) poll(id, by, 8 + (i % 4), i % 3);
  }
  // A poll created by someone other than the card's publisher (the original app hid that card).
  polls['Minter-board-card-old002-poll'].owner = addressOf('Admin A');

  // 6. The encrypted admin board: listed by Core, never decrypted here.
  add(
    'MAIL_PRIVATE',
    'Admin E',
    'card-MAC-NC-1780000000000-a1B2c3',
    NOW - 50 * DAY,
    'ZW5jcnlwdGVk'
  );

  world.legacy = { resources, polls };
}

function page(rows, sp) {
  let list = rows;
  if (sp.get('reverse') === 'true') list = [...list].reverse();
  const offset = Number(sp.get('offset') || 0);
  const limit = Number(sp.get('limit') || 20);
  if (!limit) throw new Error('limit=0 is not allowed in this app');
  return list.slice(offset, offset + limit);
}

const json = (body, status = 200) => ({ status, body });

/** Answer a Core GET about legacy data, or undefined. Same shape as answerCore in world.mjs. */
export function answerLegacy(world, pathname, sp) {
  const legacy = world.legacy;
  if (!legacy) return undefined;
  let m;

  if (pathname === '/arbitrary/resources/searchsimple') {
    const service = sp.get('service');
    if (service !== 'BLOG_POST' && service !== 'MAIL_PRIVATE') return undefined;
    const ident = sp.get('identifier') || '';
    const prefix = sp.get('prefix') === 'true';
    const names = sp.getAll('name');
    const rows = legacy.resources
      .filter((r) => r.service === service)
      .filter((r) => (prefix ? r.identifier.startsWith(ident) : r.identifier === ident))
      .filter((r) => !names.length || names.includes(r.name))
      .sort((a, b) => a.created - b.created)
      .map((r) => ({
        name: r.name,
        service: r.service,
        identifier: r.identifier,
        latestSignature: fakeKey(`legacy:${r.name}:${r.identifier}:${r.updated ?? r.created}`, 64),
        size: typeof r.body === 'string' ? r.body.length : JSON.stringify(r.body).length,
        created: r.created,
        ...(r.updated ? { updated: r.updated } : {}),
      }));
    return json(page(rows, sp));
  }

  if ((m = pathname.match(/^\/arbitrary\/(BLOG_POST|MAIL_PRIVATE)\/([^/]+)\/([^/]+)$/))) {
    const [, service, rawName, rawId] = m;
    const name = decodeURIComponent(rawName);
    const identifier = decodeURIComponent(rawId);
    const r = legacy.resources.find(
      (x) => x.service === service && x.name === name && x.identifier === identifier
    );
    if (!r) return json({ error: 1401, message: 'not found' }, 404);
    return typeof r.body === 'string' ? { status: 200, text: r.body } : json(r.body);
  }

  if ((m = pathname.match(/^\/polls\/votes\/([^/]+)$/))) {
    const p = legacy.polls[decodeURIComponent(m[1])];
    if (!p) return json({ error: 501, message: 'POLL_NO_EXISTS' }, 404);
    // Core lists the options in creation order; "No" first is common on mainnet.
    return json({
      totalVotes: p.yes + p.no,
      totalWeight: (p.yes + p.no) * 600_000,
      voteCounts: [
        { optionName: 'No', voteCount: p.no },
        { optionName: 'Yes', voteCount: p.yes },
      ],
      voteWeights: [
        { optionName: 'No', voteWeight: p.no * 600_000 },
        { optionName: 'Yes', voteWeight: p.yes * 600_000 },
      ],
    });
  }
  if ((m = pathname.match(/^\/polls\/([^/]+)$/))) {
    const pollName = decodeURIComponent(m[1]);
    const p = legacy.polls[pollName];
    if (!p) return json({ error: 501, message: 'POLL_NO_EXISTS' }, 404);
    return json({
      creatorPublicKey: fakeKey(`pollpk:${pollName}`),
      description: p.description,
      owner: p.owner,
      pollName,
      pollOptions: [{ optionName: 'Yes' }, { optionName: 'No' }],
      published: p.published,
    });
  }
  return undefined;
}
