/**
 * The testnet dev server's test signer (testnet/vite-plugin.mjs) answers
 * same-origin JSON on a loopback host only, so another page open in the
 * browser can't drive it. Dev-only code, checked here without a node.
 */
import { describe, expect, it } from 'vitest';
import { isGuardedPath, signerRequestRefusal } from '../../testnet/lib/request-guard.mjs';

const HOST = '127.0.0.1:5176';
const post = (headers: Record<string, string | undefined>) => ({ method: 'POST', headers });

describe('the testnet signer’s request guard', () => {
  it('guards the signer and the control paths, not the read proxy', () => {
    expect(isGuardedPath('/qmp-testnet-signer')).toBe(true);
    expect(isGuardedPath('/qmp-testnet-control/behaviour')).toBe(true);
    expect(isGuardedPath('/qmp-testnet-control/behaviour/clear')).toBe(true);
    expect(isGuardedPath('/qmp-testnet-node/blocks/height')).toBe(false);
    expect(signerRequestRefusal(post({ host: HOST }), '/qmp-testnet-node/x')).toBeNull();
  });

  it('lets the app’s own JSON requests through, and run.mjs’s without an Origin', () => {
    const json = { host: HOST, 'content-type': 'application/json' };
    expect(
      signerRequestRefusal(post({ ...json, origin: `http://${HOST}` }), '/qmp-testnet-signer')
    ).toBeNull();
    expect(signerRequestRefusal(post(json), '/qmp-testnet-control/behaviour')).toBeNull();
    expect(
      signerRequestRefusal(
        post({ host: 'localhost:5176', 'content-type': 'application/json; charset=utf-8' }),
        '/qmp-testnet-signer'
      )
    ).toBeNull();
    // Reads stay open.
    expect(
      signerRequestRefusal({ method: 'GET', headers: {} }, '/qmp-testnet-control/log')
    ).toBeNull();
  });

  it('refuses a text/plain post from another page (no preflight), and its preflight', () => {
    expect(
      signerRequestRefusal(
        post({ host: HOST, origin: 'https://example.org', 'content-type': 'text/plain' }),
        '/qmp-testnet-signer'
      )
    ).toMatch(/same-origin JSON/);
    expect(
      signerRequestRefusal(
        { method: 'OPTIONS', headers: { host: HOST, origin: 'https://example.org' } },
        '/qmp-testnet-signer'
      )
    ).not.toBeNull();
    // No body type at all: a bare control POST is refused too.
    expect(
      signerRequestRefusal(post({ host: HOST }), '/qmp-testnet-control/behaviour/clear')
    ).not.toBeNull();
  });

  it('refuses JSON from another origin, and a name that isn’t a loopback host', () => {
    expect(
      signerRequestRefusal(
        post({ host: HOST, origin: 'http://localhost:3000', 'content-type': 'application/json' }),
        '/qmp-testnet-signer'
      )
    ).toMatch(/same-origin JSON/);
    expect(
      signerRequestRefusal(
        post({
          host: 'rebound.example:5176',
          origin: 'http://rebound.example:5176',
          'content-type': 'application/json',
        }),
        '/qmp-testnet-signer'
      )
    ).toMatch(/127\.0\.0\.1 or localhost only/);
  });
});
