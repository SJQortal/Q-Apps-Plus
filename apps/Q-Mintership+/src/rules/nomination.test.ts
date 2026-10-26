import { describe, expect, it } from 'vitest';
import { nominationAnswered } from './nomination';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** MINTER's waiting window: 10,080 blocks at a minute each, for round numbers. */
const WINDOW = 10_080 * 60_000;
const INVITED = 100 * DAY;

const entry = (who: string, publishedAt: number) => ({ who, publishedAt });

describe('nominationAnswered: the nomination a MINTER invite answered', () => {
  // Simon, 2026-10-26: iffi vaba mees nominated Shadow Archives; kitty's invite was the
  // first approval, and the decided invite said "Proposed by kitty".
  it('is the nomination published in the waiting window before the invite', () => {
    const iffi = entry('iffi vaba mees', INVITED - 5 * HOUR);
    expect(nominationAnswered([iffi], INVITED, WINDOW)).toBe(iffi);
  });

  it('takes the first when several nominated within the window (the rest supported it)', () => {
    const first = entry('first', INVITED - 3 * DAY);
    const second = entry('second', INVITED - DAY);
    expect(nominationAnswered([second, first], INVITED, WINDOW)).toBe(first);
  });

  it('allows a record whose clock runs a few minutes ahead of the chain', () => {
    const ahead = entry('ahead', INVITED + 5 * 60_000);
    expect(nominationAnswered([ahead], INVITED, WINDOW)).toBe(ahead);
  });

  it('is none for a record published after the invite, or before its window', () => {
    expect(nominationAnswered([entry('later', INVITED + HOUR)], INVITED, WINDOW)).toBeNull();
    expect(
      nominationAnswered([entry('older', INVITED - WINDOW - HOUR)], INVITED, WINDOW)
    ).toBeNull();
    expect(nominationAnswered([], INVITED, WINDOW)).toBeNull();
  });
});
