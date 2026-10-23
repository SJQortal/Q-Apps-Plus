/**
 * Q-Mintership+ for the shared screenshot check (scripts/screens.mjs):
 *
 *   QPLUS_CHROMIUM=~/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome \
 *     scripts/screens.mjs Q-Mintership+ [--only home-admin,decisions] [--themes hub30] [--mode light]
 *
 * QMP_PAGE_WIDTH=full runs every screen with Page width set to Full window (Settings →
 * Appearance), e.g. with `--sizes 1920x1080,2560x1440,3840x2160` for big screens.
 *
 * The mock node is the shared world (e2e/world.mjs): a MINTER group with a
 * person in every status and a decision in every state. `?as=<persona>` in a
 * screen's path picks who is signed in; `outside` has no Hub at all and
 * `signedOut` declines the account request. Every write is declined, so
 * nothing can be sent.
 */
import {
  addCommunityVotes,
  addConsidering,
  addDecisionVotes,
  addDecidedSignatures,
  addComments,
  addFormerReady,
  addOtherPending,
  addReady,
  addRejections,
  answerCore,
  answerNameSearch,
  FORMER_READY,
  createWorld,
  fakeAddress,
  lastVisitSnapshots,
  lastVisitStorageKey,
  ADDR,
  NOW,
  PEOPLE,
  TIP,
} from './world.mjs';
import { addTargetShift } from './world.mjs';
import { nominatorLastVisit } from './world.mjs';
import { AT_ADDRESS, FUNDER, SPONSOR, UNUSED_ADDRESS } from './world-explorer.mjs';
import { ADMIN_BOARD_IDS } from './world-legacy.mjs';

const world = createWorld();
// Admins' Decisions also shows the transactions that aren't MINTER group changes.
addOtherPending(world);
// Rae Ready has a join request from before (no nomination).
addReady(world);
// Rejections (one a withdrawn signature, one on its way, a ban lift with enough of them, a
// rejected invite in History) and Minter Admins considering (with notes) on the cards.
addRejections(world);
addConsidering(world);
// The community's Yes and No (people who aren't Minter Admins) on Wren's and bob's nominations.
addCommunityVotes(world);
// And on Kai's removal, Ben's ban and Pia's request to become a Minter Admin.
addDecisionVotes(world);
// A moving target: screens whose path starts with `?world=shift` read this world.
const shiftWorld = createWorld();
addOtherPending(shiftWorld);
const shift = addTargetShift(shiftWorld);
/** The world a request's page reads: `?world=shift` picks the moving-target one. */
function worldFor(route) {
  let page = '';
  try {
    page = route.request().frame().url();
  } catch {
    // Not from a page frame: the default world.
  }
  return /[?&]world=shift\b/.test(page) ? shiftWorld : world;
}
// Shareable links: a decision still waiting, one decided (with its signatures), a nomination.
const DECIDED_SIG = addDecidedSignatures(world);
const PENDING_SIG = world.pending.find((t) => t.type === 'GROUP_KICK').signature;
// Public comments on Wren Waiting's nomination and bob+builder's invite, and a hidden one.
addComments(world);
// Two former members have asked to join again: Requested to join MINTER Group marks them.
addFormerReady(world);
// Replaced in setup() by a visible 64×64 gradient, so avatars show in the shots.
let PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAQklEQVR42u3OMQEAAAgDINc/9Mzg14MGLUmHCgUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFbzwB2GwADvYAAAAASUVORK5CYII=',
  'base64'
);

/** In-page answers: the persona comes from `?as=` (the check appends `?theme=` after it). */
const qortal = () => `
  const PEOPLE = ${JSON.stringify(Object.fromEntries(Object.entries(ADDR).map(([k, a]) => [k, { address: a, name: PEOPLE[k].name }])))};
  const KEYS = ${JSON.stringify(Object.fromEntries([...world.accounts.values()].map((a) => [a.address, a.publicKey])))};
  const persona = (location.search.match(/[?&]as=([A-Za-z0-9]+)/) || [])[1] || 'admin';
  if (persona === 'outside') {
    // No Hub: hide qortalRequest from the app (the check assigns it after this script).
    let hidden;
    Object.defineProperty(window, 'qortalRequest', { configurable: true, get: () => undefined, set: (v) => { hidden = v; } });
    Object.defineProperty(window, 'qortalRequestWithTimeout', { configurable: true, get: () => undefined, set: () => {} });
  }
  window.__qplusAnswer = async (p) => {
    switch (p.action) {
      case 'GET_USER_ACCOUNT': {
        if (persona === 'signedOut') throw { error: 'User declined request', message: 'User declined request' };
        const me = PEOPLE[persona] || PEOPLE.admin;
        return { address: me.address, publicKey: KEYS[me.address] };
      }
      case 'OPEN_NEW_TAB': return true;
      default:
        // Writes (INVITE_TO_GROUP, SIGN_TRANSACTION, JOIN_GROUP, PUBLISH_…) are always declined.
        throw { error: 'User declined request', message: 'User declined request' };
    }
  };
`;

const json = (route, status, body) =>
  route
    .fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    .then(() => true);

const wait = (selector) => async (page) =>
  page.waitForSelector(selector, { timeout: 8000 }).catch(() => {});
const settle = wait('main h1');
/** An Explorer page: its title, then its reads (skeletons gone, network quiet). */
/** Three questions asked before, as the quiz's history keeps them. */
const QUIZ_HISTORY = [
  {
    key: 'screens:h1',
    at: Date.UTC(2026, 9, 16, 21, 5),
    level: 'easy',
    kicker: 'Higher or lower',
    parts: [
      {
        kind: 'text',
        text: 'Leo Learner is level 2. Is Lou Left’s level higher, lower, or the same?',
      },
    ],
    answer: 'Higher',
    outcome: 'right',
    misses: 0,
    hints: 0,
    how: 'Each account’s level is in its header and in Overview → At a glance.',
    fact: 'Lou Left is level 5.',
    link: `/explorer/account/${ADDR.left}`,
    linkLabel: 'Open its Overview',
  },
  {
    key: 'screens:h2',
    at: Date.UTC(2026, 9, 16, 21, 12),
    level: 'tricky',
    kicker: 'Minting archaeology',
    parts: [
      { kind: 'text', text: 'Which account made the third self share in the 1,000 blocks from ' },
      { kind: 'block', height: 1_371_000 },
      { kind: 'text', text: '?' },
    ],
    answer: 'Kit Kicked (QTPsuqjhsBD1aLQTWGmCH3cAXwX4Z5XVPz)',
    outcome: 'shown',
    misses: 2,
    hints: 2,
    how: 'Transactions on Qortal → Reward share → From a block, Oldest first, Reward share kind “Self shares”: count down the list.',
    link: '/explorer/transactions?type=REWARD_SHARE&blocks=from-1371000&span=1000&order=oldest&share=self',
    linkLabel: 'Show those self shares',
  },
  {
    key: 'screens:h3',
    at: Date.UTC(2026, 9, 16, 21, 20),
    level: 'expert',
    kicker: 'Chain history',
    parts: [
      {
        kind: 'text',
        text: 'The very first poll on Qortal came in the 10,000 blocks from block 950,000. What was the poll called?',
      },
    ],
    answer: 'Puppy Ears Vote',
    outcome: 'skipped',
    misses: 0,
    hints: 0,
    how: 'Transactions on Qortal → Poll created → From block 950,000, 10,000 blocks, Oldest first: the first row.',
    fact: 'It asked: “Are puppy ears soft?” Its options: “Yes, very”, “Quite so”, “Very much so.”',
    link: '/explorer/transactions?type=CREATE_POLL&blocks=from-950000&order=oldest',
    linkLabel: 'Show it, oldest first',
  },
];

/** The Explorer Quiz with one question open (and, `status` right, answered), kept on the device. */
const quizState = (status) => ({
  v: 1,
  on: true,
  folded: false,
  question: {
    v: 1,
    key: 'screens:sponsor',
    template: 'sponsor',
    level: 'medium',
    theme: 'minting',
    kicker: 'Minting archaeology',
    tip: TIP,
    parts: [
      { kind: 'text', text: 'Who sponsored ' },
      { kind: 'account', address: ADDR.learner, name: 'Leo Learner' },
      { kind: 'text', text: '? If more than one account did, the one Core counts.' },
    ],
    answer: { kind: 'account', address: SPONSOR.address, name: SPONSOR.name },
    placeholder: 'A name or an address',
    hint: 'Sponsors are in Connections, under Reward shares.',
    hint2: 'Its sponsor’s reward share started in block 1,371,641.',
    fact: 'That reward share started in block 1,371,641.',
    how: 'Connections → Reward shares: “Sponsored by …”. When several accounts sponsored it, the one Core counts is marked “the sponsor Core counts”.',
    link: `/explorer/account/${ADDR.learner}/connections`,
    linkLabel: 'Open its Connections',
    // Asked of a viewer who sees Connections: shown once that is known.
    full: true,
  },
  status,
  misses: 1,
  hints: status === 'asking' ? 1 : 0,
  level: null,
  score: {
    asked: 4,
    right: status === 'right' ? 3 : 2,
    streak: status === 'right' ? 2 : 0,
    best: 3,
  },
  asked: ['screens:sponsor'],
  history: QUIZ_HISTORY,
});
/** A multiple-choice question, answered with a wrong pick: the right one green, the pick red. */
const quizChoice = () => ({
  ...quizState('shown'),
  question: {
    v: 1,
    key: 'screens:veteran',
    template: 'earliestSeen',
    level: 'tricky',
    theme: 'time',
    kicker: 'Who came first?',
    tip: TIP,
    parts: [
      { kind: 'text', text: 'Who’s the veteran? Which of these four was first seen earliest?' },
    ],
    answer: {
      kind: 'choice',
      options: [
        ['learner', 'Leo Learner'],
        ['left', 'Lou Left'],
        ['kicked', 'Kit Kicked'],
        ['admin', 'Avery Admin'],
      ].map(([who, name]) => ({
        parts: [{ kind: 'account', address: ADDR[who], name }],
        label: name,
      })),
      correct: 3,
    },
    placeholder: '',
    hint: 'Overview → At a glance → First seen, for each of them.',
    how: 'Each account’s Overview → At a glance → First seen gives the block; the lowest wins.',
    fact: 'Leo Learner: block 1,364,165 · Lou Left: block 1,360,000 · Kit Kicked: block 1,371,000 · Avery Admin: block 1,200,000',
    link: `/explorer/account/${ADDR.admin}`,
    linkLabel: 'Open the veteran',
  },
  picked: 1,
  status: 'shown',
});
const withQuiz = (status) => async (page) => {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [
      'qmintershipplus-explorer-quiz',
      JSON.stringify(status === 'choice' ? quizChoice() : quizState(status)),
    ]
  );
  await page.reload({ waitUntil: 'load' });
  await explorerSettle(page);
  const bar = page.getByRole('region', { name: 'Explorer Quiz' });
  await bar.waitFor({ timeout: 8000 }).catch(() => {});
  // A question that points to Connections shows once the viewer's access is read.
  await bar
    .getByText(status === 'choice' ? 'Who’s the veteran?' : 'Who sponsored', { exact: false })
    .first()
    .waitFor({ timeout: 8000 })
    .catch(() => {});
};

const explorerSettle = async (page) => {
  await settle(page);
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page
    .waitForFunction(
      () =>
        !document.querySelector('main [role="status"][aria-busy="true"], main .MuiSkeleton-root'),
      null,
      { timeout: 8000 }
    )
    .catch(() => {});
  await page.waitForTimeout(400);
};

/** Settle, then press a button and wait for the dialog it opens. */
const open = (button, dialog) => async (page) => {
  await settle(page);
  await page.getByRole('button', { name: button, exact: true }).first().click({ timeout: 4000 });
  await page.getByRole('dialog', { name: dialog }).waitFor({ timeout: 8000 });
  await page.waitForTimeout(400);
};

/** Open a card's comments (its "Comments (n)" toggle) and wait for the thread. */
const comments = (toggle, text) => async (page) => {
  await settle(page);
  await page.getByRole('button', { name: toggle }).first().click({ timeout: 8000 });
  await page.getByText(text).first().waitFor({ timeout: 8000 });
  await page.waitForTimeout(300);
};
const WREN_COMMENTS = /^Comments \(\d+\): the nomination of Wren Waiting$/;

/**
 * Propose wherever it is (the header's button, or the floating one on phones),
 * then one of its choices (a menu, or a sheet of buttons on phones).
 */
/** A + Propose page (Simon, 2026-10-18: a page each), settled with its list in. */
const proposePage = (listName) => async (page) => {
  await settle(page);
  await page.getByRole('list', { name: listName }).waitFor({ timeout: 8000 });
  await page.waitForTimeout(400);
};

/** A + Propose page for MINTER's members: its dropdown open on what was typed. */
const memberDropdown = (typed, label) => async (page) => {
  await settle(page);
  await page.getByRole('combobox', { name: label }).fill(typed, { timeout: 8000 });
  await page.getByRole('listbox').getByRole('option').first().waitFor({ timeout: 8000 });
  await page.waitForTimeout(400);
};

/**
 * Home with an earlier visit on this device (e2e/world.mjs → lastVisitSnapshots):
 * the snapshot is put in place before the app loads again, so "Since your
 * last visit" compares with it.
 */
const visits = lastVisitSnapshots(world);
/** An account's Connections as a list (kept on the device; the circle is the default). */
const asList = async (page) => {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    ['qmintershipplus-connections-view', 'list']
  );
  await page.reload({ waitUntil: 'load' });
  await explorerSettle(page);
  await page.getByRole('region', { name: 'Recorded between them' }).waitFor({ timeout: 8000 });
};

const sinceLastVisit = (persona, ready) => async (page) => {
  const { address, snapshot } = visits[persona];
  await page.addInitScript(
    ([key, value]) => {
      try {
        localStorage.setItem(key, value);
      } catch {
        // No storage: the screen shows no panel, and the wait below says so.
      }
    },
    [lastVisitStorageKey(address), JSON.stringify(snapshot)]
  );
  await page.reload({ waitUntil: 'load' });
  await settle(page);
  await page.getByRole('region', { name: 'Since your last visit' }).waitFor({ timeout: 8000 });
  if (ready) await page.getByText(ready).first().waitFor({ timeout: 8000 });
  await page.waitForTimeout(400);
};

/** Settings in a Hub that offers app alerts (none set up yet), reached from Home. */
const hubAlertsOffered = async (page) => {
  await settle(page);
  await page.evaluate(() => {
    const answer = window.__qplusAnswer;
    window.__qplusAnswer = async (p) => {
      if (p.action === 'SHOW_ACTIONS')
        return [
          'GET_USER_ACCOUNT',
          'NOTIFICATION_PERMISSION',
          'NOTIFICATION_ADD',
          'NOTIFICATION_GET',
          'NOTIFICATION_REMOVE',
        ];
      if (p.action === 'NOTIFICATION_GET') return [];
      return answer(p);
    };
  });
  await page
    .getByRole('button', { name: 'Settings', exact: true })
    .first()
    .click({ timeout: 4000 });
  await page.getByText(/Hub tells you when a new nomination/).waitFor({ timeout: 8000 });
  await page.waitForTimeout(400);
};

export default {
  name: 'Q-Mintership+',
  themeKey: 'qmintershipplus-ui-theme',
  ignoreErrors: /favicon/,

  async setup({ browser }) {
    const gen = await browser.newPage({ viewport: { width: 64, height: 64 } });
    await gen.setContent(
      '<body style="margin:0"><div style="width:64px;height:64px;background:linear-gradient(135deg,#73d0c3,#84aff0)"></div></body>'
    );
    PNG = await gen.screenshot({ clip: { x: 0, y: 0, width: 64, height: 64 } });
    await gen.close();
  },

  // The page's clock starts at the world's NOW (as the unit tests do), so
  // countdowns and "3 days ago" read the same in every run.
  initScripts: () => [
    `(() => {
      const offset = ${NOW} - Date.now();
      const RealDate = Date;
      class WorldDate extends RealDate {
        constructor(...args) {
          if (args.length) super(...args);
          else super(RealDate.now() + offset);
        }
        static now() {
          return RealDate.now() + offset;
        }
      }
      window.Date = WorldDate;
    })();`,
    // One browser profile serves every screen of a theme and size: the Quiz a quiz screen
    // opened (withQuiz sets it again, after this) mustn't cover the screens after it.
    `(() => {
      try {
        localStorage.removeItem('qmintershipplus-explorer-quiz');
        // The circle a circle screen picked is saved too: the screens after it start as a list.
        localStorage.removeItem('qmintershipplus-connections-view');
        localStorage.removeItem('qmintershipplus-connections-circle-order');
        // And the list an Assets screen picked.
        localStorage.removeItem('qmintershipplus-assets-view');
        // Page width as the run asks (QMP_PAGE_WIDTH), not as a *-full screen left it.
        ${
          process.env.QMP_PAGE_WIDTH === 'full'
            ? `localStorage.setItem('qmintershipplus-page-width', '"full"');`
            : `localStorage.removeItem('qmintershipplus-page-width');`
        }
      } catch (e) {}
    })();`,
  ],

  qortal,

  async route(route, url) {
    if (url.pathname.includes('/THUMBNAIL/') || url.pathname.startsWith('/arbitrary/IMAGE/')) {
      await route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
      return true;
    }
    const answer =
      answerNameSearch(worldFor(route), url.pathname, url.searchParams) ??
      answerCore(worldFor(route), url.pathname, url.searchParams);
    if (!answer) return false;
    if (answer.text !== undefined) {
      await route.fulfill({ status: answer.status, contentType: 'text/plain', body: answer.text });
      return true;
    }
    return json(route, answer.status, answer.body);
  },

  // One Home per status, then the other screens as an admin and as a member.
  screens: [
    { key: 'home-outside', path: '/?as=outside', after: settle },
    { key: 'home-signedout', path: '/?as=signedOut', after: settle },
    { key: 'home-admin', path: '/?as=admin', after: settle },
    { key: 'home-nominator', path: '/?as=nominator', after: settle },
    { key: 'home-learner', path: '/?as=learner', after: settle },
    { key: 'home-newcomer', path: '/?as=newcomer', after: settle },
    { key: 'home-newcomer-name', path: '/?as=newcomerName', after: settle },
    { key: 'home-nominated', path: '/?as=nominatedWaiting', after: settle },
    { key: 'home-signing', path: '/?as=nominatedSigning', after: settle },
    { key: 'home-approved', path: '/?as=approved', after: settle },
    { key: 'home-kicked', path: '/?as=kicked', after: settle },
    { key: 'home-banned', path: '/?as=banned', after: settle },
    { key: 'home-left', path: '/?as=left', after: settle },
    // A newcomer whose join request was sent before: the line on what happens to it.
    { key: 'home-ready', path: '/?as=ready', after: settle },
    { key: 'nominations', path: '/decisions?show=nominations&as=nominator', after: settle },
    // + Propose's choices, a page each in Propose nomination's style (Simon, 2026-10-18), each
    // with its list to pick from: who asked to join (Decline a join request), and searched by
    // a name resolved to its owner.
    {
      key: 'propose-decline',
      path: '/propose/decline-join-request?as=admin',
      after: proposePage('Requested to join MINTER Group'),
    },
    {
      key: 'propose-decline-search',
      path: '/propose/decline-join-request?as=admin',
      after: async (page) => {
        await proposePage('Requested to join MINTER Group')(page);
        await page
          .getByRole('searchbox', { name: 'Search who asked to join MINTER, by name or address' })
          .fill('fern', { timeout: 4000 });
        const row = page.getByRole('link', {
          name: `${FORMER_READY.removed.name}: open their page`,
        });
        await row.waitFor({ timeout: 8000 });
        await row.evaluate((link) => link.closest('li')?.scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(400);
      },
    },
    // MINTER's members (Remove a member, Ban an account, Make a Minter Admin): a dropdown while
    // typing, not a list (Simon, 2026-10-18); then one picked with its reason; a ban's length.
    {
      key: 'propose-remove-member',
      path: '/propose/remove-member?as=admin',
      after: memberDropdown('Admin', 'Member’s name or address'),
    },
    {
      key: 'propose-remove-member-picked',
      path: `/propose/remove-member?who=${ADDR.learner}&as=admin`,
      after: async (page) => {
        await settle(page);
        await page.getByText('Nothing stops this proposal.').waitFor({ timeout: 8000 });
        await page.getByRole('textbox', { name: 'Reason' }).fill('Not minting for 6 months');
        await page.waitForTimeout(300);
      },
    },
    {
      key: 'propose-ban',
      path: '/propose/ban?as=admin',
      after: memberDropdown('Zo', 'Name or Qortal address'),
    },
    {
      key: 'propose-ban-picked',
      path: `/propose/ban?who=${ADDR.learner}&as=admin`,
      after: async (page) => {
        await settle(page);
        await page.getByText('Nothing stops this proposal.').waitFor({ timeout: 8000 });
        await page.getByRole('textbox', { name: 'Reason' }).fill('Spam in Q-Chat');
        await page.getByRole('radio', { name: /^A number of days/ }).check({ timeout: 4000 });
        const length = page.getByRole('textbox', { name: 'Days' });
        await length.fill('7');
        await length.evaluate((el) => el.scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(300);
      },
    },
    {
      key: 'propose-make-admin',
      path: '/propose/make-minter-admin?as=admin',
      after: memberDropdown('Member', 'Member’s name or address'),
    },
    // The Minter Admins, with the one whose removal waits crossed out; yourself points to Step down.
    {
      key: 'propose-remove-admin',
      path: '/propose/remove-minter-admin?as=admin',
      after: proposePage('Minter Admins'),
    },
    {
      key: 'propose-remove-admin-self',
      path: `/propose/remove-minter-admin?who=${ADDR.admin}&as=admin`,
      after: async (page) => {
        await settle(page);
        await page
          .getByRole('link', { name: 'Open your Minter Profile' })
          .waitFor({ timeout: 8000 });
        await page.waitForTimeout(300);
      },
    },
    // The bans in force (Lift a ban), and the approved invites (Cancel an approved invite).
    {
      key: 'propose-lift-ban',
      path: '/propose/lift-ban?as=admin',
      after: proposePage('Bans in force'),
    },
    {
      key: 'propose-cancel-invite',
      path: '/propose/cancel-invite?as=admin',
      after: proposePage('Approved invites'),
    },
    // The nominee's own card comes first, with Accept nomination.
    {
      key: 'nominations-nominee',
      path: '/decisions?show=nominations&as=nominatedWaiting',
      after: settle,
    },
    // Someone who isn't a Minter Admin: No and Yes on the cards, their own vote on Wren's.
    {
      key: 'nominations-community',
      path: '/decisions?show=nominations&as=learner',
      after: async (page) => {
        await settle(page);
        await page
          .getByRole('group', { name: 'Your vote on bob+builder' })
          .waitFor({ timeout: 8000 });
      },
    },
    {
      key: 'nominations-community-voters',
      path: '/decisions?show=nominations&as=learner',
      overlay: true,
      after: async (page) => {
        await settle(page);
        await page
          .getByRole('article', { name: 'Nomination of bob+builder' })
          .getByRole('button', { name: /^Community votes: / })
          .click({ timeout: 8000 });
        await page.getByRole('dialog', { name: 'Community votes' }).waitFor({ timeout: 8000 });
        await page.waitForTimeout(400);
      },
    },
    {
      key: 'nominations-community-vote',
      path: '/decisions?show=nominations&as=learner',
      overlay: true,
      after: async (page) => {
        await settle(page);
        await page.getByRole('button', { name: 'Vote Yes: bob+builder' }).click({ timeout: 8000 });
        await page.getByRole('dialog', { name: 'Vote Yes' }).waitFor({ timeout: 8000 });
        await page.waitForTimeout(400);
      },
    },
    { key: 'nominate', path: '/nominate?as=nominator', after: settle },
    // A candidate picked from a link. `who` comes first: the check appends
    // `?theme=` to the last value (the app ignores it, see appParam).
    {
      key: 'nominate-picked',
      path: `/nominate?who=${ADDR.newcomerName}&as=nominator`,
      after: wait('main textarea'),
    },
    { key: 'decisions', path: '/decisions?as=admin', after: settle },
    { key: 'decisions-member', path: '/decisions?show=decisions&as=learner', after: settle },
    // By type: a section per kind of change, with the chips that jump to each.
    {
      key: 'decisions-by-type',
      path: '/decisions?as=admin',
      after: async (page) => {
        await page.addInitScript(
          ([key, value]) => window.localStorage.setItem(key, value),
          ['qmintershipplus-decisions-order', JSON.stringify('type')]
        );
        await page.reload({ waitUntil: 'load' });
        await settle(page);
        await page
          .getByRole('navigation', { name: 'Decisions by type' })
          .waitFor({ timeout: 8000 });
      },
    },
    // Propose's choices, then cancelling an approved invite up to its two Hub steps.
    {
      key: 'decisions-propose',
      path: '/decisions?as=admin',
      overlay: true,
      after: async (page) => {
        await settle(page);
        await page.getByRole('button', { name: 'Propose', exact: true }).click({ timeout: 4000 });
        await page.waitForTimeout(500);
      },
    },
    // Cancelling one approved invite, up to its two Hub steps.
    {
      key: 'propose-cancel-invite-hub',
      path: `/propose/cancel-invite?who=${fakeAddress('stale-2')}&as=admin`,
      overlay: true,
      after: async (page) => {
        await settle(page);
        await page.getByText('Nothing stops this proposal.').waitFor({ timeout: 8000 });
        await page.getByRole('button', { name: /^Propose cancelling/ }).click({ timeout: 4000 });
        await page
          .getByRole('dialog', { name: /^Cancel an approved invite: / })
          .waitFor({ timeout: 8000 });
        await page.waitForTimeout(400);
      },
    },
    // Reject, Reject after approving and Considering: each explained, with its fee, before Hub.
    {
      key: 'decisions-reject',
      path: '/decisions?as=admin',
      overlay: true,
      after: open('Reject: Add to MINTER, bob+builder', 'Reject this decision'),
    },
    {
      key: 'decisions-withdraw',
      path: '/decisions?as=admin',
      overlay: true,
      after: open('Reject: Add to MINTER, Uma Urgent', 'Reject after approving'),
    },
    {
      key: 'decisions-considering',
      path: '/decisions?as=admin',
      overlay: true,
      after: open('Considering: Add to MINTER, bob+builder', 'Mark as considering'),
    },
    // Propose cancelling all (Cancel an approved invite): two Hub steps for each older one.
    {
      key: 'propose-cancel-all',
      path: '/propose/cancel-invite?as=admin',
      overlay: true,
      after: async (page) => {
        await proposePage('Approved invites')(page);
        await page
          .getByRole('button', { name: /^Propose cancelling all \d+ older ones$/ })
          .click({ timeout: 8000 });
        await page.getByRole('dialog', { name: 'Cancel stale invites' }).waitFor({ timeout: 8000 });
        await page.waitForTimeout(400);
      },
    },
    // A nominee's own Minter Profile: Accept nomination on their card (the profile lives in the
    // Explorer now; the Minter Admin's view of it is explorer-mintership).
    {
      key: 'profile-own-nominee',
      path: `/explorer/account/${ADDR.nominatedWaiting}/mintership?as=nominatedWaiting`,
      after: async (page) => {
        await settle(page);
        await page.getByRole('button', { name: 'Accept nomination' }).waitFor({ timeout: 8000 });
        await page.waitForTimeout(400);
      },
    },
    { key: 'history', path: '/history?as=learner', after: settle },
    // On chain, one type searched by type over 120 days: Bans, with the ban from 61 days ago.
    { key: 'history-filter', path: '/history?as=learner&type=ban&period=120', after: settle },
    // All types over a period: the last 120 days, read as four 30-day windows.
    { key: 'history-period', path: '/history?as=learner&period=120', after: settle },
    // Scan all History: every 30-day window back to MINTER's start.
    {
      key: 'history-all',
      path: '/history?as=learner&period=all',
      after: async (page) => {
        await settle(page);
        await page.getByText(/ events since MINTER began\.$/).waitFor({ timeout: 15000 });
        await page.waitForTimeout(400);
      },
    },
    // A Minter Admin who last had History open at TIP − 6,000: what was decided since is
    // marked New, with how many.
    {
      key: 'history-news',
      path: '/history?as=admin',
      after: async (page) => {
        await page.addInitScript(
          ([key, value]) => {
            try {
              localStorage.setItem(key, value);
            } catch {
              // No storage: nothing is new, and the wait below says so.
            }
          },
          [
            `qmintershipplus-history-seen-${ADDR.admin}`,
            JSON.stringify({ v: 1, height: TIP - 6_000 }),
          ]
        );
        await page.reload({ waitUntil: 'load' });
        await settle(page);
        await page.getByText(/new since you last looked, marked New\.$/).waitFor({ timeout: 8000 });
        await page.waitForTimeout(400);
      },
    },
    // An old card from the original app (e2e/world-legacy.mjs), with its poll and comments.
    {
      key: 'legacy-card',
      path: '/history/card/Minter-board-card-bQ7xK2?as=learner',
      after: wait('#legacy-poll-title'),
    },
    // The original Admin Board, decrypted for a Minter Admin (e2e/world-legacy.mjs): a card
    // with its poll and comments (one comment not encrypted to them), and a card that wasn't.
    {
      key: 'legacy-admin-card',
      path: `/history/card/${ADMIN_BOARD_IDS.removal}?as=admin`,
      after: withDecrypt(wait('#legacy-comments-title')),
    },
    {
      key: 'legacy-admin-card-locked',
      path: `/history/card/${ADMIN_BOARD_IDS.locked}?as=admin`,
      after: withDecrypt(wait('main h2')),
    },
    // History's Admin Board filter, as a Minter Admin.
    {
      key: 'history-admin-board',
      path: '/history?as=admin',
      after: withDecrypt(async (page) => {
        await settle(page);
        await page.getByRole('button', { name: 'Admin Board' }).click({ timeout: 8000 });
        await page.getByText('Remove Member 12 from MINTER?').waitFor({ timeout: 8000 });
        await page.waitForTimeout(400);
      }),
    },
    { key: 'activity', path: '/explorer/activity?as=admin', after: settle },
    // A Minter Admin who last had History open at TIP − 6,000: three changes decided since
    // count on History in the navigation (the rail, or the phone bar: History is in both).
    {
      key: 'activity-history-news',
      path: '/explorer/activity?as=admin',
      after: async (page) => {
        await page.addInitScript(
          ([key, value]) => {
            try {
              localStorage.setItem(key, value);
            } catch {
              // No storage: no count, and the wait below says so.
            }
          },
          [
            `qmintershipplus-history-seen-${ADDR.admin}`,
            JSON.stringify({ v: 1, height: TIP - 6_000 }),
          ]
        );
        await page.reload({ waitUntil: 'load' });
        await settle(page);
        await page
          // Chrome puts a space before the hidden ", 3 new" (the label is a block of its own).
          .getByRole('button', { name: /^History\s*,\s*\d+ new$/ })
          .first()
          .waitFor({ timeout: 8000 });
        await page.waitForTimeout(1500);
      },
    },
    { key: 'activity-member', path: '/explorer/activity?as=learner', after: settle },
    { key: 'settings', path: '/settings?as=admin', after: settle },
    // Page width: Full window (crowetic, 2026-10-23). Settings with it picked, and Decisions,
    // whose cards sit side by side once two fit (only past the five sizes; --sizes 1920x1080).
    {
      key: 'settings-full',
      path: '/settings?as=admin',
      after: async (page) => {
        await page.addInitScript(() =>
          window.localStorage.setItem('qmintershipplus-page-width', '"full"')
        );
        await page.reload({ waitUntil: 'load' });
        await settle(page);
        await page.getByRole('combobox', { name: 'Page width' }).waitFor({ timeout: 8000 });
      },
    },
    {
      key: 'decisions-full',
      path: '/decisions?as=admin',
      after: async (page) => {
        await page.addInitScript(() =>
          window.localStorage.setItem('qmintershipplus-page-width', '"full"')
        );
        await page.reload({ waitUntil: 'load' });
        await settle(page);
      },
    },
    // A moving target (e2e/world.mjs addTargetShift): the "target changed" note
    // (this device last saw 23 admin seats), the chips, and an admin change's impact.
    {
      key: 'decisions-target-shift',
      path: '/decisions?world=shift&as=admin',
      after: async (page) => {
        // Set before the app starts, so its first read is the old target.
        await page.addInitScript(
          ([key, value]) => window.localStorage.setItem(key, value),
          ['qmintershipplus-seen-target-694', JSON.stringify(shift.seenBefore)]
        );
        await page.reload({ waitUntil: 'load' });
        await settle(page);
        await page
          .getByRole('heading', { name: 'The target changed from 10 to 9 approvals' })
          .waitFor({ timeout: 8000 });
      },
    },
    // Approving that admin change: the impact, and the box to tick before Hub opens.
    {
      key: 'decisions-admin-impact',
      path: '/decisions?world=shift&as=admin',
      overlay: true,
      after: async (page) => {
        await settle(page);
        await page
          .getByRole('button', { name: /^Approve: Remove a Minter Admin, Dex Demote/ })
          .click({ timeout: 4000 });
        const dialog = page.getByRole('dialog', { name: 'Approve this decision' });
        await dialog.waitFor({ timeout: 8000 });
        await dialog.getByRole('button', { name: 'Continue to Hub' }).click({ timeout: 4000 });
        await dialog.getByText('Tick “I’ve checked these” to go on.').waitFor({ timeout: 4000 });
        await page.waitForTimeout(300);
      },
    },
    // Shareable links: one decision waiting (Approve), one decided, and one nomination with its rounds.
    {
      key: 'decision-pending',
      path: `/decisions/${PENDING_SIG}?as=admin`,
      after: wait('main article'),
    },
    {
      key: 'decision-decided',
      path: `/decisions/${DECIDED_SIG}?as=learner`,
      after: wait('main [aria-label^="Approved by"]'),
    },
    {
      key: 'nomination',
      path: `/nominations/${ADDR.nominatedSigning}?as=nominator`,
      after: wait('main ol[aria-label="Rounds, newest first"]'),
    },
    // Public comments: a thread with replies, a deleted one and a hidden one (folded).
    {
      key: 'comments-thread',
      path: `/explorer/account/${ADDR.nominatedWaiting}/mintership?as=nominator`,
      after: comments(WREN_COMMENTS, 'Wren helped me set up my node'),
    },
    // A Minter Admin's view of the hidden comment, unfolded with Show anyway.
    {
      key: 'comments-hidden',
      path: `/explorer/account/${ADDR.nominatedWaiting}/mintership?as=admin`,
      after: async (page) => {
        await comments(WREN_COMMENTS, 'Wren helped me set up my node')(page);
        await page.getByRole('button', { name: 'Show anyway: hidden comment' }).click();
        await page.getByText('Hidden by a Minter Admin. You chose to show it.').waitFor();
      },
    },
    // Posting: what is published, under which name, and the fee, before Hub opens.
    {
      key: 'comments-post',
      path: `/explorer/account/${ADDR.nominatedWaiting}/mintership?as=nominator`,
      overlay: true,
      after: async (page) => {
        await comments(WREN_COMMENTS, 'Wren helped me set up my node')(page);
        await page
          .getByRole('textbox', { name: 'Write a comment' })
          .fill('Wren keeps a steady node and helps newcomers: qortal://WEBSITE/WrenNodeGuide');
        await page.getByRole('button', { name: 'Post', exact: true }).click();
        await page.getByRole('dialog', { name: 'Post your comment' }).waitFor({ timeout: 8000 });
        await page.waitForTimeout(400);
      },
    },
    // A decision's comments include its nomination's from before the first signature.
    {
      key: 'decisions-comments',
      path: '/decisions?as=admin',
      after: comments(
        /^Comments \(\d+\): Add to MINTER, bob\+builder$/,
        'Their node has been steady all month'
      ),
    },
    // What changed since an earlier visit: an admin's and a nominee's Home.
    {
      key: 'home-since-admin',
      path: '/?as=admin',
      after: sinceLastVisit('admin', /Approved in block/),
    },
    {
      key: 'home-since-nominee',
      path: '/?as=nominatedSigning',
      after: sinceLastVisit('nominatedSigning'),
    },
    // Settings → Notifications where Hub offers app alerts.
    { key: 'settings-alerts', path: '/?as=admin', after: hubAlertsOffered },
    // Doubles (e2e/world.mjs addDoubles): Decisions as an admin, with the three doubles
    // after the real decisions, and Admin C's second "Become a Minter Admin" on its own page.
    {
      key: 'decisions-double',
      path: '/decisions?as=admin',
      after: withDoubles(null, async (page) => {
        await settle(page);
        const first = page.getByRole('article', { name: 'Become a Minter Admin, Admin C' });
        await first.getByRole('note').waitFor({ timeout: 8000 });
        // Landscape phones take the viewport: the first double's card from its top.
        await first.evaluate((card) => card.scrollIntoView({ block: 'start' }));
        await page.waitForTimeout(300);
      }),
    },
    {
      key: 'decision-double',
      path: '/decisions?as=admin',
      after: withDoubles(
        (d) => d.alreadyAdmin.signature,
        async (page) => {
          await settle(page);
          await page.getByRole('main').getByRole('note').first().waitFor({ timeout: 8000 });
          await page.waitForTimeout(300);
        }
      ),
    },
    // An admin's Home when the target moved since Decisions last showed it (9 then, 8 now).
    {
      key: 'home-target-changed',
      path: '/?as=admin',
      after: async (page) => {
        // A last visit left by a screen with its own world (the doubles) would make Since
        // your last visit ask the default world about decisions it never had.
        await page.addInitScript(
          ([key, value]) => {
            for (const k of Object.keys(window.localStorage))
              if (k.startsWith('qmintershipplus-last-visit-')) window.localStorage.removeItem(k);
            window.localStorage.setItem(key, value);
          },
          ['qmintershipplus-seen-target-694', JSON.stringify({ adminCount: 21, needed: 9 })]
        );
        await page.reload({ waitUntil: 'load' });
        await settle(page);
        await page.getByRole('link', { name: 'See what changed' }).waitFor({ timeout: 8000 });
      },
    },
    // Step down as Minter Admin lives on the admin's own Minter Profile.
    {
      key: 'person-own-admin',
      path: `/explorer/account/${ADDR.adminL4}/mintership?as=adminL4`,
      after: async (page) => {
        await settle(page);
        await page
          .getByRole('button', { name: 'Step down as Minter Admin' })
          .waitFor({ timeout: 8000 });
      },
    },
    // A member below level 5: Become a Minter Admin, with the level 5+ note beside it.
    {
      key: 'person-own-member',
      path: `/explorer/account/${ADDR.learner}/mintership?as=learner`,
      after: async (page) => {
        await settle(page);
        await page.getByText(/is suggested for Minter Admins/).waitFor({ timeout: 8000 });
      },
    },
    // Settings → Muted names, with three names muted on this device (one long, none of
    // them a commenter in the mock world). The list is cleared again before the
    // capture (the page keeps what it read), so later screens see no muted names.
    {
      key: 'settings-muted',
      path: '/settings?as=admin',
      after: async (page) => {
        const KEY = 'qmintershipplus-muted-names';
        await page.addInitScript(
          ([key, value]) => {
            try {
              localStorage.setItem(key, value);
            } catch {
              // No storage: the section shows its empty note.
            }
          },
          [
            KEY,
            JSON.stringify(['Loud One', 'a-rather-long-registered-name-for-qortal', 'Spam Bot 42']),
          ]
        );
        await page.reload({ waitUntil: 'load' });
        await settle(page);
        const section = page.getByRole('region', { name: 'Muted names' });
        await section
          .getByRole('button', { name: 'Unmute Spam Bot 42' })
          .waitFor({ timeout: 8000 });
        await page.evaluate((key) => {
          try {
            localStorage.removeItem(key);
          } catch {
            // Nothing was stored.
          }
        }, KEY);
        await page.waitForTimeout(300);
      },
    },
    // A nominator's Home after an earlier visit: how the nominations she made ended.
    {
      key: 'home-since-nominator',
      path: '/?as=nominator',
      after: async (page) => {
        const { address, snapshot } = nominatorLastVisit(world);
        await page.addInitScript(
          ([key, value]) => {
            try {
              localStorage.setItem(key, value);
            } catch {
              // No storage: the screen shows no panel, and the wait below says so.
            }
          },
          [lastVisitStorageKey(address), JSON.stringify(snapshot)]
        );
        await page.reload({ waitUntil: 'load' });
        await settle(page);
        await page
          .getByRole('region', { name: 'Since your last visit' })
          .getByText(/^Your nomination of .+ expired$/)
          .waitFor({ timeout: 8000 });
        await page.waitForTimeout(400);
      },
    },
    // Settings → Notifications for a level 5+ nominator, in a Hub that offers app alerts.
    {
      key: 'settings-alerts-nominator',
      path: '/?as=nominator',
      after: async (page) => {
        await settle(page);
        await page.evaluate(() => {
          const answer = window.__qplusAnswer;
          window.__qplusAnswer = async (p) => {
            if (p.action === 'SHOW_ACTIONS')
              return [
                'GET_USER_ACCOUNT',
                'NOTIFICATION_PERMISSION',
                'NOTIFICATION_ADD',
                'NOTIFICATION_GET',
                'NOTIFICATION_REMOVE',
              ];
            if (p.action === 'NOTIFICATION_GET') return [];
            return answer(p);
          };
        });
        await page
          .getByRole('button', { name: 'Settings', exact: true })
          .first()
          .click({ timeout: 4000 });
        await page.getByText(/^Support alerts cover the nominations you made/).waitFor({
          timeout: 8000,
        });
        await page.waitForTimeout(400);
      },
    },
    // Declines (e2e/world.mjs addDecline): Decline a join request, with Decline on the rows
    // without a nomination and one row whose decline is waiting; then one picked, with its
    // reason and a note for the Minter Admins.
    {
      key: 'propose-decline-waiting',
      path: '/propose/decline-join-request?as=admin',
      after: withDecline(async (page) => {
        await proposePage('Requested to join MINTER Group')(page);
        const waiting = page.getByRole('link', { name: /^A decline is waiting for Minter Admins/ });
        await waiting.waitFor({ timeout: 8000 });
        await page
          .getByRole('button', { name: /^Decline .*join request$/ })
          .first()
          .waitFor({ timeout: 8000 });
        await waiting.evaluate((link) => link.closest('li')?.scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(300);
      }),
    },
    {
      key: 'propose-decline-picked',
      path: '/propose/decline-join-request?as=admin',
      after: withDecline(async (page) => {
        await proposePage('Requested to join MINTER Group')(page);
        await page
          .getByRole('button', { name: /^Decline .*join request$/ })
          .first()
          .click({ timeout: 8000 });
        await page.getByText('Nothing stops this proposal.').waitFor({ timeout: 8000 });
        await page.getByRole('textbox', { name: 'Reason' }).fill('No node running');
        await page
          .getByRole('textbox', { name: 'Note for the Minter Admins (optional)' })
          .fill('Asked them twice in Q-Chat; no answer.');
        await page.waitForTimeout(300);
      }),
    },
    // Minter Admin polls (e2e/world.mjs addAdminPolls), encrypted to the Minter Admins: the
    // open ones on Decisions (one read from a share), the closed ones in History's timeline
    // (one closed two months ago), and one poll's own page with its comments open.
    // Ask the Minter Admins, a page as every + Propose choice is (Simon, 2026-10-18), with
    // answers of its own: one renamed, one recoloured, one added.
    {
      key: 'propose-ask',
      path: '/propose/ask-minter-admins?as=admin',
      after: async (page) => {
        await settle(page);
        await page
          .getByRole('textbox', { name: 'Question' })
          .fill('When should we review the stale invites next?', { timeout: 8000 });
        await page.getByRole('textbox', { name: 'Answer 1' }).fill('This week');
        await page.getByRole('combobox', { name: 'Answer 3’s colour' }).selectOption('red');
        await page.getByRole('button', { name: 'Add an answer' }).click();
        await page.getByRole('textbox', { name: 'Answer 4' }).fill('Next month');
        await page.getByRole('list', { name: 'Answers' }).scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
      },
    },
    {
      key: 'decisions-polls',
      path: '/decisions?as=admin',
      // The whole of Decisions with the polls is taller than one capture can be on phones:
      // the viewport, scrolled to the section (the checks still cover the whole page).
      overlay: true,
      after: withPolls(async (page) => {
        await settle(page);
        const section = page.getByRole('region', { name: /^Minter Admin polls · / });
        await section.getByRole('article').first().waitFor({ timeout: 8000 });
        // Landscape phones take the viewport: the section from its top.
        await section.evaluate((s) => s.scrollIntoView({ block: 'start' }));
        await page.waitForTimeout(300);
      }),
    },
    // History: the poll that closed in the last 30 days among the events (the viewport, at
    // its row), and Minter Admin polls alone over all of it, as Decisions' Closed polls opens it.
    {
      key: 'history-polls',
      path: '/history?as=admin',
      overlay: true,
      after: withPolls(async (page) => {
        await settle(page);
        const link = page.getByRole('link', { name: /^Open the poll: / }).first();
        await link.waitFor({ timeout: 8000 });
        await link.evaluate((a) => a.closest('li').scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(300);
      }),
    },
    {
      key: 'history-polls-only',
      path: '/history?as=admin&type=polls&period=all',
      after: withPolls(async (page) => {
        await settle(page);
        await page
          .getByRole('link', { name: /^Open the poll: / })
          .nth(1)
          .waitFor({ timeout: 8000 });
        await page.waitForTimeout(300);
      }),
    },
    // A note for the Minter Admins under a kick's public reason (Simon, 2026-10-18).
    {
      key: 'decisions-admin-note',
      path: '/decisions?as=admin',
      overlay: true,
      after: withPolls(async (page) => {
        await settle(page);
        // The note is read once its card nears the screen: bring the card there first.
        const card = page.getByRole('article', { name: /^Remove from MINTER, Kai Target/ }).first();
        await card.waitFor({ timeout: 8000 });
        await card.evaluate((el) => el.scrollIntoView({ block: 'start' }));
        await card.getByText('For the Minter Admins only').waitFor({ timeout: 8000 });
        await card.evaluate((el) => el.scrollIntoView({ block: 'start' }));
        await page.waitForTimeout(400);
      }),
    },
    // Comments for the Minter Admins only, in bob+builder's thread, and the choice of who can
    // read a new one.
    {
      key: 'decisions-admin-comments',
      path: '/decisions?as=admin',
      overlay: true,
      after: withPolls(async (page) => {
        await settle(page);
        await page
          .getByRole('button', { name: /^Comments \(\d+\): Add to MINTER, bob\+builder/ })
          .first()
          .click({ timeout: 8000 });
        const group = page.getByRole('radiogroup', { name: 'Who can read it' }).first();
        await group.waitFor({ timeout: 8000 });
        await page
          .getByText('Minter Admins only', { exact: true })
          .first()
          .waitFor({ timeout: 8000 });
        await group.getByRole('radio', { name: /Minter Admins only/ }).check();
        await group.evaluate((el) => el.scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(400);
      }),
    },
    {
      key: 'poll-page',
      // The check answers every URL with "/polls/" in it as Core's polls API, so the page
      // starts on Decisions and withPolls goes to /decisions/polls/<id> itself.
      path: '/decisions?as=admin',
      after: withPolls(async (page) => {
        await settle(page);
        await page
          .getByRole('region', { name: /^Comments on / })
          .locator('p', { hasText: /they know how the network works/ })
          .waitFor({ timeout: 8000 });
        await page.waitForTimeout(300);
      }, `/decisions/polls/${ADMIN_POLL_IDS.open}`),
    },
    // ---- The Explorer: accounts, their tabs, compare, transactions ----------------
    { key: 'explorer', path: '/explorer?as=admin', after: explorerSettle },
    { key: 'explorer-outside', path: '/explorer?as=outside', after: explorerSettle },
    {
      key: 'explorer-search',
      path: '/explorer?as=admin',
      overlay: true,
      after: async (page) => {
        await settle(page);
        await page
          .getByRole('combobox', { name: 'Find an account or transaction' })
          .fill('Av', { timeout: 4000 });
        await page.getByRole('option').first().waitFor({ timeout: 8000 });
        await page.waitForTimeout(500);
      },
    },
    {
      key: 'explorer-account',
      path: `/explorer/account/${ADDR.admin}?as=admin`,
      after: explorerSettle,
    },
    // Another account's groups as someone in none of them: Join, and Ask to join a closed one.
    {
      key: 'explorer-groups-join',
      path: `/explorer/account/${ADDR.kicked}?as=learner`,
      after: async (page) => {
        await explorerSettle(page);
        await page
          .getByRole('button', { name: 'Ask to join Book Club' })
          .waitFor({ timeout: 8000 });
      },
    },
    // Activity's settings: how much it reads at first, and the milestones it shows.
    {
      key: 'explorer-activity-settings',
      // The activity chart is for viewers who see the Explorer's detailed parts.
      path: `/explorer/account/${ADDR.admin}?as=nominator`,
      overlay: true,
      after: async (page) => {
        await explorerSettle(page);
        // Its reads (and the gear) start once the section nears the screen.
        await page.locator('#overview-activity-title').scrollIntoViewIfNeeded({ timeout: 8000 });
        await page.getByRole('button', { name: 'Activity settings' }).click({ timeout: 8000 });
        await page.getByRole('dialog', { name: 'Activity settings' }).waitFor({ timeout: 8000 });
        await page.waitForTimeout(400);
      },
    },
    // Activity with older history not read yet: Read older on every size, phones too
    // (Simon, 2026-10-18). Its first read set to 100, so the funder's history goes past it.
    {
      key: 'explorer-activity-older',
      path: `/explorer/account/${FUNDER.address}?as=nominator`,
      after: async (page) => {
        await page.addInitScript(
          ([key, value]) => window.localStorage.setItem(key, value),
          ['qmintershipplus-explorer-activity-first-read', '100']
        );
        await page.reload({ waitUntil: 'load' });
        await explorerSettle(page);
        await page.locator('#overview-activity-title').scrollIntoViewIfNeeded({ timeout: 8000 });
        const older = page.getByRole('button', { name: 'Read 100 older' });
        await older.waitFor({ timeout: 8000 });
        await older.evaluate((el) => el.scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(400);
      },
    },
    // A viewer who doesn't see the Explorer's detailed parts (Simon, 2026-10-18): no
    // Connections, Compare, direct links, chart or QORT facts.
    {
      key: 'explorer-account-basic',
      path: `/explorer/account/${ADDR.admin}?as=learner`,
      after: explorerSettle,
    },
    // How Explorer Works, as one who sees everything reads it, and as anyone else does.
    {
      key: 'explorer-how-full',
      path: '/explorer?as=nominator',
      overlay: true,
      after: async (page) => {
        await explorerSettle(page);
        await page.getByRole('button', { name: 'How Explorer Works' }).click({ timeout: 8000 });
        await page.getByRole('dialog', { name: 'How Explorer Works' }).waitFor({ timeout: 8000 });
        await page.waitForTimeout(400);
      },
    },
    {
      key: 'explorer-how-basic',
      path: '/explorer?as=learner',
      overlay: true,
      after: async (page) => {
        await explorerSettle(page);
        await page.getByRole('button', { name: 'How Explorer Works' }).click({ timeout: 8000 });
        await page.getByRole('dialog', { name: 'How Explorer Works' }).waitFor({ timeout: 8000 });
        await page.waitForTimeout(400);
      },
    },
    // Its avatar, bigger: the top bar's avatar pressed (the card's opens the same).
    {
      key: 'explorer-avatar',
      path: `/explorer/account/${ADDR.admin}?as=learner`,
      overlay: true,
      after: async (page) => {
        await explorerSettle(page);
        await page
          .getByRole('button', { name: /’s avatar bigger$/ })
          .first()
          .click({ timeout: 8000 });
        await page.getByRole('dialog').waitFor({ timeout: 8000 });
        await page.waitForTimeout(400);
      },
    },
    // As a list (the circle is the default: these screens pick the list).
    {
      key: 'explorer-connections',
      path: `/explorer/account/${ADDR.kicked}/connections?as=admin`,
      after: asList,
    },
    // Q-Asset trades (Simon, 2026-10-21): Ben Target bought 6 GEMCOIN from Pia Promote.
    {
      key: 'explorer-connections-trades',
      path: `/explorer/account/${ADDR.banTarget}/connections?as=admin`,
      after: async (page) => {
        await asList(page);
        await page.getByRole('list', { name: 'Asset trades' }).waitFor({ timeout: 8000 });
      },
    },
    // The Account report (Simon, 2026-10-21): its whole history read, then made, ready to save.
    {
      key: 'explorer-connections-report',
      path: `/explorer/account/${ADDR.banTarget}/connections?as=admin`,
      after: async (page) => {
        await asList(page);
        await page.getByRole('button', { name: 'Account report' }).click();
        const dialog = page.getByRole('dialog');
        const readAll = dialog.getByRole('button', { name: 'Read it all' });
        if (await readAll.isVisible().catch(() => false)) await readAll.click();
        await dialog.getByText(/whole on-chain history is read/).waitFor({ timeout: 8000 });
        await dialog.getByRole('button', { name: 'Make the report' }).click();
        await dialog.getByRole('button', { name: 'Save .md' }).waitFor({ timeout: 15000 });
        await page.waitForTimeout(400);
      },
    },
    // The Assets tab (Simon, 2026-10-21): Ben Target's five Q-Assets as cards, worth most first,
    // GEMCOIN's and 🐉's avatars from their owners, the rest as coins; then the list.
    {
      key: 'explorer-assets',
      path: `/explorer/account/${ADDR.banTarget}/assets?as=learner`,
      after: async (page) => {
        await explorerSettle(page);
        await page.getByRole('list', { name: 'Its Q-Assets' }).waitFor({ timeout: 8000 });
        await page.getByText('≈ 282.75 QORT').waitFor({ timeout: 8000 });
      },
    },
    {
      key: 'explorer-assets-list',
      path: `/explorer/account/${ADDR.banTarget}/assets?as=learner`,
      after: async (page) => {
        await page.addInitScript(() => window.localStorage.setItem('qmintershipplus-assets-view', 'list'));
        await page.reload({ waitUntil: 'load' });
        await explorerSettle(page);
        await page.getByRole('list', { name: 'Its Q-Assets' }).waitFor({ timeout: 8000 });
        await page.getByText('≈ 282.75 QORT').waitFor({ timeout: 8000 });
      },
    },
    // An asset opened: its holders (Ben is #2 of 3) and who bought from whom.
    {
      key: 'explorer-assets-open',
      path: `/explorer/account/${ADDR.banTarget}/assets?asset=77&as=learner`,
      after: async (page) => {
        await explorerSettle(page);
        const dialog = page.getByRole('dialog');
        await dialog.getByText('This account: #2 of 3 holders.').waitFor({ timeout: 8000 });
        await dialog.getByRole('list', { name: 'Latest trades with QORT' }).waitFor({ timeout: 8000 });
        await page.waitForTimeout(400);
      },
    },
    // What buyers would pay now, asset by asset (Simon, 2026-10-21: "realistic sale amount with
    // its own window").
    {
      key: 'explorer-assets-sale',
      path: `/explorer/account/${ADDR.banTarget}/assets?as=learner`,
      after: async (page) => {
        await explorerSettle(page);
        await page.getByRole('button', { name: 'How it adds up' }).click({ timeout: 8000 });
        await page.getByRole('dialog', { name: 'What buyers would pay now' }).waitFor({ timeout: 8000 });
        await page.waitForTimeout(400);
      },
    },
    // An asset's popup opened from the Overview's Q-Assets (Simon, 2026-10-21: "its own popup").
    {
      key: 'explorer-account-asset-open',
      path: `/explorer/account/${ADDR.admin}?asset=77&as=learner`,
      after: async (page) => {
        await explorerSettle(page);
        const dialog = page.getByRole('dialog');
        await dialog.getByText('This account: #3 of 3 holders.').waitFor({ timeout: 8000 });
        await page.waitForTimeout(400);
      },
    },
    // None held: Lou Left.
    {
      key: 'explorer-assets-empty',
      path: `/explorer/account/${ADDR.left}/assets?as=learner`,
      after: async (page) => {
        await explorerSettle(page);
        await page.getByText('Holds no Q-Assets.').waitFor({ timeout: 8000 });
      },
    },
    // A connection opened (Simon, 2026-10-20): its one transaction, straight to its details.
    {
      key: 'explorer-connections-open',
      path: `/explorer/account/${ADDR.kicked}/connections?as=admin`,
      after: async (page) => {
        await asList(page);
        await page.getByRole('button', { name: /^Show the 1 transaction with / }).first().click();
        await page.getByRole('link', { name: 'Open transaction' }).first().waitFor({ timeout: 8000 });
        // The pointer off the page, so no hover tooltip (a row's Compare) stays open in the capture.
        await page.mouse.move(0, 0);
        await page.waitForTimeout(400);
      },
    },
    // Searched (Simon, 2026-10-17): a slip finds Lou Left as similar.
    {
      key: 'explorer-connections-search',
      path: `/explorer/account/${ADDR.kicked}/connections?q=lou%20lfet&as=admin`,
      after: asList,
    },
    // The same connections as a circle (List / Circle, kept on this device).
    {
      key: 'explorer-connections-circle',
      path: `/explorer/account/${ADDR.left}/connections?as=admin`,
      after: async (page) => {
        await page.addInitScript(
          ([key, value]) => window.localStorage.setItem(key, value),
          ['qmintershipplus-connections-view', 'circle']
        );
        await page.reload({ waitUntil: 'load' });
        await explorerSettle(page);
        await page
          .getByRole('list', { name: 'Received from, the most transactions first' })
          // In the page (its avatars sit absolutely, so the list itself has no size).
          .waitFor({ state: 'attached', timeout: 8000 });
      },
    },
    // A busy payer's circle: a full side, the rest counted (Hal Helper paid 640 accounts).
    {
      key: 'explorer-connections-circle-busy',
      path: `/explorer/account/${FUNDER.address}/connections?as=admin`,
      after: async (page) => {
        await page.addInitScript(
          ([key, value]) => window.localStorage.setItem(key, value),
          ['qmintershipplus-connections-view', 'circle']
        );
        await page.reload({ waitUntil: 'load' });
        await explorerSettle(page);
        await page
          .getByRole('list', { name: 'Sent to, the most transactions first' })
          .waitFor({ state: 'attached', timeout: 8000 });
      },
    },
    // Its list under the circle (Simon, 2026-10-19): the circle's 10, a line, then the rest.
    {
      key: 'explorer-connections-circle-list',
      path: `/explorer/account/${FUNDER.address}/connections?as=admin`,
      after: async (page) => {
        await page.addInitScript(
          ([key, value]) => window.localStorage.setItem(key, value),
          ['qmintershipplus-connections-view', 'circle']
        );
        await page.reload({ waitUntil: 'load' });
        await explorerSettle(page);
        await page.getByRole('button', { name: /: see the list$/ }).click();
        await page
          .getByRole('list', { name: 'Sent to: not in the circle' })
          .waitFor({ state: 'visible', timeout: 8000 });
      },
    },
    // Ordered by QORT (Simon, 2026-10-18): the toggle between Received from and Sent to.
    {
      key: 'explorer-connections-circle-qort',
      path: `/explorer/account/${ADDR.left}/connections?as=admin`,
      after: async (page) => {
        await page.addInitScript(
          (pairs) => pairs.forEach(([key, value]) => window.localStorage.setItem(key, value)),
          [
            ['qmintershipplus-connections-view', 'circle'],
            ['qmintershipplus-connections-circle-order', 'qort'],
          ]
        );
        await page.reload({ waitUntil: 'load' });
        await explorerSettle(page);
        await page
          .getByRole('list', { name: 'Received from, the most QORT first' })
          .waitFor({ state: 'attached', timeout: 8000 });
      },
    },
    // The Explorer Quiz: a question open at the bottom, its hint shown; then answered.
    { key: 'explorer-quiz', path: '/explorer?as=admin', after: withQuiz('asking') },
    {
      key: 'explorer-quiz-answered',
      path: `/explorer/account/${ADDR.learner}/connections?as=admin`,
      after: withQuiz('right'),
    },
    // Its history: three questions asked before, newest first.
    {
      key: 'explorer-quiz-history',
      path: '/explorer?as=admin',
      after: async (page) => {
        await withQuiz('right')(page);
        await page
          .getByRole('region', { name: 'Explorer Quiz' })
          .getByRole('button', { name: 'Quiz history' })
          .click();
        await page.getByRole('dialog', { name: 'Your quiz history' }).waitFor({ timeout: 8000 });
        await page.waitForTimeout(400);
      },
    },
    // A multiple choice, one go, missed: the right option green, the pick red.
    {
      key: 'explorer-quiz-choice',
      path: '/explorer/transactions?as=admin',
      after: withQuiz('choice'),
    },
    {
      key: 'explorer-transactions',
      path: `/explorer/account/${ADDR.admin}/transactions?as=admin`,
      after: explorerSettle,
    },
    // An asset order's row says how it was filled (Simon, 2026-10-21).
    {
      key: 'explorer-transactions-trades',
      path: `/explorer/account/${ADDR.banTarget}/transactions?kind=trading&as=admin`,
      after: async (page) => {
        await explorerSettle(page);
        await page.getByText(/^Filled:/).first().waitFor({ timeout: 8000 });
      },
    },
    {
      key: 'explorer-transactions-search',
      path: `/explorer/account/${ADDR.kicked}/transactions?q=lou&as=admin`,
      after: explorerSettle,
    },
    {
      // Filtered: a kind, between two dates, oldest first (the date fields open).
      key: 'explorer-transactions-filtered',
      path: `/explorer/account/${ADDR.admin}/transactions?as=admin&kind=payments&when=dates&from=2023-01-01&to=2026-12-31&order=oldest`,
      after: explorerSettle,
    },
    {
      key: 'explorer-names-list',
      path: `/explorer/account/${ADDR.admin}/names?as=learner`,
      after: async (page) => {
        await explorerSettle(page);
        await page.getByRole('button', { name: 'List' }).click({ timeout: 8000 });
        await page.waitForTimeout(300);
      },
    },
    {
      // A row opened, with its raw API response open under it.
      key: 'explorer-transactions-raw',
      path: `/explorer/account/${ADDR.admin}/transactions?as=admin`,
      after: async (page) => {
        await explorerSettle(page);
        await page.locator('[data-tx-row]').first().click({ timeout: 8000 });
        await page.getByRole('button', { name: 'Raw API response' }).first().click();
        const raw = page.getByRole('region', { name: 'Raw API response' }).first();
        await raw.waitFor({ timeout: 4000 });
        await raw.evaluate((r) => r.scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(400);
      },
    },
    {
      // Compare with…: the names suggested show under the field, the dialog not scrolled.
      key: 'explorer-compare-with',
      path: `/explorer/account/${ADDR.admin}?as=admin`,
      overlay: true,
      after: async (page) => {
        await explorerSettle(page);
        await page.getByRole('button', { name: /with another account$/ }).click({ timeout: 8000 });
        await page
          .getByRole('dialog', { name: 'Compare with…' })
          .getByRole('combobox', { name: 'Find an account' })
          .fill('A', { timeout: 4000 });
        await page.keyboard.type('v');
        await page.getByRole('option').first().waitFor({ timeout: 8000 });
        await page.waitForTimeout(500);
      },
    },
    {
      key: 'explorer-mintership',
      path: `/explorer/account/${ADDR.nominatedSigning}/mintership?as=admin`,
      after: explorerSettle,
    },
    {
      key: 'explorer-names',
      path: `/explorer/account/${ADDR.admin}/names?as=learner`,
      after: explorerSettle,
    },
    {
      key: 'explorer-sponsees',
      path: `/explorer/sponsees/${SPONSOR.address}?as=admin`,
      after: explorerSettle,
    },
    {
      key: 'explorer-funded',
      path: `/explorer/funded/${FUNDER.address}?as=admin`,
      after: explorerSettle,
    },
    {
      key: 'explorer-compare',
      path: `/explorer/compare/${ADDR.kicked}/${ADDR.left}?as=admin`,
      after: explorerSettle,
    },
    {
      key: 'explorer-tx',
      path: `/explorer/tx/${world.explorer.sigs.privs}?as=learner`,
      after: explorerSettle,
    },
    {
      key: 'explorer-tx-raw',
      path: `/explorer/tx/${world.explorer.sigs.privs}?as=learner`,
      after: async (page) => {
        await explorerSettle(page);
        await page.getByRole('button', { name: 'Raw API response' }).click({ timeout: 8000 });
        const raw = page.getByRole('region', { name: 'Raw API response' });
        await raw.waitFor({ timeout: 4000 });
        await raw.evaluate((r) => r.scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(400);
      },
    },
    // Open File (Simon, 2026-10-17): a JSON file laid out, and a website's files.
    {
      key: 'explorer-file',
      path: `/explorer/tx/${world.explorer.sigs.publishes[2]}?as=learner`,
      after: async (page) => {
        await explorerSettle(page);
        await page.getByRole('button', { name: 'Open File' }).click({ timeout: 8000 });
        await page.getByText('The file’s JSON').waitFor({ timeout: 8000 });
        await page.waitForTimeout(400);
      },
    },
    {
      key: 'explorer-file-list',
      path: `/explorer/tx/${world.explorer.sigs.publishes[1]}?as=learner`,
      after: async (page) => {
        await explorerSettle(page);
        await page.getByRole('button', { name: 'Open File' }).click({ timeout: 8000 });
        await page.getByRole('list', { name: 'Files in this resource' }).waitFor({ timeout: 8000 });
        await page.waitForTimeout(400);
      },
    },
    { key: 'explorer-txs', path: '/explorer/transactions?as=learner', after: explorerSettle },
    {
      key: 'explorer-unused',
      path: `/explorer/account/${UNUSED_ADDRESS}?as=learner`,
      after: explorerSettle,
      // Core answers 404 for an address it has never seen; the page says so.
      expectErrors: /status of 404/,
    },
    {
      key: 'explorer-at',
      path: `/explorer/account/${AT_ADDRESS}?as=learner`,
      after: explorerSettle,
    },
  ],
};

// ---- doubles: a world of their own, for the two screens above ----------------
import { addDoubles } from './world.mjs';

/** The default world plus addDoubles(), made once, on first use. */
function doublesWorld() {
  if (!doublesWorld.made) {
    const made = createWorld();
    addOtherPending(made);
    doublesWorld.made = { world: made, doubles: addDoubles(made) };
  }
  return doublesWorld.made;
}

/**
 * Answer the page from the doubles world from now on (a route added later
 * comes first), then load it again: at `pick(doubles)`'s decision page, or
 * where it is. The first load is a screen of the default world, so nothing
 * fails while the route isn't there yet.
 */
function withDoubles(pick, then) {
  return async (page) => {
    const { world: doubles, doubles: made } = doublesWorld();
    await settle(page);
    await page.route(
      /\/(arbitrary|names|addresses|transactions|blocks|groups)\//,
      async (route) => {
        const url = new URL(route.request().url());
        const answer =
          answerNameSearch(doubles, url.pathname, url.searchParams) ??
          answerCore(doubles, url.pathname, url.searchParams);
        if (!answer) return route.fallback();
        page.__fetches?.push(url.pathname + url.search);
        if (answer.text !== undefined)
          return route.fulfill({
            status: answer.status,
            contentType: 'text/plain',
            body: answer.text,
          });
        return json(route, answer.status, answer.body);
      }
    );
    if (pick) {
      const url = new URL(page.url());
      url.pathname = `/decisions/${pick(made)}`;
      await page.goto(url.toString(), { waitUntil: 'load' });
    } else await page.reload({ waitUntil: 'load' });
    await then(page);
  };
}

// ---- declines: a world of their own, for the screen above --------------------
import { addDecline } from './world.mjs';

/** The default world plus addReady() and addDecline(), made once, on first use. */
function declineWorld() {
  if (!declineWorld.made) {
    const made = createWorld();
    addOtherPending(made);
    addReady(made);
    addDecline(made);
    declineWorld.made = made;
  }
  return declineWorld.made;
}

/** Answer the page from the declines world from now on, then load it again (as withDoubles). */
function withDecline(then) {
  return async (page) => {
    const declines = declineWorld();
    await settle(page);
    await page.route(
      /\/(arbitrary|names|addresses|transactions|blocks|groups)\//,
      async (route) => {
        const url = new URL(route.request().url());
        const answer =
          answerNameSearch(declines, url.pathname, url.searchParams) ??
          answerCore(declines, url.pathname, url.searchParams);
        if (!answer) return route.fallback();
        page.__fetches?.push(url.pathname + url.search);
        if (answer.text !== undefined)
          return route.fulfill({
            status: answer.status,
            contentType: 'text/plain',
            body: answer.text,
          });
        return json(route, answer.status, answer.body);
      }
    );
    await page.reload({ waitUntil: 'load' });
    await then(page);
  };
}

// ---- Minter Admin polls: the two screens above -----------------------------------
import { ADMIN_POLL_IDS, addAdminNotes, addAdminPolls, answerAdminPolls } from './world.mjs';

// Polls in the default world, and the notes and comments for the Minter Admins; only the
// screens that use withPolls serve them (DOCUMENT_PRIVATE).
addAdminPolls(world);
addAdminNotes(world);

/**
 * DECRYPT_DATA in the page, as the persona's Hub would (the mock world's
 * stand-in encryption, e2e/world.mjs mockDecrypt): wraps the answers the
 * check installs, before or after this script runs.
 */
function decryptScript() {
  const keys = Object.fromEntries(
    Object.entries(ADDR).map(([persona, address]) => [
      persona,
      world.accounts.get(address)?.publicKey ?? '',
    ])
  );
  return `(() => {
    const KEYS = ${JSON.stringify(keys)};
    const persona = (location.search.match(/[?&]as=([A-Za-z0-9]+)/) || [])[1] || 'admin';
    const mine = KEYS[persona] || KEYS.admin;
    const PREFIX = 'qortalGroupEncryptedData';
    const decrypt = (data) => {
      let sealed = null;
      try {
        const text = atob(String(data));
        if (text.startsWith(PREFIX)) sealed = JSON.parse(text.slice(PREFIX.length));
      } catch {
        sealed = null;
      }
      if (!sealed || !Array.isArray(sealed.k) || !sealed.k.includes(mine))
        throw { error: 'Unable to decrypt', message: 'Unable to decrypt' };
      return sealed.d;
    };
    const wrap = (answer) => async (p) =>
      p && p.action === 'DECRYPT_DATA' ? decrypt(p.encryptedData) : answer(p);
    let current = window.__qplusAnswer;
    if (typeof current === 'function') {
      window.__qplusAnswer = wrap(current);
      return;
    }
    Object.defineProperty(window, '__qplusAnswer', {
      configurable: true,
      get: () => current,
      set: (v) => {
        current = typeof v === 'function' ? wrap(v) : v;
      },
    });
  })();`;
}

/** Answer DECRYPT_DATA as the persona's Hub would, load the page again, then `then`. */
function withDecrypt(then) {
  return async (page) => {
    await settle(page);
    await page.addInitScript(decryptScript());
    await page.reload({ waitUntil: 'load' });
    await then(page);
  };
}

/**
 * Serve the polls' DOCUMENT_PRIVATE reads and answer DECRYPT_DATA from now
 * on (a route added later comes first), then load the page again, or go to
 * `pathname` (the app's own page there, not a Core call). The first load is
 * the screen without polls, so nothing fails before the route is in.
 */
function withPolls(then, pathname) {
  return async (page) => {
    await settle(page);
    if (pathname) {
      // The page and its files (assets, icon: relative, so under the same path), not Core calls.
      const dir = pathname.slice(0, pathname.lastIndexOf('/') + 1);
      await page.route(
        (url) =>
          url.pathname === pathname ||
          (url.pathname.startsWith(dir) && /\.[a-z0-9]+$/i.test(url.pathname)),
        (route) => {
          const url = new URL(route.request().url());
          if (url.pathname === pathname) return route.continue();
          return route.continue({
            url: `${url.origin}/${url.pathname.slice(dir.length)}${url.search}`,
          });
        }
      );
    }
    await page.route(
      /\/(arbitrary\/resources\/searchsimple|arbitrary\/DOCUMENT_PRIVATE\/|addresses\/publickey\/)/,
      async (route) => {
        const url = new URL(route.request().url());
        const answer = answerAdminPolls(world, url.pathname, url.searchParams);
        if (!answer) return route.fallback();
        page.__fetches?.push(url.pathname + url.search);
        if (answer.text !== undefined)
          return route.fulfill({
            status: answer.status,
            contentType: 'text/plain',
            body: answer.text,
          });
        return json(route, answer.status, answer.body);
      }
    );
    await page.addInitScript(decryptScript());
    if (pathname) {
      const url = new URL(page.url());
      url.pathname = pathname;
      await page.goto(url.toString(), { waitUntil: 'load' });
    } else await page.reload({ waitUntil: 'load' });
    await then(page);
  };
}
