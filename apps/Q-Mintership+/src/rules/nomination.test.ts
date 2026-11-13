import { describe, expect, it } from 'vitest';
import { nominationAnswered, pickRound } from './nomination';

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

describe('pickRound: the records of the current round', () => {
  const NOW = 200 * DAY;
  const round = (
    entries: ReturnType<typeof entry>[],
    ctx: { decidedEnd?: number | null; pendingAt?: number | null }
  ) =>
    pickRound(entries, {
      decidedEnd: ctx.decidedEnd ?? null,
      pendingAt: ctx.pendingAt ?? null,
      nowMs: NOW,
      windowMs: WINDOW,
    }).entries.map((e) => e.who);

  // Simon, 2026-11-13: Jonny was nominated on 15 Oct (Simon's invite, rejected) and again
  // on 9 Nov (igorcoin); Simon's new invite on 13 Nov pulled October's record, and a vote
  // from October, into November's round, as October's invite was older than the read.
  const october = entry('Simon James', NOW - 29 * DAY);
  const november = entry('igorcoin', NOW - 4 * DAY);
  const invitedToday = NOW - HOUR;

  it('a pending invite answers the records from a window before it, not an earlier round’s', () => {
    expect(round([october, november], { pendingAt: invitedToday })).toEqual(['igorcoin']);
  });

  it('the same when the earlier round’s decided invite is known', () => {
    expect(
      round([october, november], { decidedEnd: NOW - 25 * DAY, pendingAt: invitedToday })
    ).toEqual(['igorcoin']);
  });

  it('keeps every nominator of the round, and those who nominated while it waits for approvals', () => {
    const second = entry('Nora Nominator', NOW - 2 * DAY);
    const late = entry('Kit Kicked', NOW - 10 * 60_000);
    expect(round([october, november, second, late], { pendingAt: invitedToday })).toEqual([
      'igorcoin',
      'Nora Nominator',
      'Kit Kicked',
    ]);
  });

  it('with nothing in its window, the newest record stands for its round, as a waiting one’s does', () => {
    expect(
      round([october, entry('igorcoin', NOW - 20 * DAY)], { pendingAt: invitedToday })
    ).toEqual(['igorcoin']);
  });

  it('a re-invite after a decided round carries that round over', () => {
    expect(round([october], { decidedEnd: NOW - 25 * DAY, pendingAt: invitedToday })).toEqual([
      'Simon James',
    ]);
  });

  it('without a pending invite, lapsed records give way to newer ones', () => {
    expect(round([october, november], {})).toEqual(['igorcoin']);
    expect(round([october], {})).toEqual(['Simon James']);
  });
});
