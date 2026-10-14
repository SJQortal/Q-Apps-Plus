/**
 * Minter Admin polls in the mock world (e2e/world.mjs addAdminPolls): serve
 * their DOCUMENT_PRIVATE searches, bodies and the admins' public keys, and
 * answer DECRYPT_DATA as the signed-in persona's Hub would (bodies not
 * encrypted to them fail with "Unable to decrypt").
 *
 *   await renderPage(<DecisionsPage />, { persona: 'admin', setup: withAdminPolls('admin') });
 */
import {
  addAdminPolls,
  answerAdminPolls,
  answerCore,
  answerDecrypt,
  type World,
} from '../../e2e/world.mjs';
import { resetAdminPollMisses } from '../data/adminPolls';
import { mockFetchRoute, mockQortalRequest } from './setup';

const ROUTES =
  /^\/(arbitrary\/resources\/searchsimple|arbitrary\/DOCUMENT_PRIVATE\/|addresses\/publickey\/)/;

/** Serve the world's polls (added already) and decrypt as `persona` (unless `decrypt` is false). */
export function serveAdminPolls(
  world: World,
  persona: string,
  options: { decrypt?: boolean } = {}
): void {
  resetAdminPollMisses();
  mockFetchRoute(ROUTES, (url: URL, init?: RequestInit) => {
    if (init?.method && init.method !== 'GET')
      return new Response('POST not allowed in this app', { status: 405 });
    const answer =
      answerAdminPolls(world, url.pathname, url.searchParams) ??
      answerCore(world, url.pathname, url.searchParams);
    if (!answer) return new Response(JSON.stringify({ error: 404 }), { status: 404 });
    if (answer.text !== undefined) return new Response(answer.text, { status: answer.status });
    return new Response(JSON.stringify(answer.body), {
      status: answer.status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  if (options.decrypt !== false)
    mockQortalRequest('DECRYPT_DATA', (request: Record<string, unknown>) =>
      answerDecrypt(world, persona, request)
    );
}

/** A renderPage `setup`: the polls of addAdminPolls(), read as `persona`. */
export function withAdminPolls(persona: string, more?: (world: World) => void) {
  return (world: World) => {
    addAdminPolls(world);
    more?.(world);
    serveAdminPolls(world, persona);
  };
}
