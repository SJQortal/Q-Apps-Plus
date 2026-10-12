/**
 * Plug the mock MINTER world (e2e/world.mjs) into the test mocks: every Core
 * GET it knows is answered, any POST to Core fails the test, and every
 * qortalRequest write is declined unless a test answers it itself.
 */
import { vi } from 'vitest';
import {
  answerCore,
  answerQortal,
  createWorld,
  personaAddress,
  type World,
} from '../../e2e/world.mjs';
import { resetQueries } from '../data/query';
import { setQdnRetryDelays } from '../data/qdn';
import { mockFetchRoute, mockQortalRequest } from './setup';

export { ADDR, NOW, TIP, MS_PER_BLOCK, PEOPLE, NULL_OWNER } from '../../e2e/world.mjs';

export interface InstalledWorld {
  world: World;
  /** The address `persona` signs in as. */
  address: string;
  publicKey: string;
  /** Core paths that were POSTed (must stay empty: the app never POSTs). */
  posts: string[];
}

const WRITE_ACTIONS = [
  'INVITE_TO_GROUP',
  'CANCEL_GROUP_INVITE',
  'KICK_FROM_GROUP',
  'BAN_FROM_GROUP',
  'CANCEL_GROUP_BAN',
  'ADD_GROUP_ADMIN',
  'REMOVE_GROUP_ADMIN',
  'JOIN_GROUP',
  'SIGN_TRANSACTION',
  'PUBLISH_QDN_RESOURCE',
];

export function installWorld(
  persona = 'admin',
  options: { fakeNow?: boolean } = {}
): InstalledWorld {
  resetQueries();
  setQdnRetryDelays([1, 1]);
  if (options.fakeNow !== false) {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(1_791_830_000_000));
  }
  const world = createWorld();
  const posts: string[] = [];
  mockFetchRoute(/^\//, (url: URL, init?: RequestInit) => {
    if (init?.method && init.method !== 'GET') {
      posts.push(url.pathname);
      return new Response('POST not allowed in this app', { status: 405 });
    }
    const answer = answerCore(world, url.pathname, url.searchParams);
    if (!answer)
      return new Response(JSON.stringify({ error: 404, message: `no mock for ${url.pathname}` }), {
        status: 404,
      });
    if (answer.text !== undefined) return new Response(answer.text, { status: answer.status });
    return new Response(JSON.stringify(answer.body), {
      status: answer.status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  for (const action of ['GET_USER_ACCOUNT', 'GET_PRIMARY_NAME', ...WRITE_ACTIONS]) {
    mockQortalRequest(action, (request: Record<string, unknown>) =>
      answerQortal(world, persona, request)
    );
  }
  const address = personaAddress(persona);
  return { world, address, publicKey: world.accounts.get(address)?.publicKey ?? '', posts };
}
