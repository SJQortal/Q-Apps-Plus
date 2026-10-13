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
  addComments,
  addOtherPending,
  addReady,
  answerCore,
  createWorld,
  fakeAddress,
  ADDR,
  NOW,
  PEOPLE,
} from './world.mjs';

const world = createWorld();
// Admins' Decisions also shows the transactions that aren't MINTER group changes.
addOtherPending(world);
// Rae Ready has shown they're ready to mint (a join request, no nomination).
addReady(world);
// Public comments on Wren Waiting's nomination and bob+builder's invite, and a hidden one.
addComments(world);
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
    const answer = answerCore(world, url.pathname, url.searchParams);
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
  ],
};
