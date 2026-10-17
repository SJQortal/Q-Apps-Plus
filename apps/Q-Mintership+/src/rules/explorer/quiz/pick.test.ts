import { describe, expect, it } from 'vitest';
import {
  levelWeights,
  pickLevel,
  pickTemplate,
  pickWeighted,
  remember,
  type PickHistory,
  type TemplateInfo,
} from './pick';

const fresh: PickHistory = { templates: [], streak: 0, lastOutcome: null, asked: 10 };

/** A fixed sequence of "random" numbers. */
const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('picking the next question’s level', () => {
  it('starts gently: never expert in the first two questions', () => {
    const w = levelWeights({ ...fresh, asked: 0 });
    expect(w.expert).toBe(0);
    expect(w.easy + w.medium + w.tricky).toBeCloseTo(1);
  });

  it('leans harder with a streak, and easier after an answer was shown', () => {
    const base = levelWeights(fresh);
    const hot = levelWeights({ ...fresh, streak: 5 });
    const cold = levelWeights({ ...fresh, lastOutcome: 'shown' });
    expect(hot.expert).toBeGreaterThan(base.expert);
    expect(hot.easy).toBeLessThan(base.easy);
    expect(cold.easy).toBeGreaterThan(base.easy);
    expect(cold.expert).toBeLessThan(base.expert);
    for (const w of [base, hot, cold])
      expect(w.easy + w.medium + w.tricky + w.expert).toBeCloseTo(1);
  });

  it('picks by weight', () => {
    expect(pickLevel(() => 0, levelWeights(fresh))).toBe('easy');
    expect(pickLevel(() => 0.999, levelWeights(fresh))).toBe('expert');
    expect(
      pickWeighted(
        () => 0.5,
        ['a', 'b'],
        (x) => (x === 'b' ? 1 : 0)
      )
    ).toBe('b');
    expect(
      pickWeighted(
        () => 0.5,
        ['a'],
        () => 0
      )
    ).toBeNull();
  });
});

describe('picking the kind of question', () => {
  const t = (
    id: string,
    theme: TemplateInfo['theme'],
    level: TemplateInfo['level'] = 'medium'
  ) => ({
    id,
    theme,
    level,
  });
  const templates = [
    t('a', 'money'),
    t('b', 'money'),
    t('c', 'names'),
    t('d', 'groups'),
    t('e', 'blocks'),
    t('x', 'history', 'easy'),
  ];

  it('never one of the last three kinds asked', () => {
    for (let i = 0; i < 50; i += 1) {
      const picked = pickTemplate(Math.random, templates, 'medium', ['c', 'd', 'e']);
      expect(['a', 'b']).toContain(picked?.id);
    }
  });

  it('favours another theme than the last one, and kinds asked less lately', () => {
    const counts = new Map<string, number>();
    let s = 1;
    const rng = () => {
      s = (s * 16807) % 2147483647;
      return s / 2147483647;
    };
    for (let i = 0; i < 4000; i += 1) {
      const id = pickTemplate(rng, templates, 'medium', ['a', 'a', 'x', 'x', 'x', 'b'])?.id ?? '';
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    // b was just asked (excluded); a is money like b, and asked twice lately.
    expect(counts.get('b')).toBeUndefined();
    expect(counts.get('a') ?? 0).toBeLessThan((counts.get('c') ?? 0) / 3);
  });

  it('tries a kind that just failed much less', () => {
    const tried = new Map([['c', 1]]);
    const picked = [0.01, 0.3, 0.6, 0.9].map(
      (r) => pickTemplate(seq(r), templates.slice(2, 4), 'medium', [], tried)?.id
    );
    expect(picked.filter((id) => id === 'c').length).toBeLessThan(2);
    expect(pickTemplate(() => 0.5, templates, 'expert', [])).toBeNull();
  });

  it('remembers the newest, without repeats', () => {
    expect(remember(['a', 'b', 'c'], ['b', 'd'], 3)).toEqual(['c', 'b', 'd']);
  });
});
