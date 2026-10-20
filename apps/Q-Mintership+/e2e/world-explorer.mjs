/**
 * The Explorer's part of the mock world: what accounts did on Qortal beyond
 * MINTER's group transactions, so the Explorer's tests and screens have
 * real-looking links to follow. Every address and name is made up.
 *
 * What it adds (world.explorer lists it for tests):
 * - secondary names: Avery Admin also owns "Avery Two" and "AA Maps"; Nora
 *   Nominator bought "Spare Room" from Leo Learner (SELL_NAME + BUY_NAME);
 *   everyone else keeps one name. /names/address/{a}, /names/{name} with
 *   the full record, and /names/search for every name;
 * - money: Kit Kicked and Lou Left pay each other several times, and both
 *   got their first QORT from Hal Helper, a busy funder with 640 payments;
 *   QORT and another asset sent with TRANSFER_ASSET; one MULTI_PAYMENT;
 * - minting: Sid Sponsor's 0 % reward shares with five accounts (Leo
 *   Learner among them) and later removals; self-shares; a minting level
 *   moved from Olga Old to Kai Target (TRANSFER_PRIVS, raw bytes too);
 *   who is minting now (/addresses/online) and their last signed blocks;
 * - QDN publishes (an app, a website, JSON and an encrypted resource), a
 *   MESSAGE whose content must never show, an AT deployed by Lou Left that
 *   paid Kit Kicked, and the cross-chain trade behind it;
 * - other groups people are in (MINTER's own row is never changed), and a
 *   valid address Core has never seen (404, error 124).
 *
 * Group-type transactions are not added here, so every existing answer to
 * a group-type search stays exactly the same.
 */
import {
  ADDR,
  GROUP,
  MS_PER_BLOCK,
  NOW,
  NULL_OWNER,
  TIP,
  answerNameSearch,
  fakeKey,
} from './world.mjs';

// ---- addresses known when this file loads -------------------------------------
// The same as world.mjs fakeAddress: world.mjs imports this file, so its
// functions that read its constants can't run while this file loads.
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function address(seed) {
  let x = 0;
  for (const c of String(seed)) x = (x * 31 + c.charCodeAt(0)) >>> 0;
  let out = 'Q';
  for (let i = 0; i < 33; i++) {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    out += B58[(x >>> 8) % 58];
  }
  return out;
}

/** Sponsored five accounts with 0 % reward shares (not in PEOPLE). */
export const SPONSOR = { address: address('explorer-sponsor'), name: 'Sid Sponsor' };
/** Sent the first QORT to Kit Kicked, Lou Left and many newcomers: 640 payments (500+). */
export const FUNDER = { address: address('explorer-funder'), name: 'Hal Helper' };
/** Moved its minting level to Kai Target; level 0 since. */
export const OLD_MINTER = { address: address('explorer-old'), name: 'Olga Old' };
/** A valid address Core has never seen. */
export const UNUSED_ADDRESS = address('explorer-unused');
/** An AT (automated contract) Lou Left deployed; it paid Kit Kicked. */
export const AT_ADDRESS = `A${address('explorer-at').slice(1)}`;
/** Sid Sponsor's sponsees: four new accounts and Leo Learner (in MINTER). */
export const SPONSEES = [
  { address: address('explorer-sponsee-1'), name: 'Sam Sprout' },
  { address: address('explorer-sponsee-2'), name: 'Tia Twig' },
  { address: address('explorer-sponsee-3'), name: null },
  { address: address('explorer-sponsee-4'), name: 'Ugo Underway' },
  { address: address('learner'), name: 'Leo Learner' },
];
/** What the unencrypted MESSAGE carries: it must never show anywhere. */
export const MESSAGE_CONTENT = 'EXPLORER-MESSAGE-CONTENT-NEVER-SHOWN';

const HAL_PAYMENTS = 640;

// ---- building -------------------------------------------------------------------
const blockTime = (height) => NOW - (TIP - height) * MS_PER_BLOCK;
const sig = (seed) => fakeKey(`explorer:${seed}`, 64);
const pk = (world, a) => world.accounts.get(a)?.publicKey ?? fakeKey(`pk:${a}`, 32);

function base58(bytes) {
  const digits = [];
  for (const byte of bytes) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  return (
    '1'.repeat(zeros) +
    digits
      .reverse()
      .map((d) => B58[d])
      .join('')
  );
}
function base58Bytes(text) {
  let zeros = 0;
  while (text[zeros] === '1') zeros++;
  const bytes = [];
  for (const char of text.slice(zeros)) {
    let carry = B58.indexOf(char);
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  return new Uint8Array([...new Array(zeros).fill(0), ...bytes.reverse()]);
}

/** The 209 raw bytes Core answers for a TRANSFER_PRIVS: the recipient is at bytes 112–136. */
function transferPrivsRaw(row, senderKey, recipient) {
  const bytes = new Uint8Array(209);
  const view = new DataView(bytes.buffer);
  view.setInt32(0, 40);
  view.setBigInt64(4, BigInt(row.timestamp));
  view.setInt32(12, row.txGroupId);
  bytes.set(base58Bytes(row.reference).slice(0, 64), 16);
  bytes.set(base58Bytes(senderKey).slice(0, 32), 80);
  bytes.set(base58Bytes(recipient).slice(0, 25), 112);
  view.setBigInt64(137, 1_000_000n);
  bytes.set(base58Bytes(row.signature).slice(0, 64), 145);
  return base58(bytes);
}

/** Add the Explorer's data to `world`. */
export function extendExplorer(world) {
  const rows = [];
  const parties = new Map(); // signature -> addresses Core's address search matches
  /** An account; one that never sent anything has no public key yet, as on a node. */
  const addAccount = (who, level, blocks, balance, hasKey = true) => {
    if (world.accounts.has(who.address)) return;
    world.accounts.set(who.address, {
      address: who.address,
      name: who.name ?? null,
      level,
      blocks,
      publicKey: hasKey ? fakeKey(`pk:${who.address}`, 32) : undefined,
      reference: fakeKey(`sig:ref:${who.address}`, 64),
      balance,
    });
    if (who.name) world.names.set(who.name, who.address);
  };
  addAccount(SPONSOR, 6, 900_000, 40);
  addAccount(FUNDER, 3, 150_000, 1_200);
  addAccount(OLD_MINTER, 0, 0, 0.5);
  SPONSEES.slice(0, 4).forEach((who, i) =>
    addAccount(who, [1, 2, 0, 0][i], [8_000, 70_000, 0, 0][i], 2, false)
  );

  /** One transaction: `who` makes it at block `h`; `party` lists who else Core's address search finds. */
  const add = (type, h, who, extra = {}, party = []) => {
    const row = {
      type,
      timestamp: blockTime(h) - 20_000,
      reference: extra.reference ?? sig(`ref:${type}:${h}:${who}`),
      fee: type === 'REWARD_SHARE' || type === 'AT' ? '0.00000000' : '0.01000000',
      signature: extra.signature ?? sig(`${type}:${h}:${who}:${JSON.stringify(extra)}`),
      txGroupId: 0,
      blockHeight: h,
      approvalStatus: 'NOT_REQUIRED',
      creatorAddress: who,
      ...extra,
    };
    rows.push(row);
    parties.set(row.signature, [...new Set([who, ...party].filter(Boolean))]);
    return row;
  };
  const pay = (from, to, h, amount, extra = {}) =>
    add('PAYMENT', h, from, { recipient: to, senderPublicKey: pk(world, from), amount, ...extra }, [
      to,
    ]);

  // ---- Hal Helper: first QORT for Kit, Lou, two sponsees and many newcomers --------
  // 640 rows: cheap, unique signatures (80 characters of one, then the index in base58).
  const cheap = (base) => (i) => {
    let n = i;
    let tail = '';
    for (let k = 0; k < 8; k++) {
      tail = B58[n % 58] + tail;
      n = Math.floor(n / 58);
    }
    return base + tail;
  };
  const halSig = cheap(sig('hal-base').slice(0, 80));
  const halRef = cheap(sig('hal-ref').slice(0, 80));
  const halTargets = [
    [ADDR.kicked, 1_364_165, '5.43210000'],
    [ADDR.left, 1_364_170, '5.43210000'],
    [SPONSEES[1].address, 1_370_000, '1.00000000'],
    [SPONSEES[2].address, 1_370_050, '1.00000000'],
  ];
  const halPayments = [];
  for (let i = 0; i < HAL_PAYMENTS; i++) {
    const [to, h, amount] = halTargets[i] ?? [
      address(`explorer-newcomer-${i}`),
      1_370_100 + i * 2_000,
      '1.00000000',
    ];
    halPayments.push(
      pay(FUNDER.address, to, h, amount, { signature: halSig(i), reference: halRef(i) })
    );
  }
  const [toKit, toLou] = halPayments;

  // ---- Kit Kicked and Lou Left: payments both ways ------------------------------------
  const kitLou = [
    pay(ADDR.kicked, ADDR.left, 1_364_500, '10.00000000', { reference: toKit.signature }),
    pay(ADDR.left, ADDR.kicked, 1_364_600, '2.00000000', { reference: toLou.signature }),
    pay(ADDR.kicked, ADDR.left, 1_500_000, '20.00000000'),
    pay(ADDR.kicked, ADDR.left, 1_800_000, '30.00000000'),
    pay(ADDR.left, ADDR.kicked, 2_000_000, '4.30000000'),
    pay(ADDR.kicked, ADDR.left, 2_100_000, '60.00000000'),
  ];

  // ---- other payments between personas ------------------------------------------------
  pay(ADDR.admin, ADDR.learner, 2_400_000, '5.00000000');
  pay(ADDR.nominator, ADDR.admin, 2_450_000, '1.50000000');
  pay(SPONSOR.address, SPONSEES[0].address, 1_379_000, '0.50000000');
  const assetQort = add(
    'TRANSFER_ASSET',
    2_500_000,
    ADDR.admin,
    {
      recipient: ADDR.nominator,
      senderPublicKey: pk(world, ADDR.admin),
      amount: '3.00000000',
      assetId: 0,
      assetName: 'QORT',
    },
    [ADDR.nominator]
  );
  const assetOther = add(
    'TRANSFER_ASSET',
    2_510_000,
    ADDR.nominator,
    {
      recipient: ADDR.learner,
      senderPublicKey: pk(world, ADDR.nominator),
      amount: '50.00000000',
      assetId: 77,
      assetName: 'Bean Token',
    },
    [ADDR.learner]
  );
  const multi = add(
    'MULTI_PAYMENT',
    2_600_500,
    ADDR.admin,
    {
      senderPublicKey: pk(world, ADDR.admin),
      payments: [
        { recipient: ADDR.learner, assetId: 0, amount: '1.00000000' },
        { recipient: ADDR.kickTarget, assetId: 0, amount: '2.00000000' },
        { recipient: ADDR.recentlyJoined, assetId: 0, amount: '3.00000000' },
      ],
    },
    [ADDR.learner, ADDR.kickTarget, ADDR.recentlyJoined]
  );

  // ---- reward shares --------------------------------------------------------------------
  const share = (minter, recipient, h, sharePercent) =>
    add(
      'REWARD_SHARE',
      h,
      minter,
      {
        recipient,
        minterPublicKey: pk(world, minter),
        rewardSharePublicKey: fakeKey(`rs:${minter}:${recipient}`, 32),
        sharePercent,
      },
      [recipient]
    );
  share(SPONSOR.address, SPONSOR.address, 1_360_000, '0.00');
  const [samShare, tiaShare, unnamedShare, ugoShare, leoShare] = SPONSEES;
  share(SPONSOR.address, leoShare.address, 1_371_641, '0.00');
  share(SPONSOR.address, leoShare.address, 1_378_875, '-1.00');
  share(SPONSOR.address, samShare.address, 1_380_000, '0.00');
  share(SPONSOR.address, samShare.address, 1_500_000, '-1000000.00');
  share(SPONSOR.address, tiaShare.address, 1_390_000, '0.00');
  share(SPONSOR.address, tiaShare.address, 1_600_000, '-1.00');
  share(SPONSOR.address, unnamedShare.address, 1_400_000, '0.00');
  share(SPONSOR.address, ugoShare.address, 2_700_000, '0.00');
  share(ADDR.kicked, ADDR.kicked, 1_371_000, '0.00');
  share(ADDR.left, ADDR.left, 1_371_014, '0.00');
  share(ADDR.admin, ADDR.admin, 2_200_000, '0.00');
  share(ADDR.promote, ADDR.promote, 2_250_000, '0.00');
  share(ADDR.nominator, ADDR.nominator, 2_300_500, '0.00');
  share(OLD_MINTER.address, OLD_MINTER.address, 1_200_000, '0.00');

  // ---- a minting level moved ----------------------------------------------------------
  const privs = add(
    'TRANSFER_PRIVS',
    2_000_000,
    OLD_MINTER.address,
    { senderPublicKey: pk(world, OLD_MINTER.address) },
    [ADDR.kickTarget]
  );
  const raw = new Map([
    [privs.signature, transferPrivsRaw(privs, pk(world, OLD_MINTER.address), ADDR.kickTarget)],
  ]);

  // ---- names --------------------------------------------------------------------------
  const nameInfo = new Map();
  // Everyone's name so far, in the order the world made them, a block apart.
  [...world.names.keys()].forEach((name, i) =>
    nameInfo.set(name, { registered: blockTime(1_400_000 + i * 1_000) })
  );
  const register = (owner, name, h, data = 'Registered Name on the Qortal Chain') => {
    world.names.set(name, owner);
    nameInfo.set(name, { registered: blockTime(h), data });
    return add('REGISTER_NAME', h, owner, { registrantPublicKey: pk(world, owner), name, data });
  };
  register(ADDR.admin, 'Avery Two', 2_150_000);
  register(ADDR.admin, 'AA Maps', 2_160_000, '{"app":"maps"}');
  add('UPDATE_NAME', 2_170_000, ADDR.admin, {
    ownerPublicKey: pk(world, ADDR.admin),
    name: 'AA Maps',
    newName: '',
    newData: '{"app":"maps","v":2}',
  });
  nameInfo.get('AA Maps').updated = blockTime(2_170_000);
  nameInfo.get('AA Maps').data = '{"app":"maps","v":2}';
  // Leo registered "Spare Room" before Nora's own name, then sold it to her.
  register(ADDR.learner, 'Spare Room', 1_390_000);
  world.names.set('Spare Room', ADDR.nominator);
  const sell = add('SELL_NAME', 2_350_000, ADDR.learner, {
    ownerPublicKey: pk(world, ADDR.learner),
    name: 'Spare Room',
    amount: '5.00000000',
  });
  const buy = add(
    'BUY_NAME',
    2_351_000,
    ADDR.nominator,
    {
      buyerPublicKey: pk(world, ADDR.nominator),
      name: 'Spare Room',
      amount: '5.00000000',
      seller: ADDR.learner,
    },
    [ADDR.learner]
  );
  nameInfo.get('Spare Room').updated = blockTime(2_351_000);

  // ---- QDN publishes --------------------------------------------------------------------
  const qdn = [];
  const publish = (name, service, serviceNumber, identifier, h, size) => {
    const entry = { name, service, identifier, created: blockTime(h), size };
    qdn.push(entry);
    const row = add('ARBITRARY', h, ADDR.admin, {
      version: 5,
      senderPublicKey: pk(world, ADDR.admin),
      service: serviceNumber,
      nonce: 0,
      size,
      name,
      identifier,
      method: 'PUT',
      secret: fakeKey(`secret:${name}:${identifier}`, 32),
      compression: 'ZIP',
      data: fakeKey(`hash:${name}:${identifier}`, 32),
      dataType: 'DATA_HASH',
      payments: [],
    });
    // Its latest version is this transaction, as searchsimple says.
    entry.signature = row.signature;
    return row;
  };
  const publishes = [
    publish('AA Maps', 'APP', 1000, 'default', 2_165_000, 2_400_000),
    publish('AA Maps', 'WEBSITE', 200, 'default', 2_166_000, 380_000),
    publish('Avery Admin', 'JSON', 1110, 'avery-settings', 2_600_000, 240),
    publish('Avery Two', 'MAIL_PRIVATE', 1901, 'qortal_qmail_explorer_test', 2_700_100, 4_000),
  ];

  // ---- a message, an AT and the trade behind it ------------------------------------------
  const message = add(
    'MESSAGE',
    2_650_000,
    ADDR.kicked,
    {
      recipient: ADDR.left,
      senderPublicKey: pk(world, ADDR.kicked),
      version: 5,
      nonce: 0,
      amount: '0.00000000',
      data: MESSAGE_CONTENT,
      isText: true,
      isEncrypted: false,
    },
    [ADDR.left]
  );
  const deploy = add(
    'DEPLOY_AT',
    2_690_000,
    ADDR.left,
    {
      creatorPublicKey: pk(world, ADDR.left),
      name: 'QORT/LTC ACCT',
      description: 'QORT/LTC cross-chain trade',
      aTType: 'ACCT',
      tags: 'ACCT QORT LTC',
      amount: '12.01000000',
      assetId: 0,
      aTAddress: AT_ADDRESS,
    },
    [AT_ADDRESS]
  );
  const payout = add(
    'AT',
    2_690_400,
    NULL_OWNER,
    { atAddress: AT_ADDRESS, recipient: ADDR.kicked, amount: '12.00000000', assetId: 0 },
    [AT_ADDRESS, ADDR.kicked]
  );
  // An AT's own transaction: Core's address search finds the AT and the recipient, not the null account.
  parties.set(payout.signature, [AT_ADDRESS, ADDR.kicked]);
  const trades = [
    {
      tradeTimestamp: blockTime(2_690_400),
      qortAmount: '12.00000000',
      btcAmount: '0.50000000',
      foreignAmount: '0.50000000',
      atAddress: AT_ADDRESS,
      sellerAddress: ADDR.left,
      buyerReceivingAddress: ADDR.kicked,
    },
  ];

  // ---- minting now -----------------------------------------------------------------------
  const online = [
    [ADDR.admin, ADDR.admin, 7, true],
    [ADDR.nominator, ADDR.nominator, 6, true],
    [ADDR.promote, ADDR.promote, 8, true],
    [SPONSOR.address, ugoShare.address, 6, false],
  ].map(([minterAddress, recipientAddress, minterLevel, isMinterMember]) => ({
    minterAddress,
    recipientAddress,
    minterLevel,
    isMinterMember,
    rewardSharePublicKey: fakeKey(`rs:${minterAddress}:${recipientAddress}`, 32),
  }));
  const signed = new Map([
    [ADDR.admin, TIP - 3],
    [ADDR.nominator, TIP - 12],
    [ADDR.promote, TIP - 40],
    [SPONSOR.address, TIP - 25],
    [ADDR.kicked, 2_690_000],
  ]);

  // ---- other groups (MINTER's own row is never touched) ---------------------------------
  const groups = new Map(
    [
      {
        groupId: 1,
        groupName: 'Qortal General',
        owner: FUNDER.address,
        isOpen: true,
        memberCount: 5_200,
      },
      {
        groupId: 2,
        groupName: 'Some other group',
        owner: NULL_OWNER,
        isOpen: true,
        memberCount: 300,
      },
      {
        groupId: 812,
        groupName: 'Q-Mintership Helpers',
        owner: ADDR.admin,
        isOpen: true,
        memberCount: 40,
      },
      { groupId: 1203, groupName: 'Book Club', owner: ADDR.left, isOpen: false, memberCount: 12 },
      // The approval route of world.mjs's "unusual approval route" admin change (txGroupId).
      {
        groupId: 4242,
        groupName: 'Side Council',
        owner: NULL_OWNER,
        isOpen: false,
        memberCount: 7,
      },
    ].map((g) => [
      g.groupId,
      {
        ...g,
        description: `${g.groupName} (made-up group)`,
        created: blockTime(1_300_000 + g.groupId),
        approvalThreshold: 'PCT40',
        minimumBlockDelay: 5,
        maximumBlockDelay: 21_600,
      },
    ])
  );
  const groupRow = (id, isAdmin = false) => {
    const g = groups.get(id);
    return {
      groupId: g.groupId,
      owner: g.owner,
      groupName: g.groupName,
      description: g.description,
      created: g.created,
      isOpen: g.isOpen,
      approvalThreshold: g.approvalThreshold,
      minimumBlockDelay: g.minimumBlockDelay,
      maximumBlockDelay: g.maximumBlockDelay,
      memberCount: g.memberCount,
      ...(isAdmin ? { isAdmin: true } : {}),
    };
  };
  const moreGroups = new Map([
    [ADDR.admin, [groupRow(1), groupRow(812, true)]],
    [ADDR.nominator, [groupRow(1), groupRow(812)]],
    [ADDR.kicked, [groupRow(1), groupRow(1203)]],
    [ADDR.left, [groupRow(1), groupRow(1203, true)]],
    [SPONSOR.address, [groupRow(1)]],
    [FUNDER.address, [groupRow(1, true)]],
  ]);

  // Accounts that never sent anything: their reference is their first incoming transaction.
  const firstIn = [
    [samShare.address, rows.find((t) => t.type === 'PAYMENT' && t.recipient === samShare.address)],
    [tiaShare.address, halPayments[2]],
    [unnamedShare.address, halPayments[3]],
    [
      ugoShare.address,
      rows.find((t) => t.type === 'REWARD_SHARE' && t.recipient === ugoShare.address),
    ],
  ];
  for (const [who, row] of firstIn) world.accounts.get(who).reference = row.signature;

  rows.sort((a, b) => a.blockHeight - b.blockHeight);
  world.explorer = {
    rows,
    parties,
    bySig: new Map(rows.map((row) => [row.signature, row])),
    raw,
    nameInfo,
    qdn,
    trades,
    online,
    signed,
    groups,
    moreGroups,
    sponsees: SPONSEES.map((s) => s.address),
    /** Signatures tests point at. */
    sigs: {
      funding: { kicked: toKit.signature, left: toLou.signature },
      kitLou: kitLou.map((row) => row.signature),
      privs: privs.signature,
      sell: sell.signature,
      buy: buy.signature,
      message: message.signature,
      deploy: deploy.signature,
      payout: payout.signature,
      multi: multi.signature,
      assets: [assetQort.signature, assetOther.signature],
      publishes: publishes.map((row) => row.signature),
    },
  };
  // The Overview and Names tabs' name collector (its own section at the end of this file).
  extendCollector(world);
}

// ---- answering Core --------------------------------------------------------------------
function page(list, sp) {
  let rows = list;
  if (sp.get('reverse') === 'true') rows = [...rows].reverse();
  const offset = Number(sp.get('offset') || 0);
  const limit = Number(sp.get('limit') || 20);
  if (!limit) throw new Error('limit=0 is not allowed in this app');
  return rows.slice(offset, offset + limit);
}

const json = (body, status = 200) => ({ status, body });
const text = (value, status = 200) => ({ status, text: String(value) });
const unknownAccount = () => json({ error: 124, message: 'account address unknown' }, 404);

/** The group rows world.mjs's /transactions/search reads (the same list, the same order). */
function groupTxs(world) {
  return [
    ...world.decided,
    ...world.pending.filter((t) => typeof t.blockHeight === 'number'),
    ...world.approvals,
  ];
}
function subjectOf(t) {
  return t.invitee ?? t.member ?? t.offender ?? t.admin ?? null;
}

/** Names `owner` owns, in the order they were registered. */
function registeredAt(world, name) {
  return world.explorer.nameInfo.get(name)?.registered ?? blockTime(1_400_000);
}
function namesOf(world, owner) {
  return [...world.names.entries()]
    .filter(([, a]) => a === owner)
    .map(([name]) => name)
    .sort((a, b) => registeredAt(world, a) - registeredAt(world, b));
}

/** Answer a Core GET for the Explorer, or undefined. Same shape as answerCore in world.mjs. */
/**
 * Open File's files: Avery Admin's settings (JSON) and AA Maps' website
 * (three files), their metadata and bodies. The rest answer as before.
 */
export const EXPLORER_FILES = {
  'JSON/Avery Admin/avery-settings': {
    meta: {
      title: 'Avery’s settings',
      description: 'Kept for the next visit.',
      files: ['settings.json'],
      mimeType: 'application/json',
    },
    files: {
      '': JSON.stringify({
        theme: 'dark',
        motion: true,
        muted: ['Spam Bot'],
        notes: { decisions: 'by type', since: 2_600_000 },
      }),
    },
  },
  'WEBSITE/AA Maps/default': {
    meta: { title: 'AA Maps', files: ['index.html', 'logo.svg', 'assets/app.js'] },
    files: {
      'index.html':
        '<!DOCTYPE html>\n<html>\n  <head><title>AA Maps</title></head>\n  <body><div id="map"></div><script src="assets/app.js"></script></body>\n</html>\n',
      'logo.svg': '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"></svg>',
      'assets/app.js': 'console.log("AA Maps");\n',
    },
  },
};

export function answerExplorer(world, p, sp) {
  const x = world.explorer;
  if (!x) return undefined;
  // Reads about the name collector only (its own section at the end of this file).
  const collector = answerCollector(world, p, sp);
  if (collector) return collector;
  let m;

  // ---- names ---------------------------------------------------------------------------
  if (p === '/names/search') return answerNameSearch(world, p, sp);
  if ((m = p.match(/^\/names\/address\/([QA]\w+)$/))) {
    const rows = namesOf(world, m[1]).map((name) => ({ name, owner: m[1] }));
    return json(page(rows, sp));
  }
  if ((m = p.match(/^\/names\/([^/]+)$/)) && m[1] !== 'search') {
    const asked = decodeURIComponent(m[1]);
    // Core matches the reduced name; here, any case.
    const name = world.names.has(asked)
      ? asked
      : [...world.names.keys()].find((n) => n.toLowerCase() === asked.toLowerCase());
    if (!name) return json({ error: 401, message: 'name unknown' }, 404);
    const info = x.nameInfo.get(name) ?? {};
    return json({
      name,
      reducedName: name.toLowerCase(),
      owner: world.names.get(name),
      data: info.data ?? 'Registered Name on the Qortal Chain',
      registered: registeredAt(world, name),
      ...(info.updated ? { updated: info.updated } : {}),
      isForSale: false,
    });
  }

  // ---- accounts ------------------------------------------------------------------------
  if (p === `/addresses/${UNUSED_ADDRESS}`) return unknownAccount();
  if ((m = p.match(/^\/addresses\/(A\w+)$/)))
    return json({
      address: m[1],
      level: 0,
      blocksMinted: 0,
      blocksMintedAdjustment: 0,
      blocksMintedPenalty: 0,
    });
  if (p === '/addresses/online') return json(x.online);
  if ((m = p.match(/^\/addresses\/sponsorship\/(Q\w+)(\/sponsor)?$/))) {
    const sponsorOf = m[2] ? (x.sponsees.includes(m[1]) ? SPONSOR.address : null) : m[1];
    const account = sponsorOf ? world.accounts.get(sponsorOf) : null;
    if (!account) return unknownAccount();
    const sponsees = sponsorOf === SPONSOR.address ? x.sponsees : [];
    const named = sponsees.map((a) => world.accounts.get(a)?.name).filter(Boolean);
    return json({
      address: account.address,
      level: account.level,
      blocksMinted: account.blocks,
      adjustments: 0,
      penalties: 0,
      transfer: false,
      names: named,
      sponseeCount: sponsees.length,
      nonRegisteredCount: sponsees.length - named.length,
      avgBalance: sponsees.length ? 2 : 0,
      arbitraryCount: 0,
      transferAssetCount: 0,
      transferPrivsCount: 0,
      sellCount: 0,
      sellAmount: 0,
      buyCount: 0,
      buyAmount: 0,
    });
  }
  if ((m = p.match(/^\/blocks\/signer\/([QA]\w+)$/))) {
    const height = x.signed.get(m[1]);
    if (height === undefined) return json([]);
    const account = world.accounts.get(m[1]);
    return json(
      page(
        [
          {
            signature: fakeKey(`explorer:block:${height}`, 64),
            height,
            timestamp: blockTime(height),
            minterPublicKey: account?.publicKey ?? '',
            onlineAccountsCount: 4_100,
            transactionCount: 3,
          },
        ],
        sp
      )
    );
  }

  // ---- groups --------------------------------------------------------------------------
  if ((m = p.match(/^\/groups\/member\/(Q\w+)$/))) {
    const more = x.moreGroups.get(m[1]);
    if (!more) return undefined;
    // MINTER's row (or the other group a non-member sees) exactly as world.mjs answers it.
    const base = !world.members.includes(m[1])
      ? [{ groupId: 2, groupName: 'Some other group', owner: NULL_OWNER }]
      : [{ ...world.group, ...(world.admins.includes(m[1]) ? { isAdmin: true } : {}) }];
    return json([...base, ...more]);
  }
  if ((m = p.match(/^\/groups\/(\d+)$/)) && Number(m[1]) !== GROUP) {
    const g = x.groups.get(Number(m[1]));
    return g ? json(g) : undefined;
  }
  // The other groups' bans and join requests (Join on a group card checks them): Book Club
  // has Leo Learner's join request; the rest have none.
  if ((m = p.match(/^\/groups\/(bans|joinrequests)\/(\d+)$/)) && Number(m[2]) !== GROUP) {
    if (!x.groups.has(Number(m[2]))) return undefined;
    if (m[1] === 'joinrequests' && Number(m[2]) === 1203)
      return json([{ groupId: 1203, joiner: ADDR.learner }]);
    return json([]);
  }

  // ---- transactions --------------------------------------------------------------------
  if ((m = p.match(/^\/transactions\/signature\/(\w+)\/raw$/))) {
    const raw = x.raw.get(m[1]);
    return raw ? text(raw) : undefined;
  }
  if ((m = p.match(/^\/transactions\/signature\/(\w+)$/))) {
    const row = x.bySig.get(m[1]);
    return row ? json(row) : undefined;
  }
  if (p === '/transactions/payments/between') {
    const sender = sp.get('senderAddress');
    const recipient = sp.get('recipientAddress');
    const rows = x.rows.filter(
      (t) =>
        t.type === 'PAYMENT' &&
        (!sender || t.creatorAddress === sender) &&
        (!recipient || t.recipient === recipient)
    );
    return json(page(rows, sp));
  }
  if ((m = p.match(/^\/transactions\/creator\/(\w+)$/))) {
    const key = m[1];
    const creator = [...world.accounts.values()].find((a) => a.publicKey === key)?.address;
    if (!creator) return json([]);
    const all = [...groupTxs(world), ...x.rows];
    // On a node every reference is a real transaction; the mock's made-up ones
    // aren't, so a row whose reference nothing here has comes without one
    // (the app then asks for the first payment received, as it would anyway).
    const known = new Set(all.map((t) => t.signature));
    const rows = all
      .filter((t) => t.creatorAddress === creator && typeof t.blockHeight === 'number')
      .sort((a, b) => a.blockHeight - b.blockHeight)
      .map((t) => {
        if (!t.reference || known.has(t.reference)) return t;
        const { reference: _unknown, ...rest } = t;
        void _unknown;
        return rest;
      });
    return json(page(rows, sp));
  }
  if (p === '/transactions/search') {
    const types = sp.getAll('txType');
    const address = sp.get('address');
    const txGroupId = sp.get('txGroupId');
    const start = Number(sp.get('startBlock') || 0);
    const limitBlocks = Number(sp.get('blockLimit') || 0);
    const inBlocks = (t) =>
      !start ||
      ((t.blockHeight ?? 0) >= start && (!limitBlocks || t.blockHeight < start + limitBlocks));
    const mine = x.rows.filter(
      (t) =>
        (!types.length || types.includes(t.type)) &&
        (!address || x.parties.get(t.signature)?.includes(address)) &&
        (!txGroupId || String(t.txGroupId) === txGroupId) &&
        inBlocks(t)
    );
    // Nothing of the Explorer's matches: world.mjs answers, exactly as before.
    if (!mine.length) return undefined;
    if (!types.length && !address && Number(sp.get('limit') || 0) > 20)
      return json({ error: 'txType, address or limit ≤ 20 needed' }, 400);
    // The same filters world.mjs applies to the group rows, then both together.
    let rows = groupTxs(world);
    if (types.length) rows = rows.filter((t) => types.includes(t.type));
    if (address)
      rows = rows.filter((t) => t.creatorAddress === address || subjectOf(t) === address);
    if (txGroupId) rows = rows.filter((t) => String(t.txGroupId) === txGroupId);
    rows = rows.filter(inBlocks);
    rows = [...rows, ...mine].sort((a, b) => (a.blockHeight ?? 0) - (b.blockHeight ?? 0));
    return json(page(rows, sp));
  }

  // ---- QDN and trades --------------------------------------------------------------------
  // ---- Open File: two publishes on the node as files (READY) --------------------------
  const file = (m = p.match(
    /^\/arbitrary\/(?:(resource\/status|metadata)\/)?([A-Z_]+)\/([^/]+)\/([^/]+)$/
  ))
    ? EXPLORER_FILES[`${m[2]}/${decodeURIComponent(m[3])}/${decodeURIComponent(m[4])}`]
    : undefined;
  if (file && m[1] === 'resource/status')
    return json({ status: 'READY', localChunkCount: 1, totalChunkCount: 1, percentLoaded: 100 });
  if (file && m[1] === 'metadata') return json(file.meta);
  if (file) {
    const body = file.files[sp.get('filepath') ?? ''];
    return body === undefined
      ? json(
          {
            error: 102,
            message: 'filepath is required for resources containing more than one file',
          },
          400
        )
      : { status: 200, text: body };
  }

  if (p === '/arbitrary/resources/searchsimple') {
    const service = sp.get('service');
    if (service === 'JSON') return undefined; // world.mjs's own answer
    const names = sp.getAll('name');
    if (!service && !names.length) return undefined;
    const ident = sp.get('identifier') || '';
    const prefix = sp.get('prefix') === 'true';
    const nameMatch = (n) =>
      !names.length || names.some((want) => (prefix ? n.startsWith(want) : n === want));
    const all = [
      ...x.qdn,
      // A search by name alone finds what the name published under every service.
      ...(!service
        ? [
            ...world.records.map((r) => ({ ...r, service: 'JSON', size: 300 })),
            ...(world.legacy?.resources ?? []).map((r) => ({
              ...r,
              size: typeof r.body === 'string' ? r.body.length : JSON.stringify(r.body).length,
            })),
            ...(world.adminPollRecords ?? []).map((r) => ({
              ...r,
              service: 'DOCUMENT_PRIVATE',
              size: 600,
            })),
          ]
        : []),
    ];
    const rows = all
      .filter((r) => !service || r.service === service)
      .filter((r) => (prefix ? r.identifier.startsWith(ident) : !ident || r.identifier === ident))
      .filter((r) => nameMatch(r.name))
      .filter((r) => !Number(sp.get('after') || 0) || r.created > Number(sp.get('after')))
      .sort((a, b) => a.created - b.created)
      .map((r) => ({
        name: r.name,
        service: r.service,
        identifier: r.identifier,
        latestSignature:
          r.signature ?? fakeKey(`explorer:qdn:${r.service}:${r.name}:${r.identifier}`, 64),
        size: r.size,
        created: r.created,
        ...(r.updated ? { updated: r.updated } : {}),
      }));
    return json(page(rows, sp));
  }
  if (p === '/crosschain/trades') {
    const ownerOf = (key) =>
      key ? ([...world.accounts.values()].find((a) => a.publicKey === key)?.address ?? '') : null;
    const seller = ownerOf(sp.get('sellerPublicKey'));
    const buyer = ownerOf(sp.get('buyerPublicKey'));
    const rows = x.trades.filter(
      (t) =>
        (seller === null || t.sellerAddress === seller) &&
        (buyer === null || t.buyerReceivingAddress === buyer)
    );
    return json(page(rows, sp));
  }
  return undefined;
}

// =========================================================================================
// ---- The Overview and Names tabs: a name collector ----------------------------------------
// =========================================================================================
/*
 * Cora Collector owns 30 names: more than one screen of them, and more than
 * the 10 the Names tab searches on QDN by itself. Its primary name is the
 * third Core lists; "Cora Sale" is for sale at 5 QORT; three names are
 * written in ways that get a note (like an address, like its own address,
 * with a blank character). It published on QDN under five names: an app and
 * JSON under its primary name, videos and encrypted mail under its newest
 * names, 120 documents under one (past the 100-row cap) and an image under
 * an old one. Core recorded a minting penalty and an adjustment on it; it
 * isn't minting and isn't in MINTER.
 *
 * Kept apart from everything above: its names are not in world.names, its
 * transactions are not in world.explorer.rows, and answerCollector() only
 * answers reads about its own address, public key and names. So every other
 * answer (name searches, global transaction searches, QDN searches by
 * service) stays exactly as it was.
 */
export const COLLECTOR = { address: address('explorer-collector'), name: 'Cora Collector' };
/** The Braille blank (U+2800): shows as nothing. */
const BLANK = String.fromCharCode(0x2800);
/** Its names in Core's order (when each was registered); the primary is the third. */
export const COLLECTOR_NAMES = [
  'Cora Shelf 01',
  'Cora Shelf 02',
  COLLECTOR.name,
  'Cora Sale',
  `${COLLECTOR.address.slice(0, 5)} Vault`,
  'QCora...Maps',
  `Cora${BLANK}Blank`,
  ...Array.from({ length: 23 }, (_, i) => `Cora Shelf ${String(i + 3).padStart(2, '0')}`),
];
const COLLECTOR_BALANCE = 6480.54123456;

function extendCollector(world) {
  const who = COLLECTOR.address;
  const publicKey = fakeKey(`pk:${who}`, 32);
  world.accounts.set(who, {
    address: who,
    name: COLLECTOR.name,
    level: 0,
    blocks: 1_200_000,
    publicKey,
    reference: fakeKey(`sig:ref:${who}`, 64),
    balance: COLLECTOR_BALANCE,
  });
  const rows = [];
  const add = (type, h, extra) => {
    const row = {
      type,
      timestamp: blockTime(h) - 20_000,
      reference: sig(`collector:ref:${type}:${h}`),
      fee: '0.01000000',
      signature: sig(`collector:${type}:${h}:${JSON.stringify(extra)}`),
      txGroupId: 0,
      blockHeight: h,
      approvalStatus: 'NOT_REQUIRED',
      creatorAddress: who,
      ...extra,
    };
    rows.push(row);
    return row;
  };
  const names = new Map();
  COLLECTOR_NAMES.forEach((name, i) => {
    const h = 1_500_000 + i * 40_000;
    names.set(name, { registered: blockTime(h), data: 'Registered Name on the Qortal Chain' });
    add('REGISTER_NAME', h, { registrantPublicKey: publicKey, name, data: names.get(name).data });
  });
  add('UPDATE_NAME', 2_400_000, {
    ownerPublicKey: publicKey,
    name: 'Cora Shelf 02',
    newName: '',
    newData: '{"shelf":2}',
  });
  Object.assign(names.get('Cora Shelf 02'), { updated: blockTime(2_400_000), data: '{"shelf":2}' });
  add('SELL_NAME', 2_450_000, {
    ownerPublicKey: publicKey,
    name: 'Cora Sale',
    amount: '5.00000000',
  });
  Object.assign(names.get('Cora Sale'), { updated: blockTime(2_450_000), salePrice: '5.00000000' });

  const qdn = [];
  const publish = (name, service, serviceNumber, identifier, h, size, withTx = true) => {
    qdn.push({ name, service, identifier, created: blockTime(h), size });
    if (withTx)
      add('ARBITRARY', h, {
        version: 5,
        senderPublicKey: publicKey,
        service: serviceNumber,
        nonce: 0,
        size,
        name,
        identifier,
        method: 'PUT',
        compression: 'ZIP',
        data: fakeKey(`hash:${name}:${identifier}`, 32),
        dataType: 'DATA_HASH',
        payments: [],
      });
  };
  for (let k = 0; k < 120; k++) {
    const identifier = `doc-${String(k).padStart(3, '0')}`;
    publish('Cora Shelf 23', 'DOCUMENT', 800, identifier, 1_900_000 + k * 100, 1_200, false);
  }
  publish('Cora Shelf 05', 'IMAGE', 400, 'old-picture', 2_000_000, 80_000);
  publish(COLLECTOR.name, 'APP', 1000, null, 2_600_000, 2_400_000);
  publish(COLLECTOR.name, 'JSON', 1110, 'cora-settings', 2_650_000, 240);
  publish(COLLECTOR.name, 'JSON', 1110, 'cora-prefs', 2_660_000, 310);
  publish('Cora Shelf 25', 'VIDEO', 500, 'shelf-tour', 2_700_000, 52_000_000);
  publish('Cora Shelf 25', 'VIDEO', 500, 'shelf-tour-2', 2_710_000, 48_000_000);
  publish('Cora Shelf 24', 'MAIL_PRIVATE', 1901, 'qortal_qmail_cora_secret_1', 2_720_000, 4_000);
  // Its newest transaction: about two and a half days before the tip.
  publish('Cora Shelf 24', 'MAIL_PRIVATE', 1901, 'qortal_qmail_cora_secret_2', TIP - 3_000, 3_800);

  rows.sort((a, b) => a.blockHeight - b.blockHeight);
  world.explorer.collector = { address: who, publicKey, rows, names, qdn };
}

/** Core's answers about the collector (its address, its public key, its names), or undefined. */
function answerCollector(world, p, sp) {
  const c = world.explorer.collector;
  if (!c) return undefined;
  const nameOf = (asked) =>
    c.names.has(asked)
      ? asked
      : [...c.names.keys()].find((n) => n.toLowerCase() === asked.toLowerCase());
  let m;
  if (p === `/addresses/${c.address}`) {
    const a = world.accounts.get(c.address);
    return json({
      address: c.address,
      reference: a.reference,
      publicKey: c.publicKey,
      defaultGroupId: 0,
      flags: 0,
      level: a.level,
      blocksMinted: a.blocks,
      blocksMintedAdjustment: 12_000,
      blocksMintedPenalty: -5_000_000,
    });
  }
  if (p === `/names/address/${c.address}`)
    return json(
      page(
        COLLECTOR_NAMES.map((name) => ({ name, owner: c.address })),
        sp
      )
    );
  if ((m = p.match(/^\/names\/([^/]+)$/)) && m[1] !== 'search') {
    const name = nameOf(decodeURIComponent(m[1]));
    if (!name) return undefined;
    const info = c.names.get(name);
    return json({
      name,
      reducedName: name.toLowerCase(),
      owner: c.address,
      data: info.data,
      registered: info.registered,
      ...(info.updated ? { updated: info.updated } : {}),
      isForSale: Boolean(info.salePrice),
      ...(info.salePrice ? { salePrice: info.salePrice } : {}),
    });
  }
  if (p === `/transactions/creator/${c.publicKey}`) return json(page(c.rows, sp));
  if ((m = p.match(/^\/transactions\/signature\/(\w+)$/))) {
    const row = c.rows.find((t) => t.signature === m[1]);
    return row ? json(row) : undefined;
  }
  if (p === '/transactions/search' && sp.get('address') === c.address) {
    const types = sp.getAll('txType');
    const start = Number(sp.get('startBlock') || 0);
    const blocks = Number(sp.get('blockLimit') || 0);
    const rows = c.rows.filter(
      (t) =>
        (!types.length || types.includes(t.type)) &&
        (!start || (t.blockHeight >= start && (!blocks || t.blockHeight < start + blocks)))
    );
    return json(page(rows, sp));
  }
  if (p === '/arbitrary/resources/searchsimple') {
    const asked = sp.getAll('name');
    if (!asked.length || !asked.every((n) => c.names.has(n))) return undefined;
    const service = sp.get('service');
    const ident = sp.get('identifier');
    const rows = c.qdn
      .filter((r) => asked.includes(r.name))
      .filter((r) => !service || r.service === service)
      .filter((r) => !ident || r.identifier === ident)
      .sort((a, b) => a.created - b.created)
      .map((r) => ({
        name: r.name,
        service: r.service,
        ...(r.identifier ? { identifier: r.identifier } : {}),
        latestSignature: fakeKey(`collector:qdn:${r.service}:${r.name}:${r.identifier}`, 64),
        size: r.size,
        created: r.created,
      }));
    return json(page(rows, sp));
  }
  return undefined;
}
