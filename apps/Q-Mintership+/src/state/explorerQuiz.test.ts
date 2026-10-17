import { describe, expect, it } from 'vitest';
import { EMPTY_QUIZ, parseQuiz } from './explorerQuiz';

const question = {
  v: 1,
  key: 'level:Q1',
  template: 'level',
  level: 'easy',
  tip: 1,
  parts: [{ kind: 'text', text: 'What level?' }],
  answer: { kind: 'number', value: '3' },
  placeholder: 'A number',
  hint: 'Its header.',
  how: 'Its header.',
  link: '/explorer',
  linkLabel: 'Open it',
};

describe('the quiz kept on this device', () => {
  it('reads what was kept before hints had steps, and fills what it lacks', () => {
    const state = parseQuiz(
      JSON.stringify({
        v: 1,
        on: true,
        question,
        status: 'asking',
        misses: 2,
        hinted: true,
        level: 'tricky',
        score: { asked: 4, right: 3, streak: 1, best: 2 },
        asked: ['a', 'b', 7],
      })
    );
    expect(state).toMatchObject({
      on: true,
      hints: 1,
      picked: null,
      level: 'tricky',
      asked: ['a', 'b'],
      recent: { templates: [], subjects: [] },
      lastOutcome: null,
    });
  });

  it('keeps the new fields, and reads anything odd as the default', () => {
    const state = parseQuiz(
      JSON.stringify({
        v: 1,
        question: {
          ...question,
          answer: { kind: 'choice', options: [], correct: 0 },
        },
        status: 'shown',
        picked: 2,
        hints: 9,
        level: 'expert',
        recent: { templates: ['level', 'sponsor'], subjects: ['Q1', 'b:2'] },
        lastOutcome: 'shown',
      })
    );
    expect(state).toMatchObject({
      status: 'shown',
      picked: 2,
      hints: 2,
      level: 'expert',
      recent: { templates: ['level', 'sponsor'], subjects: ['Q1', 'b:2'] },
      lastOutcome: 'shown',
    });
    expect(parseQuiz('{nope')).toEqual(EMPTY_QUIZ);
    expect(parseQuiz(JSON.stringify({ v: 2 }))).toEqual(EMPTY_QUIZ);
    expect(parseQuiz(JSON.stringify({ v: 1, level: 'impossible' })).level).toBeNull();
  });
});
