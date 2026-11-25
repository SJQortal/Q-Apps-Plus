import { describe, expect, it } from 'vitest';
import { earlierRounds, lapsedRounds, nominationAnswered, pickRound } from './nomination';

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

  // Simon, 2026-11-20: once the November invite was rejected, Jonny's nomination showed
  // October's nominator and text: the decided round took every record before its decision.
  it('a decided round is the records its own invite answered, not an earlier round’s', () => {
    expect(
      pickRound([october, november], {
        decidedEnd: NOW - DAY,
        decidedAt: NOW - 3 * DAY,
        pendingAt: null,
        nowMs: NOW,
        windowMs: WINDOW,
      }).entries.map((e) => e.who)
    ).toEqual(['igorcoin']);
    // A re-invite after it carries that round over, not October's.
    expect(
      pickRound([october, november], {
        decidedEnd: NOW - DAY,
        decidedAt: NOW - 3 * DAY,
        pendingAt: invitedToday,
        nowMs: NOW,
        windowMs: WINDOW,
      }).entries.map((e) => e.who)
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

describe('lapsedRounds: nominations no Minter Admin signed in time', () => {
  const NOW = 300 * DAY;
  const ctx = { windowMs: WINDOW, nowMs: NOW, from: 100 * DAY };
  const who = (rounds: ReturnType<typeof lapsedRounds<ReturnType<typeof entry>>>) =>
    rounds.map((r) => r.records.map((e) => e.who));

  // Simon, 2026-11-17: igorcoin nominated Stone Golem on 9 Nov; nobody signed, it lapsed.
  it('a round with no invite lapses a window after its record', () => {
    const igorcoin = entry('igorcoin', NOW - 9 * DAY);
    const rounds = lapsedRounds([igorcoin], [], ctx);
    expect(who(rounds)).toEqual([['igorcoin']]);
    expect(rounds[0].endedAt).toBe(igorcoin.publishedAt + WINDOW);
  });

  it('records a window or less apart wait together, until a window after the newest', () => {
    const a = entry('Nora Nominator', NOW - 20 * DAY);
    const b = entry('igorcoin', NOW - 15 * DAY);
    const rounds = lapsedRounds([b, a], [], ctx);
    expect(who(rounds)).toEqual([['Nora Nominator', 'igorcoin']]);
    expect(rounds[0].endedAt).toBe(b.publishedAt + WINDOW);
  });

  it('an invite in the wait answers the round; a record while it was pending is in that round', () => {
    const a = entry('Nora Nominator', NOW - 30 * DAY);
    const during = entry('Kit Kicked', NOW - 27 * DAY);
    const invite = { at: NOW - 28 * DAY, decidedAt: NOW - 24 * DAY };
    expect(lapsedRounds([a, during], [invite], ctx)).toEqual([]);
  });

  it('a record after a decided invite starts a round of its own, which can lapse', () => {
    const a = entry('Simon James', NOW - 40 * DAY);
    const again = entry('igorcoin', NOW - 30 * DAY);
    const invite = { at: NOW - 39 * DAY, decidedAt: NOW - 35 * DAY };
    expect(who(lapsedRounds([a, again], [invite], ctx))).toEqual([['igorcoin']]);
  });

  it('not while it still waits, nor while an invite is pending', () => {
    expect(lapsedRounds([entry('igorcoin', NOW - 2 * DAY)], [], ctx)).toEqual([]);
    const a = entry('igorcoin', NOW - 20 * DAY);
    expect(lapsedRounds([a], [{ at: NOW - 19 * DAY, decidedAt: null }], ctx)).toEqual([]);
  });

  it('only rounds that began after the invites read begin', () => {
    expect(lapsedRounds([entry('igorcoin', 90 * DAY)], [], ctx)).toEqual([]);
  });
});

// Simon, 2026-11-24: igorcoin nominated Stone Golem again, and the comments of the nomination
// that lapsed came along. They stay, marked as from the previous nomination, with how it ended.
describe('earlierRounds: a nominee’s rounds before the one shown', () => {
  const NOW = 200 * DAY;
  const ctx = (start: number, invite: string | null = null) => ({
    current: { start, invite },
    windowMs: WINDOW,
    nowMs: NOW,
  });

  it('one that lapsed: its first record, until its wait ran out', () => {
    const first = entry('igorcoin', NOW - 15 * DAY);
    const again = entry('igorcoin', NOW - 1 * DAY);
    expect(earlierRounds([first, again], [], [], ctx(again.publishedAt))).toEqual([
      {
        startedAt: first.publishedAt,
        endedAt: first.publishedAt + WINDOW,
        outcome: 'lapsed',
        invite: null,
      },
    ]);
  });

  it('each invite decided before it, with how it ended and from the record it answered', () => {
    const october = entry('Simon James', NOW - 40 * DAY);
    const november = entry('igorcoin', NOW - 12 * DAY);
    const decided = [
      {
        signature: 'oct',
        at: NOW - 38 * DAY,
        decidedAt: NOW - 35 * DAY,
        outcome: 'rejected' as const,
      },
      {
        signature: 'nov',
        at: NOW - 10 * DAY,
        decidedAt: NOW - 4 * DAY,
        outcome: 'rejected' as const,
      },
    ];
    // The November round is the one shown (rejected): only October's is earlier.
    expect(
      earlierRounds([october, november], decided, [], ctx(november.publishedAt, 'nov'))
    ).toEqual([
      {
        startedAt: october.publishedAt,
        endedAt: NOW - 35 * DAY,
        outcome: 'rejected',
        invite: { signature: 'oct', at: NOW - 38 * DAY },
      },
    ]);
  });

  it('a record still waiting when the shown round began is part of it, not earlier', () => {
    const waiting = entry('Avery Admin', NOW - 9 * DAY);
    const shown = entry('Nora Nominator', NOW - 3 * DAY);
    expect(earlierRounds([waiting, shown], [], [], ctx(shown.publishedAt))).toEqual([]);
  });

  it('none for a first nomination', () => {
    const only = entry('igorcoin', NOW - 2 * DAY);
    expect(earlierRounds([only], [], [], ctx(only.publishedAt))).toEqual([]);
  });
});
