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
import { makeQuestion, QUIZ_TEMPLATES, type QuizTemplate } from './generators';

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
    const q = await makeQuestion({ templates: [template('level')], rng: fixed(0.01) });
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
    const seen = await makeQuestion({ templates: [template('firstSeenBlock')], rng: fixed(0.3) });
    expect(seen?.answer.kind).toBe('number');
    expect(words(seen?.parts ?? [])).toMatch(/first seen on the chain\?$/);
    const named = await makeQuestion({ templates: [template('primaryName')], rng: fixed(0.3) });
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
    const q = await makeQuestion({ templates: [template('namePrice')], rng: fixed(0.5) });
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

  it('picks the level asked for, skips what was asked, and gives up when nothing fits', async () => {
    const made: string[] = [];
    const fake = (id: string, level: QuizTemplate['level'], ok = true): QuizTemplate => ({
      id,
      level,
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
    expect((await makeQuestion({ templates, level: 'tricky' }))?.template).toBe('t');
    expect((await makeQuestion({ templates, level: 'easy' }))?.level).toBe('easy');
    made.length = 0;
    expect(await makeQuestion({ templates, level: 'medium', attempts: 3 })).toBeNull();
    expect(made).toEqual(['broken', 'broken', 'broken']);
    const throwing: QuizTemplate = {
      id: 'x',
      level: 'easy',
      make: async () => {
        throw new Error('node busy');
      },
    };
    expect(await makeQuestion({ templates: [throwing], attempts: 2 })).toBeNull();
  });
});
