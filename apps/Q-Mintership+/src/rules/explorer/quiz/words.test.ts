import { describe, expect, it } from 'vitest';
import { amountRemark, endSentence, ordinal, streakLine, weekdayForms } from './words';

describe('the quiz’s words', () => {
  it('ends a sentence once', () => {
    expect(endSentence('Its options: “Yes”, “No”')).toBe('Its options: “Yes”, “No”.');
    expect(endSentence('Its options: “Yes, very”, “Very much so.”')).toBe(
      'Its options: “Yes, very”, “Very much so.”'
    );
    expect(endSentence('Is it?')).toBe('Is it?');
  });

  it('counts in words, then in figures', () => {
    expect(ordinal(1)).toBe('first');
    expect(ordinal(19)).toBe('nineteenth');
    expect(ordinal(21)).toBe('21st');
    expect(ordinal(112)).toBe('112th');
  });

  it('says a streak worth saying', () => {
    expect(streakLine(2, 2)).toBeNull();
    expect(streakLine(3, 3)).toBe('Three in a row!');
    expect(streakLine(5, 5)).toBe('Five in a row. Impressive.');
    expect(streakLine(10, 10)).toBe('10 in a row. Are you a node?');
    expect(streakLine(7, 7)).toBe('New best streak!');
    expect(streakLine(7, 9)).toBeNull();
  });

  it('knows the day of the week, in full and short', () => {
    const friday = new Date(2023, 6, 28, 12).getTime();
    expect(weekdayForms(friday)).toEqual({ shown: 'Friday', accepted: ['Friday', 'Fri', 'Fr'] });
  });

  it('remarks on an amount only when there is something to say', () => {
    expect(amountRemark(0.0005)).toBe('Tiny, but every QORT counts.');
    expect(amountRemark(500)).toBe('A nice round number.');
    expect(amountRemark(12.5)).toBeNull();
  });
});
