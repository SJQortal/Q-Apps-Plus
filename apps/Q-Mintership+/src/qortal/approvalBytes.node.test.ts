/**
 * Optional check against a real node: the app's GROUP_APPROVAL bytes go to
 * Core's `POST /transactions/decode?ignoreValidityChecks=true`, which only
 * parses them and answers with the transaction as JSON. It never stores,
 * signs or broadcasts anything.
 *
 *   QMP_DECODE_NODE=http://127.0.0.1:12391 npm run test:decode
 *
 * Skipped in the normal test run (no node there). The pending signature and
 * the account are read from the node with GETs at run time. Both a signature
 * (approval 1) and a rejection (approval 0) are decoded.
 */
import { describe, expect, it } from 'vitest';
import fixture from '../test/fixtures/group-approvals.json';
import { groupApprovalUnsignedBase58, groupRejectionUnsignedBase58 } from './approvalBytes';

type Env = { QMP_DECODE_NODE?: string };
const NODE = (
  (globalThis as { process?: { env?: Env } }).process?.env?.QMP_DECODE_NODE ?? ''
).replace(/\/$/, '');

/** A plain HTTP call through Node, so the test setup's fetch mock is not involved. */
async function http(
  method: 'GET' | 'POST',
  path: string,
  body?: string
): Promise<{ status: number; text: string }> {
  const mod = (await import(/* @vite-ignore */ `node:${'http'}`)) as {
    request: (url: string, opts: object, cb: (res: NodeResponse) => void) => NodeRequest;
  };
  return new Promise((resolve, reject) => {
    const req = mod.request(
      `${NODE}${path}`,
      { method, headers: { 'Content-Type': 'text/plain', Accept: 'application/json' } },
      (res) => {
        let text = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => (text += chunk));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, text }));
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}
interface NodeResponse {
  statusCode?: number;
  setEncoding(enc: string): void;
  on(event: 'data' | 'end', cb: (chunk: string) => void): void;
}
interface NodeRequest {
  on(event: 'error', cb: (error: unknown) => void): void;
  write(body: string): void;
  end(): void;
}

describe.skipIf(!NODE)('GROUP_APPROVAL bytes decoded by a real node (read-only)', () => {
  it('decodes the bytes back to the same fields', async () => {
    // Any pending signature works for decoding; use a fixture's and its signer.
    const sample = fixture.approvals[0];
    const account = JSON.parse((await http('GET', `/addresses/${sample.creatorAddress}`)).text) as {
      reference: string;
      publicKey: string;
    };
    const timestamp = 1_791_000_000_000;
    const unsigned = groupApprovalUnsignedBase58({
      timestamp,
      reference: account.reference,
      adminPublicKey: account.publicKey,
      pendingSignature: sample.pendingSignature,
      approval: true,
      feeAtomic: 1_000_000,
    });
    const res = await http('POST', '/transactions/decode?ignoreValidityChecks=true', unsigned);
    expect(res.status).toBe(200);
    const decoded = JSON.parse(res.text) as Record<string, unknown>;
    expect(decoded).toMatchObject({
      type: 'GROUP_APPROVAL',
      timestamp,
      reference: account.reference,
      fee: '0.01000000',
      txGroupId: 0,
      adminPublicKey: account.publicKey,
      pendingSignature: sample.pendingSignature,
      approval: true,
      creatorAddress: sample.creatorAddress,
    });
  });

  it('decodes a rejection (approval 0) back to the same fields', async () => {
    const sample = fixture.approvals[1];
    const account = JSON.parse((await http('GET', `/addresses/${sample.creatorAddress}`)).text) as {
      reference: string;
      publicKey: string;
    };
    const timestamp = 1_791_000_000_000;
    const unsigned = groupRejectionUnsignedBase58({
      timestamp,
      reference: account.reference,
      adminPublicKey: account.publicKey,
      pendingSignature: sample.pendingSignature,
      approval: false,
      feeAtomic: 1_000_000,
    });
    const res = await http('POST', '/transactions/decode?ignoreValidityChecks=true', unsigned);
    expect(res.status).toBe(200);
    const decoded = JSON.parse(res.text) as Record<string, unknown>;
    expect(decoded).toMatchObject({
      type: 'GROUP_APPROVAL',
      timestamp,
      reference: account.reference,
      fee: '0.01000000',
      txGroupId: 0,
      adminPublicKey: account.publicKey,
      pendingSignature: sample.pendingSignature,
      approval: false,
      creatorAddress: sample.creatorAddress,
    });
  });
});
