/**
 * The Explorer's part of the mock world (e2e/world-explorer.mjs), read
 * through the Explorer's own loaders the way the pages will read it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AT_ADDRESS,
  FUNDER,
  MESSAGE_CONTENT,
  OLD_MINTER,
  SPONSEES,
  SPONSOR,
  UNUSED_ADDRESS,
  answerCore,
  createWorld,
  fakeAddress,
  type ExplorerWorld,
  type World,
} from '../../e2e/world.mjs';
import {
  exploreAccount,
  getFirstSeen,
  getGroupsOf,
  getLastSigned,
  getNameData,
  getNamesOf,
  getOnline,
  getPayerBand,
  getPrivsRecipient,
  getTx,
  onlineSharesOf,
} from '../data/explorer/account';
import { getMembership } from '../data/group';
import { HISTORY_TYPES } from '../data/txs';
import { peekQuery } from '../data/query';
import { describeTx } from '../rules/explorer/txWords';
import type { TxRow } from '../data/types';
import { ADDR, TIP, installWorld } from './world';

afterEach(() => vi.useRealTimers());

const explorerOf = (world: World) => world.explorer as ExplorerWorld;

async function get<T = unknown>(path: string): Promise<{ status: number; body: T }> {
  const res = await fetch(path);
  const raw = await res.text();
  let body: unknown = raw;
  try {
    body = JSON.parse(raw);
  } catch {
    // a text answer (raw bytes, a number)
  }
  return { status: res.status, body: body as T };
}

describe('Explorer world: names', () => {
  it('gives the admin three names and the nominator two, the primary still first in Core', async () => {
    installWorld();
    expect((await getNamesOf(ADDR.admin)).names).toEqual(['Avery Admin', 'Avery Two', 'AA Maps']);
    // Nora bought "Spare Room", registered before her own name.
    expect((await getNamesOf(ADDR.nominator)).names).toEqual(['Spare Room', 'Nora Nominator']);
    expect((await getNamesOf(ADDR.learner)).names).toEqual(['Leo Learner']);
    expect((await getNamesOf(ADDR.newcomer)).names).toEqual([]);
    const primary = await get<{ name: string }>(`/names/primary/${ADDR.admin}`);
    expect(primary.body.name).toBe('Avery Admin');
  });

  it("answers a name's full record, matching any case like Core's reduced names", async () => {
    installWorld();
    const maps = await getNameData('AA Maps');
    expect(maps).toMatchObject({
      name: 'AA Maps',
      owner: ADDR.admin,
      reducedName: 'aa maps',
      isForSale: false,
    });
    expect(maps?.registered).toBeLessThan(maps?.updated ?? 0);
    expect(await getNameData('aa maps')).toMatchObject({ name: 'AA Maps' });
    expect(await getNameData('Nobody At All')).toBeNull();
    expect(peekQuery('nameowner:AA Maps')).toBe(ADDR.admin);
  });

  it('finds secondary names in the name search', async () => {
    installWorld();
    const { body } = await get<Array<{ name: string; owner: string }>>(
      '/names/search?query=av&prefix=true&limit=10'
    );
    expect(body).toEqual([
      { name: 'Avery Admin', owner: ADDR.admin },
      { name: 'Avery Two', owner: ADDR.admin },
    ]);
  });
});

describe('Explorer world: accounts, groups and minting', () => {
  it('tells a never-used address apart', async () => {
    installWorld();
    await expect(exploreAccount(UNUSED_ADDRESS)).resolves.toEqual({
      kind: 'unused',
      address: UNUSED_ADDRESS,
    });
    await expect(exploreAccount(SPONSOR.address)).resolves.toMatchObject({ kind: 'account' });
  });

  it('lists other groups without changing MINTER membership', async () => {
    installWorld();
    const groups = await getGroupsOf(ADDR.admin);
    expect(groups.map((g) => [g.groupName, g.isAdmin ?? false])).toEqual([
      ['MINTER', true],
      ['Qortal General', false],
      ['Q-Mintership Helpers', true],
    ]);
    expect(groups[1]).toMatchObject({ memberCount: 5_200, isOpen: true });
    expect(peekQuery(`membership:${ADDR.admin}`)).toEqual({ isMember: true, isAdmin: true });
    const kit = await getGroupsOf(ADDR.kicked);
    expect(kit.map((g) => g.groupName)).toEqual([
      'Some other group',
      'Qortal General',
      'Book Club',
    ]);
    expect(await getMembership(ADDR.kicked, { force: true })).toEqual({
      isMember: false,
      isAdmin: false,
    });
    expect(await getMembership(ADDR.nominator)).toEqual({ isMember: true, isAdmin: false });
    expect((await get(`/groups/1203`)).body).toMatchObject({
      groupName: 'Book Club',
      memberCount: 12,
      isOpen: false,
    });
  });

  it('says who is minting now and when they last signed', async () => {
    installWorld();
    const online = await getOnline();
    expect(onlineSharesOf(online, ADDR.admin)).toEqual([
      expect.objectContaining({ minterAddress: ADDR.admin, recipientAddress: ADDR.admin }),
    ]);
    expect(onlineSharesOf(online, ADDR.nominator)).toHaveLength(1);
    expect(onlineSharesOf(online, SPONSOR.address)[0].recipientAddress).toBe(SPONSEES[3].address);
    expect(onlineSharesOf(online, ADDR.kicked)).toEqual([]);
    expect((await getLastSigned(ADDR.admin))?.height).toBe(TIP - 3);
    expect(await getLastSigned(ADDR.newcomer)).toBeNull();
  });

  it("reports the sponsor's sponsees the way Core does", async () => {
    installWorld();
    const report = await get<Record<string, unknown>>(`/addresses/sponsorship/${SPONSOR.address}`);
    expect(report.body).toMatchObject({
      address: SPONSOR.address,
      sponseeCount: 5,
      nonRegisteredCount: 1,
      names: ['Sam Sprout', 'Tia Twig', 'Ugo Underway', 'Leo Learner'],
    });
    const viaSponsee = await get(`/addresses/sponsorship/${SPONSEES[0].address}/sponsor`);
    expect(viaSponsee.body).toMatchObject({ address: SPONSOR.address });
    expect((await get(`/addresses/sponsorship/${ADDR.admin}/sponsor`)).status).toBe(404);
  });
});

describe('Explorer world: where the first QORT came from', () => {
  it('Kit and Lou both got theirs from Hal, five blocks apart', async () => {
    installWorld();
    const kit = await getFirstSeen(ADDR.kicked);
    expect(kit.funding).toMatchObject({
      kind: 'payment',
      from: FUNDER.address,
      amount: '5.43210000',
      height: 1_364_165,
    });
    expect(kit.firstOwn).toMatchObject({ type: 'PAYMENT', height: 1_364_500 });
    expect(kit.firstSeen?.height).toBe(1_364_165);
    const lou = await getFirstSeen(ADDR.left);
    expect(lou.funding).toMatchObject({ from: FUNDER.address, height: 1_364_170 });
  });

  it('reads accounts that never sent anything from their reference', async () => {
    installWorld();
    const [sam, tia, unnamed, ugo] = SPONSEES;
    expect((await getFirstSeen(tia.address)).funding).toMatchObject({
      kind: 'payment',
      from: FUNDER.address,
    });
    expect((await getFirstSeen(unnamed.address)).funding?.from).toBe(FUNDER.address);
    expect((await getFirstSeen(sam.address)).funding).toMatchObject({
      kind: 'payment',
      from: SPONSOR.address,
    });
    expect((await getFirstSeen(ugo.address)).funding).toMatchObject({
      kind: 'rewardShare',
      from: SPONSOR.address,
      sharePercent: '0.00',
    });
    expect((await get<{ publicKey?: string }>(`/addresses/${tia.address}`)).body.publicKey).toBe(
      undefined
    );
  });

  it('makes Hal a busy payer (500+) and Kit a quiet one', async () => {
    installWorld();
    await expect(getPayerBand(FUNDER.address)).resolves.toBe(500);
    await expect(getPayerBand(ADDR.kicked)).resolves.toBe(0);
  });
});

describe('Explorer world: transactions', () => {
  it('moves a minting level, with the recipient only in the raw bytes', async () => {
    const { world } = installWorld();
    const { privs } = explorerOf(world).sigs;
    const row = await getTx(privs);
    expect(row).toMatchObject({ type: 'TRANSFER_PRIVS', creatorAddress: OLD_MINTER.address });
    expect(row).not.toHaveProperty('recipient');
    await expect(getPrivsRecipient(privs)).resolves.toBe(ADDR.kickTarget);
    const found = await get<TxRow[]>(
      `/transactions/search?address=${ADDR.kickTarget}&txType=TRANSFER_PRIVS&limit=100`
    );
    expect(found.body.map((t) => t.signature)).toEqual([privs]);
  });

  it('finds an account by every part it played', async () => {
    const { world } = installWorld();
    const x = explorerOf(world);
    const { body } = await get<TxRow[]>(
      `/transactions/search?address=${ADDR.kicked}&limit=100&reverse=true`
    );
    const types = new Set(body.map((t) => t.type));
    for (const type of ['PAYMENT', 'REWARD_SHARE', 'MESSAGE', 'AT', 'GROUP_KICK', 'GROUP_INVITE'])
      expect(types, type).toContain(type);
    expect(body.map((t) => t.blockHeight)).toEqual(
      [...body.map((t) => t.blockHeight)].sort((a, b) => (b ?? 0) - (a ?? 0))
    );
    const payments = await get<TxRow[]>(
      `/transactions/search?address=${ADDR.kicked}&txType=PAYMENT&limit=100`
    );
    expect(payments.body).toHaveLength(x.sigs.kitLou.length + 1); // and Hal's first payment
    const pair = await get<TxRow[]>(
      `/transactions/payments/between?senderAddress=${ADDR.kicked}&recipientAddress=${ADDR.left}&limit=100`
    );
    expect(pair.body.map((t) => t.amount)).toEqual([
      '10.00000000',
      '20.00000000',
      '30.00000000',
      '60.00000000',
    ]);
    const first = await get<TxRow[]>(
      `/transactions/creator/${world.accounts.get(ADDR.kicked).publicKey}?confirmationStatus=CONFIRMED&limit=1`
    );
    expect(first.body[0].signature).toBe(x.sigs.kitLou[0]);
  });

  it('answers the AT, its deployment and the trade between Lou and Kit', async () => {
    const { world } = installWorld();
    const x = explorerOf(world);
    const atRows = await get<TxRow[]>(`/transactions/search?address=${AT_ADDRESS}&limit=100`);
    expect(atRows.body.map((t) => t.signature)).toEqual([x.sigs.deploy, x.sigs.payout]);
    const trades = await get<Array<{ buyerReceivingAddress: string; atAddress: string }>>(
      `/crosschain/trades?sellerPublicKey=${world.accounts.get(ADDR.left).publicKey}&limit=100`
    );
    expect(trades.body).toEqual([
      expect.objectContaining({ atAddress: AT_ADDRESS, buyerReceivingAddress: ADDR.kicked }),
    ]);
    const none = await get<unknown[]>(
      `/crosschain/trades?sellerPublicKey=${world.accounts.get(ADDR.admin).publicKey}&limit=100`
    );
    expect(none.body).toEqual([]);
  });

  it('sells a name from Leo to Nora', async () => {
    const { world } = installWorld();
    const x = explorerOf(world);
    const { body } = await get<TxRow[]>(
      `/transactions/search?address=${ADDR.learner}&txType=SELL_NAME&txType=BUY_NAME&limit=100`
    );
    expect(body.map((t) => t.signature)).toEqual([x.sigs.sell, x.sigs.buy]);
    expect(describeTx(body[1], { viewpoint: ADDR.learner }).plain).toMatch(
      /^Sold the name “Spare Room” to .+ for 5 QORT$/
    );
  });

  it('words every Explorer row without its message content or encrypted identifiers', () => {
    const world = createWorld();
    for (const row of explorerOf(world).rows) {
      for (const viewpoint of [row.creatorAddress as string, undefined]) {
        const json = JSON.stringify(describeTx(row as unknown as TxRow, { viewpoint }));
        expect(json).not.toContain(MESSAGE_CONTENT);
        expect(json).not.toContain('qortal_qmail_explorer_test');
      }
    }
  });
});

describe('Explorer world: QDN', () => {
  it('answers other services and searches by name alone', async () => {
    installWorld();
    const app = await get<Array<{ service: string; name: string }>>(
      `/arbitrary/resources/searchsimple?service=APP&name=${encodeURIComponent('AA Maps')}&limit=100`
    );
    expect(app.body).toEqual([expect.objectContaining({ service: 'APP', name: 'AA Maps' })]);
    const byName = await get<Array<{ service: string; identifier: string }>>(
      `/arbitrary/resources/searchsimple?name=${encodeURIComponent('Avery Two')}&limit=100&reverse=true`
    );
    expect(byName.body.map((r) => r.service)).toEqual(['MAIL_PRIVATE']);
    const nora = await get<Array<{ service: string; identifier: string }>>(
      `/arbitrary/resources/searchsimple?name=${encodeURIComponent('Nora Nominator')}&limit=100`
    );
    // Her Q-Mintership+ records and her cards in the original app, oldest first.
    expect(new Set(nora.body.map((r) => r.service))).toEqual(new Set(['JSON', 'BLOG_POST']));
    expect(nora.body.map((r) => r.identifier)).toContain(`qmp-nomination-${ADDR.nominatedWaiting}`);
  });
});

describe('Explorer world leaves the other answers alone', () => {
  /** The same world without the Explorer's answers: what world.mjs alone says. */
  function both(path: string) {
    const world = createWorld();
    const url = new URL(path, 'http://node');
    const withExplorer = answerCore(world, url.pathname, url.searchParams);
    delete world.explorer;
    const without = answerCore(world, url.pathname, url.searchParams);
    return { withExplorer: JSON.stringify(withExplorer), without: JSON.stringify(without) };
  }

  it('answers group-type searches byte for byte as before', () => {
    const history = HISTORY_TYPES.map((t) => `txType=${t}`).join('&');
    for (const key of ['admin', 'kicked', 'left', 'learner', 'nominator', 'kickTarget']) {
      const { withExplorer, without } = both(
        `/transactions/search?address=${ADDR[key]}&${history}&confirmationStatus=CONFIRMED&limit=100&offset=0&reverse=true`
      );
      expect(withExplorer, key).toBe(without);
    }
    for (const path of [
      `/transactions/search?txType=GROUP_APPROVAL&confirmationStatus=CONFIRMED&startBlock=${TIP - 20_000}&blockLimit=20000&limit=100`,
      `/transactions/search?txType=GROUP_INVITE&txType=GROUP_KICK&txGroupId=694&limit=100`,
      `/arbitrary/resources/searchsimple?service=JSON&identifier=qmp-nomination-&prefix=true&limit=100`,
      `/groups/member/${ADDR.learner}`,
      `/groups/member/${ADDR.banned}`,
      `/names/primary/${ADDR.nominator}`,
    ]) {
      const { withExplorer, without } = both(path);
      expect(withExplorer, path).toBe(without);
    }
  });

  it('builds its addresses the way world.mjs does', () => {
    expect(SPONSOR.address).toBe(fakeAddress('explorer-sponsor'));
    expect(FUNDER.address).toBe(fakeAddress('explorer-funder'));
    expect(UNUSED_ADDRESS).toBe(fakeAddress('explorer-unused'));
    expect(SPONSEES[4].address).toBe(ADDR.learner);
  });

  it('never answers a search without a limit ceiling', () => {
    const world = createWorld();
    expect(() =>
      answerCore(
        world,
        '/transactions/payments/between',
        new URLSearchParams(`senderAddress=${FUNDER.address}&limit=0`)
      )
    ).toThrow(/limit=0/);
  });
});
