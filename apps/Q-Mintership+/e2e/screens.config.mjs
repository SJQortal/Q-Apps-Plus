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
import { answerCore, createWorld, ADDR, PEOPLE } from './world.mjs';

const world = createWorld();
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

export default {
  name: 'Q-Mintership+',
  themeKey: 'qmintershipplus-ui-theme',
  ignoreErrors: /favicon/,

  async setup({ browser }) {
    const gen = await browser.newPage({ viewport: { width: 64, height: 64 } });
    await gen.setContent(
      '<div style="width:64px;height:64px;background:linear-gradient(135deg,#73d0c3,#84aff0)"></div>'
    );
    PNG = await gen.screenshot({ clip: { x: 0, y: 0, width: 64, height: 64 } });
    await gen.close();
  },

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
    { key: 'nominations', path: '/nominations?as=nominator', after: settle },
    { key: 'nominate', path: '/nominate?as=nominator', after: settle },
    { key: 'decisions', path: '/decisions?as=admin', after: settle },
    { key: 'person', path: `/people/${ADDR.nominatedSigning}?as=admin`, after: settle },
    { key: 'history', path: '/history?as=learner', after: settle },
    { key: 'activity', path: '/activity?as=admin', after: settle },
    { key: 'settings', path: '/settings?as=admin', after: settle },
  ],
};
