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
  addConsidering,
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
} from './world.mjs';
import { addTargetShift } from './world.mjs';

const world = createWorld();
// Admins' Decisions also shows the transactions that aren't MINTER group changes.
addOtherPending(world);
// Rae Ready has shown they're ready to mint (a join request, no nomination).
addReady(world);
// Rejections (one a withdrawn signature, one on its way, a ban lift with enough of them, a
// rejected invite in History) and Minter Admins considering (with notes) on the cards.
addRejections(world);
addConsidering(world);
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
    // Reject, Withdraw my signature and Considering: each explained, with its fee, before Hub.
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
      after: open(
        'Withdraw my signature (counts as a rejection): Add to MINTER, Uma Urgent',
        'Withdraw your signature'
      ),
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
          .getByRole('heading', { name: 'The target changed from 10 to 9 signatures' })
          .waitFor({ timeout: 8000 });
      },
    },
    // Signing that admin change: the impact, and the box to tick before Hub opens.
    {
      key: 'decisions-admin-impact',
      path: '/decisions?world=shift&as=admin',
      overlay: true,
      after: async (page) => {
        await settle(page);
        await page
          .getByRole('button', { name: /^Sign: Remove a Minter Admin, Dex Demote/ })
          .click({ timeout: 4000 });
        const dialog = page.getByRole('dialog', { name: 'Sign this decision' });
        await dialog.waitFor({ timeout: 8000 });
        await dialog.getByRole('button', { name: 'Continue to Hub' }).click({ timeout: 4000 });
        await dialog.getByText('Tick “I’ve checked these” to go on.').waitFor({ timeout: 4000 });
        await page.waitForTimeout(300);
      },
    },
    // Shareable links: one decision waiting (Sign), one decided, and one nomination with its rounds.
    {
      key: 'decision-pending',
      path: `/decisions/${PENDING_SIG}?as=admin`,
      after: wait('main article'),
    },
    {
      key: 'decision-decided',
      path: `/decisions/${DECIDED_SIG}?as=learner`,
      after: wait('main [aria-label^="Signed by"]'),
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
    // An admin's Home when the target moved since Decisions last showed it (9 then, 8 now).
    {
      key: 'home-target-changed',
      path: '/?as=admin',
      after: async (page) => {
        await page.addInitScript(
          ([key, value]) => window.localStorage.setItem(key, value),
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
  ],
};
