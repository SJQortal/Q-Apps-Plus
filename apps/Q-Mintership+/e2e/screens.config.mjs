/**
 * Q-Mintership+ for the shared screenshot check (scripts/screens.mjs):
 *
 *   QPLUS_CHROMIUM=~/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome \
 *     scripts/screens.mjs Q-Mintership+ [--only home-admin,decisions] [--themes hub30] [--mode light]
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

const world = createWorld();
// Admins' Decisions also shows the transactions that aren't MINTER group changes.
addOtherPending(world);
// Rae Ready has shown they're ready to mint (a join request, no nomination).
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
// Two former members have asked to join again: Ready to mint marks them.
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
  await page
    .getByRole('region', { name: 'Explorer Quiz' })
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

/** Propose (a menu, or a sheet on phones), then one of its choices. */
const propose = (choice) => async (page) => {
  await settle(page);
  await page.getByRole('button', { name: 'Propose', exact: true }).click({ timeout: 4000 });
  const choices = page.locator('[role="menu"], .MuiDrawer-paper');
  await choices.getByText(choice, { exact: true }).click({ timeout: 4000 });
  await page.getByRole('dialog', { name: choice }).waitFor({ timeout: 8000 });
};

/**
 * Home with an earlier visit on this device (e2e/world.mjs → lastVisitSnapshots):
 * the snapshot is put in place before the app loads again, so "Since your
 * last visit" compares with it.
 */
const visits = lastVisitSnapshots(world);
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
  ],

  qortal,

  async route(route, url) {
    if (url.pathname.includes('/THUMBNAIL/')) {
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
    // A newcomer who has shown they're ready to mint, and the dialog that does it.
    { key: 'home-ready', path: '/?as=ready', after: settle },
    {
      key: 'home-ready-dialog',
      path: '/?as=newcomerName',
      overlay: true,
      after: open("Show you're ready to mint", "Show you're ready to mint"),
    },
    { key: 'nominations', path: '/nominations?as=nominator', after: settle },
    // Who is ready to mint: join requests without a nomination.
    { key: 'nominations-ready', path: '/nominations?show=ready&as=nominator', after: settle },
    { key: 'nominations-ready-admin', path: '/nominations?show=ready&as=admin', after: settle },
    // Ready to mint searched by a name, resolved to its owner on the node.
    {
      key: 'nominations-ready-search',
      path: '/nominations?show=ready&as=nominator',
      after: async (page) => {
        await settle(page);
        await page
          .getByRole('searchbox', { name: 'Search the people ready to mint by name or address' })
          .fill('fern', { timeout: 4000 });
        await page
          .getByRole('link', { name: `${FORMER_READY.removed.name}: open their page` })
          .waitFor({ timeout: 8000 });
        await page.waitForTimeout(400);
      },
    },
    // The nominee's own card comes first, with Accept nomination.
    { key: 'nominations-nominee', path: '/nominations?as=nominatedWaiting', after: settle },
    // Someone who isn't a Minter Admin: No and Yes on the cards, their own vote on Wren's.
    {
      key: 'nominations-community',
      path: '/nominations?as=learner',
      after: async (page) => {
        await settle(page);
        await page
          .getByRole('group', { name: 'Your vote on bob+builder' })
          .waitFor({ timeout: 8000 });
      },
    },
    {
      key: 'nominations-community-voters',
      path: '/nominations?as=learner',
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
      path: '/nominations?as=learner',
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
    { key: 'decisions-member', path: '/decisions?as=learner', after: settle },
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
    {
      key: 'decisions-cancel-invite',
      path: '/decisions?as=admin',
      overlay: true,
      after: async (page) => {
        await propose('Cancel an approved invite')(page);
        const form = page.getByRole('dialog', { name: 'Cancel an approved invite' });
        await form
          .getByRole('combobox', { name: 'Approved invite' })
          .selectOption(fakeAddress('stale-2'), { timeout: 8000 });
        await form.getByText('Nothing stops this proposal.').waitFor({ timeout: 8000 });
        await form.getByRole('button', { name: 'Review' }).click({ timeout: 4000 });
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
    // Propose cancelling all: two Hub steps for each stale invite (the intro).
    {
      key: 'decisions-cancel-all',
      path: '/decisions?as=admin',
      overlay: true,
      after: async (page) => {
        await settle(page);
        await page.getByRole('button', { name: 'Show them', exact: true }).click({ timeout: 4000 });
        await page
          .getByRole('button', { name: /^Propose cancelling all \d+ older ones$/ })
          .click({ timeout: 8000 });
        await page.getByRole('dialog', { name: 'Cancel stale invites' }).waitFor({ timeout: 8000 });
        await page.waitForTimeout(400);
      },
    },
    { key: 'person', path: `/people/${ADDR.nominatedSigning}?as=admin`, after: settle },
    { key: 'history', path: '/history?as=learner', after: settle },
    // On chain, one type searched by type over 120 days: Bans, with the ban from 61 days ago.
    { key: 'history-filter', path: '/history?as=learner&type=ban&period=120', after: settle },
    // All types over a period: the last 120 days, read as four 30-day windows.
    { key: 'history-period', path: '/history?as=learner&period=120', after: settle },
    // An old card from the original app (e2e/world-legacy.mjs), with its poll and comments.
    {
      key: 'legacy-card',
      path: '/history/card/Minter-board-card-bQ7xK2?as=learner',
      after: wait('#legacy-poll-title'),
    },
    // An encrypted admin-board card: listed, never decrypted; links to the original app.
    {
      key: 'legacy-admin-card',
      path: '/history/card/card-MAC-NC-1780000000000-a1B2c3?as=admin',
      after: wait('main h2'),
    },
    { key: 'activity', path: '/activity?as=admin', after: settle },
    // A Minter Admin who last had History open at TIP − 6,000: three changes decided since
    // count on the rail's History, and on Activity's History button where the phone bar has none.
    {
      key: 'activity-history-news',
      path: '/activity?as=admin',
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
          .getByRole('link', { name: 'History', exact: false })
          .first()
          .waitFor({ timeout: 8000 });
        await page.waitForTimeout(1500);
      },
    },
    { key: 'activity-member', path: '/activity?as=learner', after: settle },
    { key: 'settings', path: '/settings?as=admin', after: settle },
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
      path: `/people/${ADDR.nominatedWaiting}?as=nominator`,
      after: comments(WREN_COMMENTS, 'Wren helped me set up my node'),
    },
    // A Minter Admin's view of the hidden comment, unfolded with Show anyway.
    {
      key: 'comments-hidden',
      path: `/people/${ADDR.nominatedWaiting}?as=admin`,
      after: async (page) => {
        await comments(WREN_COMMENTS, 'Wren helped me set up my node')(page);
        await page.getByRole('button', { name: 'Show anyway: hidden comment' }).click();
        await page.getByText('Hidden by a Minter Admin. You chose to show it.').waitFor();
      },
    },
    // Posting: what is published, under which name, and the fee, before Hub opens.
    {
      key: 'comments-post',
      path: `/people/${ADDR.nominatedWaiting}?as=nominator`,
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
    // Step down as Minter Admin lives on the admin's own page.
    {
      key: 'person-own-admin',
      path: `/people/${ADDR.adminL4}?as=adminL4`,
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
      path: `/people/${ADDR.learner}?as=learner`,
      after: async (page) => {
        await settle(page);
        await page.getByText(/is suggested for Minter Admins/).waitFor({ timeout: 8000 });
      },
    },
    // Picking yourself under Remove a Minter Admin points to your own page.
    {
      key: 'decisions-remove-self',
      path: '/decisions?as=admin',
      overlay: true,
      after: async (page) => {
        await propose('Remove a Minter Admin')(page);
        await page
          .getByRole('dialog', { name: 'Remove a Minter Admin' })
          .getByRole('combobox', { name: 'Minter Admin' })
          .selectOption(ADDR.admin, { timeout: 8000 });
        await page.getByRole('link', { name: 'Open your page' }).waitFor({ timeout: 8000 });
        await page.waitForTimeout(300);
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
    // Declines (e2e/world.mjs addDecline): Ready to mint as a Minter Admin, with Decline on
    // the rows without a nomination and one row whose decline is waiting.
    {
      key: 'nominations-ready-decline',
      path: '/nominations?show=ready&as=admin',
      after: withDecline(async (page) => {
        await settle(page);
        const waiting = page.getByRole('link', { name: /^A decline is waiting for Minter Admins/ });
        await waiting.waitFor({ timeout: 8000 });
        await page
          .getByRole('button', { name: /^Propose to decline / })
          .first()
          .waitFor({
            timeout: 8000,
          });
        await waiting.evaluate((link) => link.closest('li')?.scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(300);
      }),
    },
    // Minter Admin polls (e2e/world.mjs addAdminPolls), encrypted to the Minter Admins: the
    // section on Decisions (one poll read from a share, one closed), and one poll's own page
    // with its comments open.
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
    {
      key: 'explorer-connections',
      path: `/explorer/account/${ADDR.kicked}/connections?as=admin`,
      after: explorerSettle,
    },
    // Searched (Simon, 2026-10-17): a slip finds Lou Left as similar.
    {
      key: 'explorer-connections-search',
      path: `/explorer/account/${ADDR.kicked}/connections?q=lou%20lfet&as=admin`,
      after: explorerSettle,
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
import { ADMIN_POLL_IDS, addAdminPolls, answerAdminPolls } from './world.mjs';

// Polls in the default world; only the two screens above serve them (DOCUMENT_PRIVATE).
addAdminPolls(world);

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
