/**
 * The Explorer Quiz's questions on the mock world: a member's level, where
 * it was first seen, its primary name, a name sale found in a stretch of
 * blocks; how makeQuestion picks a level, skips what was asked and gives
 * up. Read-only: every read is a GET.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { ADDR, PEOPLE, TIP } from '../../../../e2e/world.mjs';
import { fetchCalls, mockFetchRoute } from '../../../test/setup';
import { installWorld } from '../../../test/world';
import { getAccount } from '../../accounts';
import { makeQuestion, QUIZ_TEMPLATES, recheckAnswer, type QuizTemplate } from './generators';

const template = (id: string) => QUIZ_TEMPLATES.find((t) => t.id === id) as QuizTemplate;
/** The same "random" number every time. */
const fixed = (value: number) => () => value;

beforeEach(() => {
  installWorld('admin');
});

const words = (
  parts: Array<{
    kind: string;
    text?: string;
    name?: string | null;
    address?: string;
    height?: number;
  }>
) =>
  parts
    .map((p) =>
      p.kind === 'text' ? p.text : p.kind === 'block' ? `block ${p.height}` : (p.name ?? p.address)
    )
    .join('');

describe('the Explorer Quiz’s questions', () => {
  it('asks a member’s level, with the answer the Explorer shows', async () => {
    const q = await makeQuestion({
      templates: [template('level')],
      level: 'easy',
      rng: fixed(0.01),
    });
    expect(q).not.toBeNull();
    expect(q?.level).toBe('easy');
    expect(q?.tip).toBe(TIP);
    const account = q?.parts.find((p) => p.kind === 'account');
    const address = account && 'address' in account ? account.address : '';
    const person = Object.entries(ADDR).find(([, a]) => a === address)?.[0] as keyof typeof PEOPLE;
    expect(q?.answer).toEqual({ kind: 'number', value: String(PEOPLE[person].level) });
    expect(words(q?.parts ?? [])).toMatch(/^What minting level is .+ at\?$/);
    expect(q?.link).toBe(`/explorer/account/${address}`);
  });

  it('asks where an account was first seen, and its primary name by its address', async () => {
    const seen = await makeQuestion({
      templates: [template('firstSeenBlock')],
      level: 'easy',
      rng: fixed(0.3),
    });
    expect(seen?.answer.kind).toBe('number');
    expect(words(seen?.parts ?? [])).toMatch(/first seen on the chain\?$/);
    const named = await makeQuestion({
      templates: [template('primaryName')],
      level: 'easy',
      rng: fixed(0.3),
    });
    const asked = named?.parts.find((p) => p.kind === 'account');
    expect(asked && 'name' in asked ? asked.name : 'x').toBeNull();
    expect(named?.answer.kind).toBe('text');
  });

  it('asks what a name sold for, from a stretch of blocks', async () => {
    const buyer = ADDR.learner;
    const seller = ADDR.left;
    mockFetchRoute('/transactions/search', (url: URL) =>
      url.searchParams.get('txType') === 'BUY_NAME'
        ? [
            {
              type: 'BUY_NAME',
              signature: 'sale-1',
              timestamp: 1,
              txGroupId: 0,
              blockHeight: 2_000_123,
              creatorAddress: buyer,
              seller,
              name: 'Maple',
              amount: '27.50000000',
            },
          ]
        : []
    );
    const q = await makeQuestion({
      templates: [template('namePrice')],
      level: 'medium',
      rng: fixed(0.1),
    });
    expect(words(q?.parts ?? [])).toBe(
      'In block 2000123, Leo Learner bought the name Maple. How much QORT did it pay?'
    );
    expect(q?.answer).toEqual({ kind: 'number', value: '27.50000000', unit: 'QORT' });
    expect(q?.link).toBe('/explorer/transactions?type=BUY_NAME&blocks=from-2000123&span=1');
    const searches = fetchCalls.filter((c) => c.startsWith('/transactions/search'));
    for (const call of searches) {
      const p = new URL(call, 'http://x').searchParams;
      expect(p.get('limit')).toBe('20');
      expect(p.get('confirmationStatus')).toBe('CONFIRMED');
      expect(Number(p.get('blockLimit'))).toBeGreaterThan(0);
    }
  });

  it('asks who registered a name only when it changed hands, not when it was registered again', async () => {
    const registration = (name: string, by: string, timestamp: number) => ({
      type: 'REGISTER_NAME',
      signature: `reg-${name}`,
      timestamp,
      txGroupId: 0,
      blockHeight: 1_180_913,
      creatorAddress: by,
      name,
    });
    mockFetchRoute('/transactions/search', (url: URL) =>
      url.searchParams.get('txType') === 'REGISTER_NAME'
        ? [
            // Renamed away by Leo, then registered anew by Ada: not a sale.
            registration('Cat Sign', ADDR.learner, 1_677_103_411_881),
            // Registered by Leo, sold to Ada since.
            registration('Maple', ADDR.learner, 1_677_200_000_000),
          ]
        : []
    );
    mockFetchRoute('/names/', (url: URL) => {
      const name = decodeURIComponent(url.pathname.slice('/names/'.length));
      return name === 'Cat Sign'
        ? { name, owner: ADDR.admin, registered: 1_687_130_078_055 }
        : { name, owner: ADDR.admin, registered: 1_677_200_000_000 };
    });
    const q = await makeQuestion({
      templates: [template('registeredBy')],
      level: 'expert',
      rng: fixed(0.2),
    });
    expect(words(q?.parts ?? [])).toContain('Maple');
    expect(q?.answer).toMatchObject({ kind: 'account', address: ADDR.learner });
  });

  it('picks the level asked for, skips what was asked, and gives up when nothing fits', async () => {
    const made: string[] = [];
    const fake = (id: string, level: QuizTemplate['level'], ok = true): QuizTemplate => ({
      id,
      level,
      theme: 'blocks',
      make: async () => {
        made.push(id);
        return ok
          ? {
              key: id,
              parts: [{ kind: 'text', text: id }],
              answer: { kind: 'number', value: '1' },
              placeholder: '',
              hint: '',
              how: '',
              link: '/explorer',
              linkLabel: '',
            }
          : null;
      },
    });
    const templates = [fake('e', 'easy'), fake('t', 'tricky'), fake('broken', 'medium', false)];
    const tricky = await makeQuestion({ templates, level: 'tricky' });
    expect(tricky?.template).toBe('t');
    // Its theme's heading, unless it brought its own.
    expect(tricky?.kicker).toBe('Block party');
    expect((await makeQuestion({ templates, level: 'easy' }))?.level).toBe('easy');
    made.length = 0;
    expect(await makeQuestion({ templates, level: 'medium', attempts: 3 })).toBeNull();
    expect(made).toEqual(['broken', 'broken', 'broken']);
    const throwing: QuizTemplate = {
      id: 'x',
      level: 'easy',
      theme: 'blocks',
      make: async () => {
        throw new Error('node busy');
      },
    };
    expect(await makeQuestion({ templates: [throwing], attempts: 2 })).toBeNull();
  });

  it('asks head to head with options, one of them right', async () => {
    const q = await makeQuestion({
      templates: [template('higherLower')],
      level: 'easy',
      rng: fixed(0.2),
    });
    expect(q?.kicker).toBe('Higher or lower');
    expect(q?.answer.kind).toBe('choice');
    if (q?.answer.kind !== 'choice') return;
    expect(q.answer.options.map((o) => o.label)).toEqual(['Higher', 'Lower', 'The same']);
    const [la, lb] = await Promise.all(
      (q.subjects ?? []).map(async (address) => (await getAccount(address)).level)
    );
    expect(q.answer.correct).toBe(lb > la ? 0 : lb < la ? 1 : 2);
  });

  it('asks chain history from the very first of a kind, with the stretch it is in', async () => {
    mockFetchRoute('/transactions/search', (url: URL) =>
      url.searchParams.get('txType') === 'CREATE_POLL' && !url.searchParams.has('startBlock')
        ? [
            {
              type: 'CREATE_POLL',
              signature: 'poll-1',
              timestamp: 1_660_718_476_318,
              txGroupId: 0,
              blockHeight: 955_267,
              creatorAddress: ADDR.learner,
              pollName: 'Puppy Ears Vote',
              pollOptions: [{ optionName: 'Yes, very' }, { optionName: 'Quite so' }],
            },
          ]
        : []
    );
    mockFetchRoute('/polls/', {
      pollName: 'Puppy Ears Vote',
      description: 'Are puppy ears soft?',
      owner: ADDR.learner,
      published: 1,
      pollOptions: [{ optionName: 'Yes, very' }, { optionName: 'Quite so' }],
    });
    const asked = new Set<string>();
    // The poll's two questions are the only ones not asked yet.
    for (const t of ['REGISTER_NAME', 'PAYMENT', 'CREATE_GROUP', 'ARBITRARY', 'VOTE_ON_POLL'])
      for (const part of ['name', 'who', 'amount', 'to', 'poll']) asked.add(`first:${t}:${part}`);
    for (const key of [
      'first:BUY_NAME:name',
      'first:SELL_NAME:name',
      'first:UPDATE_NAME:name',
      'first:TRANSFER_PRIVS:who',
      'first:DEPLOY_AT:name',
      'first:GROUP_KICK:group',
      'first:GROUP_BAN:group',
      'first:CREATE_POLL:options',
    ])
      asked.add(key);
    const q = await makeQuestion({
      templates: [template('firstEver')],
      level: 'medium',
      seen: (key) => asked.has(key),
    });
    expect(q?.key).toBe('first:CREATE_POLL:name');
    expect(words(q?.parts ?? [])).toBe(
      'The very first poll on Qortal came in the 10,000 blocks from block 950,000. What was the poll called?'
    );
    expect(q?.answer).toEqual({
      kind: 'text',
      accepted: ['Puppy Ears Vote'],
      shown: 'Puppy Ears Vote',
    });
    expect(q?.fact).toMatch(
      /It asked: “Are puppy ears soft\?” Its options: “Yes, very”, “Quite so”\./
    );
    expect(q?.link).toBe('/explorer/transactions?type=CREATE_POLL&blocks=from-950000&order=oldest');
    // Every first asked: nothing left to ask.
    asked.add('first:CREATE_POLL:name');
    expect(
      await makeQuestion({
        templates: [template('firstEver')],
        level: 'medium',
        seen: (key) => asked.has(key),
        attempts: 2,
      })
    ).toBeNull();
  });

  it('reads a live answer again: a level asked about long ago', async () => {
    const q = await makeQuestion({
      templates: [template('level')],
      level: 'easy',
      rng: fixed(0.01),
    });
    expect(q?.live).toBe(true);
    const stale = { ...q!, answer: { kind: 'number', value: '99' } as const };
    expect(await recheckAnswer(stale)).toEqual(q?.answer);
    expect(await recheckAnswer({ ...stale, live: false })).toBeNull();
  });

  it('says where everyone can look, and Connections only to a viewer who sees it', async () => {
    // Leo Learner alone: Sid Sponsor shared with him from block 1,371,641 to 1,378,875.
    const leo = (subject: string) => subject === ADDR.learner || !subject.startsWith('Q');
    const cases: Array<[string, Partial<Parameters<typeof makeQuestion>[0]>, RegExp]> = [
      [
        'sponsor',
        { fresh: leo, rng: fixed(0.3) },
        /\/transactions\?kind=minting&type=REWARD_SHARE&order=oldest$/,
      ],
      [
        'shareRun',
        { fresh: leo, rng: fixed(0.3) },
        /\/transactions\?kind=minting&type=REWARD_SHARE&order=oldest$/,
      ],
      ['levelMoveFrom', { rng: fixed(0.6) }, /\/transactions\?kind=minting&type=TRANSFER_PRIVS$/],
      ['firstQortFrom', { rng: fixed(0.01) }, /\/transactions\?kind=payments&order=oldest$/],
      ['nameSeller', { rng: fixed(0.1) }, /\/transactions\?kind=names&type=BUY_NAME$/],
      ['namePrice', { rng: fixed(0.1) }, /^\/explorer\/transactions\?type=BUY_NAME/],
    ];
    const answers: Record<string, unknown> = {};
    for (const [id, options, basicLink] of cases) {
      // Name sales: the only rows these two read, once the others are made.
      if (id === 'nameSeller')
        mockFetchRoute('/transactions/search', (url: URL) =>
          url.searchParams.get('txType') === 'BUY_NAME'
            ? [
                {
                  type: 'BUY_NAME',
                  signature: 'sale-2',
                  timestamp: 1,
                  txGroupId: 0,
                  blockHeight: 2_000_123,
                  creatorAddress: ADDR.learner,
                  seller: ADDR.left,
                  name: 'Maple',
                  amount: '27.50000000',
                },
              ]
            : []
        );
      const t = template(id);
      const make = (full: boolean) =>
        makeQuestion({ templates: [t], level: t.level, full, attempts: 1, ...options });
      const basic = await make(false);
      const detailed = await make(true);
      if (!basic || !detailed) throw new Error(`${id}: no question`);
      // The same question and answer; only where to look differs.
      expect([id, basic.parts]).toEqual([id, detailed.parts]);
      expect([id, basic.answer]).toEqual([id, detailed.answer]);
      answers[id] = basic.answer;
      expect([id, basic.link]).toEqual([id, expect.stringMatching(basicLink)]);
      expect([id, basic.full]).toEqual([id, undefined]);
      const said = [basic.hint, basic.hint2, basic.how, basic.fact, basic.linkLabel].join(' ');
      expect([id, said]).toEqual([id, expect.not.stringMatching(/Connections|In common/i)]);
      expect([id, detailed.full]).toEqual([id, true]);
      expect([id, detailed.how]).toEqual([id, expect.stringMatching(/Connections/)]);
    }
    expect(answers.sponsor).toMatchObject({ kind: 'account', name: 'Sid Sponsor' });
    expect(answers.shareRun).toEqual({ kind: 'number', value: String(1_378_875 - 1_371_641) });
    expect(answers.nameSeller).toMatchObject({ kind: 'account', address: ADDR.left });
  });

  it('asks a sum of payments of a viewer without Connections only when it is short', async () => {
    expect(template('payTotal').full).toBeUndefined();
    // Only Connections adds up who an account paid most, and counts a sponsor's sponsees.
    expect(
      QUIZ_TEMPLATES.filter((t) => t.full)
        .map((t) => t.id)
        .sort()
    ).toEqual(['sponseesCount', 'topPayee']);
  });

  it('asks nothing that sends a viewer without Connections there', async () => {
    const DETAILED =
      /Connections|In common|Compare|QORT minted|purchased|received \/ sent|activity chart/i;
    let made = 0;
    for (const t of QUIZ_TEMPLATES)
      for (const r of [0.05, 0.35, 0.65, 0.95]) {
        const q = await makeQuestion({
          templates: [t],
          level: t.level,
          rng: fixed(r),
          full: false,
          attempts: 1,
        });
        if (!q) continue;
        made += 1;
        expect(t.full).toBeUndefined();
        const said = [q.hint, q.hint2, q.how, q.fact, q.link, q.linkLabel].join(' ');
        expect([t.id, said]).toEqual([t.id, expect.not.stringMatching(DETAILED)]);
        expect(q.full).toBeUndefined();
      }
    expect(made).toBeGreaterThan(20);
  }, 30_000);

  it('skips accounts asked about lately', async () => {
    const lately = new Set<string>(Object.values(ADDR));
    const q = await makeQuestion({
      templates: [template('level')],
      level: 'easy',
      fresh: (subject) => !lately.has(subject),
      rng: fixed(0.5),
    });
    // Every member was in a question lately: it still asks, but about one of them.
    expect(q).not.toBeNull();
  });
});
