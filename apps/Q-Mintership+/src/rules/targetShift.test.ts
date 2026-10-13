import { describe, expect, it } from 'vitest';
import { APPROVAL_THRESHOLDS, approvalsNeeded, meetsThreshold } from './threshold';
import type { TxRow } from '../data/types';
import {
  adminChangeDelta,
  adminCountAt,
  adminLeaves,
  approvedAdminChanges,
  adminCountAfter,
  effectsBetween,
  hasImpact,
  projectShift,
  riskFor,
  scenarioFor,
  shiftDecisionsOf,
  shiftScenarios,
  targetMoves,
  targetSteps,
  toShiftDecision,
  type AdminChangeInput,
  type ShiftDecision,
  type ShiftState,
} from './targetShift';
import type { Decision } from './decision';

const OWNER = 'Qowner';
const admins = (n: number) => [OWNER, ...Array.from({ length: n - 1 }, (_, i) => `Qadmin${i}`)];
const state = (n: number, threshold: ShiftState['threshold'] = 'PCT40'): ShiftState => ({
  threshold,
  adminCount: n,
  admins: admins(n),
  owner: OWNER,
});
const remove = (subject: string | null, signature?: string): AdminChangeInput => ({
  kind: 'removeAdmin',
  subject,
  ...(signature ? { signature } : {}),
});
const add = (subject: string | null, signature?: string): AdminChangeInput => ({
  kind: 'addAdmin',
  subject,
  ...(signature ? { signature } : {}),
});
const decision = (
  signature: string,
  approvals: number,
  rejections = 0,
  kind: ShiftDecision['kind'] = 'kick',
  subject: string | null = `Qsubject-${signature}`
): ShiftDecision => ({ signature, kind, subject, approvals, rejections });
const changeDecision = (
  signature: string,
  change: AdminChangeInput,
  approvals: number,
  rejections = 0
): ShiftDecision => ({
  signature,
  kind: change.kind,
  subject: change.subject,
  approvals,
  rejections,
});

describe('adminCountAfter: how a waiting admin change moves the count', () => {
  const s = state(20);

  it('adds a row for someone who is not an admin yet', () => {
    expect(adminCountAfter(s, [add('Qnew')])).toBe(21);
    expect(adminChangeDelta(s, add('Qnew'))).toBe(1);
  });

  it('changes nothing when the account already is an admin', () => {
    expect(adminCountAfter(s, [add('Qadmin3')])).toBe(20);
    expect(adminChangeDelta(s, add('Qadmin3'))).toBe(0);
  });

  it('takes a row away for a current admin', () => {
    expect(adminCountAfter(s, [remove('Qadmin3')])).toBe(19);
    expect(adminChangeDelta(s, remove('Qadmin3'))).toBe(-1);
  });

  it('changes nothing for removing someone who is not an admin', () => {
    expect(adminCountAfter(s, [remove('Qnobody')])).toBe(20);
  });

  it('never moves the owner row, which can not be removed', () => {
    expect(adminCountAfter(s, [remove(OWNER)])).toBe(20);
    expect(adminCountAfter(s, [add(OWNER)])).toBe(20);
    // Even when the owner isn't in the rows read (e.g. a short read).
    const short: ShiftState = { ...s, admins: ['Qadmin0'] };
    expect(adminCountAfter(short, [remove(OWNER), add(OWNER)])).toBe(20);
  });

  it('counts several changes about one account once', () => {
    expect(adminCountAfter(s, [remove('Qadmin1'), remove('Qadmin1')])).toBe(19);
    expect(adminCountAfter(s, [add('Qnew'), add('Qnew')])).toBe(21);
    // An admin both added and removed: the removal is what can move the count.
    expect(adminCountAfter(s, [add('Qadmin1'), remove('Qadmin1')])).toBe(19);
    // Someone not an admin both added and removed: the addition is what can move it.
    expect(adminCountAfter(s, [remove('Qnew'), add('Qnew')])).toBe(21);
  });

  it('adds up changes about different accounts', () => {
    expect(adminCountAfter(s, [remove('Qadmin1'), remove('Qadmin2'), remove('Qadmin3')])).toBe(17);
    expect(adminCountAfter(s, [add('Qa'), add('Qb')])).toBe(22);
    expect(adminCountAfter(s, [add('Qa'), remove('Qadmin1'), remove('Qadmin2')])).toBe(19);
  });

  it('ignores changes whose subject Core left out, and never goes below zero', () => {
    expect(adminCountAfter(s, [remove(null), add(null)])).toBe(20);
    expect(adminCountAfter({ ...s, adminCount: 0, admins: ['Qx'] }, [remove('Qx')])).toBe(0);
  });

  it('an add for someone no longer in MINTER doesn’t move the count', () => {
    const withMembers: ShiftState = { ...s, members: [...admins(20), 'Qmember'] };
    expect(adminCountAfter(withMembers, [add('Qgone')])).toBe(20);
    expect(adminCountAfter(withMembers, [add('Qmember')])).toBe(21);
    // Admins are members: removing one still takes a row away.
    expect(adminCountAfter(withMembers, [remove('Qadmin3')])).toBe(19);
    // Members not known: every add for a non-admin counts.
    expect(adminCountAfter(s, [add('Qgone')])).toBe(21);
    expect(adminCountAfter({ ...s, members: null }, [add('Qgone')])).toBe(21);
  });

  it('takes the admin rows as a list or a set', () => {
    const asSet: ShiftState = { ...s, admins: new Set(admins(20)) };
    expect(adminCountAfter(asSet, [remove('Qadmin4'), add('Qnew')])).toBe(20);
    expect(adminCountAfter(asSet, [remove('Qadmin4')])).toBe(19);
  });
});

describe('effectsBetween: what a new count does to each waiting decision', () => {
  it('the real case: 21 admin rows → 17, 9 needed → 7, and decisions with 7 apply at once', () => {
    const effects = effectsBetween('PCT40', 21, 17, [
      decision('kick-a', 7),
      decision('kick-b', 7),
      decision('invite', 6),
      decision('met', 9),
    ]);
    expect(effects.map((e) => [e.signature, e.effect])).toEqual([
      ['kick-a', 'applies'],
      ['kick-b', 'applies'],
    ]);
    expect(effects[0]).toMatchObject({ neededNow: 9, neededThen: 7, approvals: 7 });
  });

  it('matches Core for every threshold, count and number of signatures', () => {
    for (const threshold of APPROVAL_THRESHOLDS) {
      for (let now = 1; now <= 25; now++) {
        for (const then of [now - 3, now - 2, now - 1, now + 1, now + 2]) {
          if (then < 0) continue;
          for (let approvals = 0; approvals <= now + 2; approvals++) {
            for (const rejections of [0, 1, approvals, now]) {
              const [effect] = effectsBetween(threshold, now, then, [
                decision('d', approvals, rejections),
              ]);
              const metNow = meetsThreshold(threshold, approvals, now);
              const metThen = meetsThreshold(threshold, approvals, then);
              const rejNow = meetsThreshold(threshold, rejections, now);
              const rejThen = meetsThreshold(threshold, rejections, then);
              const neededNow = approvalsNeeded(threshold, now);
              const neededThen = approvalsNeeded(threshold, then);
              let expected: string | undefined;
              if (!metNow && metThen) expected = 'applies';
              else if (!metThen && rejThen && !rejNow) expected = 'rejected';
              else if (!metThen && neededThen > neededNow) expected = 'needsMore';
              expect(
                effect?.effect,
                `${threshold} ${now}→${then} a${approvals} r${rejections}`
              ).toBe(expected);
              if (effect?.effect === 'needsMore') {
                expect(effect.more).toBe(neededThen - approvals);
                expect(effect.wasMet).toBe(metNow);
              }
            }
          }
        }
      }
    }
  });

  it('NONE and ONE never move with the count', () => {
    for (const threshold of ['NONE', 'ONE'] as const) {
      for (let a = 0; a < 5; a++)
        expect(effectsBetween(threshold, 20, 10, [decision('d', a, a)])).toEqual([]);
      expect(effectsBetween(threshold, 20, 30, [decision('d', 0)])).toEqual([]);
    }
  });

  it('each percentage threshold flips at its own count', () => {
    // Each comment: the target before → after.
    expect(effectsBetween('PCT20', 21, 20, [decision('d', 4)])[0]?.effect).toBe('applies'); // 5 → 4
    expect(effectsBetween('PCT40', 18, 17, [decision('d', 7)])[0]?.effect).toBe('applies'); // 8 → 7
    expect(effectsBetween('PCT60', 20, 19, [decision('d', 11)])).toEqual([]); // 12 → 12
    expect(effectsBetween('PCT60', 20, 18, [decision('d', 11)])[0]?.effect).toBe('applies'); // 12 → 11
    expect(effectsBetween('PCT80', 20, 19, [decision('d', 16)])).toEqual([]); // 16 → 16
    expect(effectsBetween('PCT80', 20, 18, [decision('d', 15)])[0]?.effect).toBe('applies'); // 16 → 15
    expect(effectsBetween('PCT100', 20, 19, [decision('d', 19)])[0]?.effect).toBe('applies'); // 20 → 19
  });

  it('approval wins a tie: approvals and rejections both reaching the new target apply it', () => {
    const [effect] = effectsBetween('PCT40', 21, 20, [decision('d', 8, 8)]);
    expect(effect.effect).toBe('applies');
  });

  it('ends a decision as rejected when only its rejections reach the new target', () => {
    const [effect] = effectsBetween('PCT40', 21, 20, [decision('d', 3, 8)]);
    expect(effect).toMatchObject({ effect: 'rejected', rejections: 8, neededThen: 8 });
    // Already rejected at today's target: Core ends it anyway, nothing new.
    expect(effectsBetween('PCT40', 21, 20, [decision('d', 3, 9)])).toEqual([]);
  });

  it('a rising target: every decision short of it would need more, those met now first in line', () => {
    const effects = effectsBetween('PCT40', 20, 21, [decision('a', 5), decision('b', 8)]);
    expect(effects).toEqual([
      expect.objectContaining({ signature: 'a', effect: 'needsMore', more: 4, wasMet: false }),
      expect.objectContaining({ signature: 'b', effect: 'needsMore', more: 1, wasMet: true }),
    ]);
    // A decision already at the higher target isn't touched.
    expect(effectsBetween('PCT40', 20, 21, [decision('c', 9)])).toEqual([]);
  });

  it('a count that moves without moving the target changes nothing', () => {
    expect(effectsBetween('PCT40', 20, 19, [decision('d', 7), decision('e', 8)])).toEqual([]);
  });

  it('skips excluded and duplicate decisions', () => {
    const effects = effectsBetween(
      'PCT40',
      21,
      20,
      [decision('d', 8), decision('d', 8), decision('x', 8)],
      new Set(['x'])
    );
    expect(effects.map((e) => e.signature)).toEqual(['d']);
  });
});

describe('projectShift: if these admin changes pass', () => {
  it('one removal: the target drops and the decisions at the new target apply at once', () => {
    const s = state(21); // 9 needed
    const removal = remove('Qadmin5', 'rm');
    const result = projectShift(
      s,
      [
        changeDecision('rm', removal, 4),
        decision('jonny', 8),
        decision('other', 5),
        decision('met', 9),
      ],
      [removal]
    );
    expect(result).toMatchObject({
      scope: 'one',
      countNow: 21,
      countThen: 20,
      neededNow: 9,
      neededThen: 8,
      followOn: [],
    });
    expect(result.effects).toEqual([
      expect.objectContaining({ signature: 'jonny', effect: 'applies', cascade: false }),
    ]);
    expect(hasImpact(result)).toBe(true);
  });

  it('one addition: the target rises, and every decision short of it needs more', () => {
    const s = state(20); // 8 needed
    const addition = add('Qnew', 'ad');
    const result = projectShift(
      s,
      [changeDecision('ad', addition, 5), decision('met', 8), decision('low', 2)],
      [addition]
    );
    expect(result).toMatchObject({ countThen: 21, neededThen: 9 });
    expect(result.effects.map((e) => [e.signature, e.effect, e.more, e.wasMet])).toEqual([
      ['met', 'needsMore', 1, true],
      ['low', 'needsMore', 7, false],
    ]);
  });

  it('a change that moves the count but not the target has no impact', () => {
    const removal = remove('Qadmin5', 'rm');
    const result = projectShift(
      state(20),
      [changeDecision('rm', removal, 7), decision('d', 7)],
      [removal]
    );
    expect(result).toMatchObject({ countThen: 19, neededNow: 8, neededThen: 8, effects: [] });
    expect(hasImpact(result)).toBe(false);
  });

  it('a change that moves nothing (owner, a non-admin, an admin made admin again)', () => {
    for (const change of [remove(OWNER, 'c'), remove('Qnobody', 'c'), add('Qadmin2', 'c')]) {
      const result = projectShift(state(21), [decision('d', 8)], [change]);
      expect(result.countThen).toBe(21);
      expect(result.effects).toEqual([]);
    }
  });

  it('several removals together', () => {
    const s = state(21); // 9 needed
    const r = [
      remove('Qadmin1', 'r1'),
      remove('Qadmin2', 'r2'),
      remove('Qadmin3', 'r3'),
      remove('Qadmin4', 'r4'),
    ];
    const decisions = [
      ...r.map((c) => changeDecision(c.signature as string, c, 2)),
      decision('kick-a', 7),
      decision('kick-b', 7),
      decision('kick-c', 6),
    ];
    const result = projectShift(s, decisions, r, 'removals');
    expect(result).toMatchObject({ countThen: 17, neededThen: 7 });
    expect(result.effects.map((e) => e.signature)).toEqual(['kick-a', 'kick-b']);
  });

  it('additions and removals together net out, but the drop on the way still counts', () => {
    const s = state(21);
    const changes = [remove('Qadmin1', 'r1'), add('Qnew', 'a1')];
    const result = projectShift(s, [decision('d', 8)], changes, 'all');
    // 21 seats in the end, but 20 (8 needed) if the removal comes first.
    expect(result).toMatchObject({
      countThen: 21,
      neededThen: 9,
      countLow: 20,
      neededLow: 8,
      countHigh: 22,
      neededHigh: 9,
    });
    expect(result.effects).toEqual([
      expect.objectContaining({ signature: 'd', effect: 'applies', neededThen: 8 }),
    ]);
  });

  describe('a drop that brings an addition along back to the same count', () => {
    // 8 admin rows, PCT40: 4 needed; at 7 rows, 3.
    const s = state(8);
    const rem = remove('Qadmin6', 'REM');
    const addM1 = add('QM1', 'ADD');
    const decisions = [
      changeDecision('REM', rem, 3),
      changeDecision('ADD', addM1, 3),
      decision('INV', 3, 0, 'invite'),
    ];

    it('one change: what applies at 7 rows on the way is still reported', () => {
      const result = projectShift(s, decisions, [rem]);
      expect(result).toMatchObject({
        followOn: ['ADD'],
        countThen: 8,
        neededThen: 4,
        countLow: 7,
        neededLow: 3,
      });
      expect(result.effects.map((e) => [e.signature, e.effect, e.neededThen])).toEqual([
        ['ADD', 'applies', 3],
        ['INV', 'applies', 3],
      ]);
      expect(hasImpact(result)).toBe(true);
      const risk = riskFor('INV', shiftScenarios(s, decisions));
      expect(risk?.effect).toMatchObject({ effect: 'applies', neededNow: 4, neededThen: 3 });
    });

    it('both together: their order in one block decides the count on the way', () => {
      const result = projectShift(s, decisions, [rem, addM1], 'all');
      expect(result).toMatchObject({ countThen: 8, countLow: 7, countHigh: 9, neededHigh: 4 });
      expect(result.effects.map((e) => [e.signature, e.effect])).toEqual([['INV', 'applies']]);
      expect(hasImpact(result)).toBe(true);
    });
  });

  it('all together: a removal and an add for someone no longer in MINTER', () => {
    const s: ShiftState = { ...state(21), members: new Set(admins(21)) };
    const changes = [remove('Qadmin1', 'r1'), add('Qgone', 'a1')];
    const result = projectShift(s, [decision('d', 8)], changes, 'all');
    // The add can't apply: only the removal moves the count (21 → 20, 9 → 8 needed).
    expect(result).toMatchObject({ countThen: 20, neededThen: 8, countHigh: 21 });
    expect(result.effects.map((e) => [e.signature, e.effect])).toEqual([['d', 'applies']]);
  });

  it('a duplicate removal of one admin counts once', () => {
    const s = state(21);
    const changes = [remove('Qadmin1', 'r1'), remove('Qadmin1', 'r2')];
    const result = projectShift(s, [decision('d', 8)], changes, 'removals');
    expect(result.countThen).toBe(20);
    expect(result.effects.map((e) => e.signature)).toEqual(['d']);
  });

  it('follows an admin change that would itself apply at once, and marks what comes after it', () => {
    // PCT100 with 5 rows: every removal moves the target.
    const s = state(5, 'PCT100');
    const first = remove('Qadmin0', 'r1');
    const second = remove('Qadmin1', 'r2');
    const decisions = [
      changeDecision('r1', first, 0),
      changeDecision('r2', second, 4),
      decision('kick', 3),
      decision('ban', 2, 3),
    ];
    const result = projectShift(s, decisions, [first]);
    expect(result).toMatchObject({ countThen: 3, neededThen: 3, followOn: ['r2'] });
    expect(result.effects.map((e) => [e.signature, e.effect, e.cascade])).toEqual([
      ['r2', 'applies', false],
      ['kick', 'applies', true],
      ['ban', 'rejected', true],
    ]);
  });

  it('a follow-on change that moves nothing stops the chain', () => {
    const s = state(5, 'PCT100');
    const first = remove('Qadmin0', 'r1');
    const noop = remove('Qnobody', 'r2');
    const result = projectShift(s, [changeDecision('r2', noop, 4), decision('kick', 3)], [first]);
    expect(result).toMatchObject({ countThen: 4, followOn: ['r2'] });
    expect(result.effects.map((e) => e.signature)).toEqual(['r2']);
  });

  it('a proposal not made yet (no signature) is projected the same way', () => {
    const result = projectShift(state(21), [decision('d', 8)], [remove('Qadmin3')]);
    expect(result.effects.map((e) => e.signature)).toEqual(['d']);
  });

  it('lists the most at risk first: applies, rejected, then needs more (met now first)', () => {
    const s = state(5, 'PCT100');
    const first = remove('Qadmin0', 'r1');
    const result = projectShift(
      s,
      [decision('rej', 0, 4), decision('app', 4), decision('app2', 4, 1)],
      [first]
    );
    expect(result.effects.map((e) => [e.signature, e.effect])).toEqual([
      ['app', 'applies'],
      ['app2', 'applies'],
      ['rej', 'rejected'],
    ]);
  });
});

describe('shiftScenarios', () => {
  const s = state(21);
  const r1 = remove('Qadmin1', 'r1');
  const r2 = remove('Qadmin2', 'r2');
  const a1 = add('Qnew1', 'a1');
  const a2 = add('Qnew2', 'a2');

  it('each change alone, every removal together, every addition together, and all together', () => {
    const decisions = [
      changeDecision('r1', r1, 1),
      changeDecision('r2', r2, 1),
      changeDecision('a1', a1, 1),
      changeDecision('a2', a2, 1),
      decision('kick', 8),
    ];
    const scenarios = shiftScenarios(s, decisions);
    expect(scenarios.map((x) => [x.scope, x.changes.map((c) => c.signature).join(',')])).toEqual([
      ['one', 'r1'],
      ['one', 'r2'],
      ['one', 'a1'],
      ['one', 'a2'],
      ['removals', 'r1,r2'],
      ['adds', 'a1,a2'],
      ['all', 'r1,r2,a1,a2'],
    ]);
    expect(scenarioFor(scenarios, 'r1')?.neededThen).toBe(8);
    expect(scenarios.find((x) => x.scope === 'removals')?.neededThen).toBe(8); // 19 rows
    expect(scenarios.find((x) => x.scope === 'adds')?.neededThen).toBe(10); // 23 rows
    expect(scenarios.find((x) => x.scope === 'all')?.neededThen).toBe(9);
    expect(scenarioFor(scenarios, 'kick')).toBeNull();
  });

  it('adds no combination that would repeat a single one', () => {
    const scenarios = shiftScenarios(s, [changeDecision('r1', r1, 1), decision('kick', 8)]);
    expect(scenarios.map((x) => x.scope)).toEqual(['one']);
    expect(shiftScenarios(s, [decision('kick', 8)])).toEqual([]);
  });
});

describe('riskFor: the chip on a decision', () => {
  const s = state(23); // 10 needed
  const r1 = remove('Qadmin1', 'r1');
  const r2 = remove('Qadmin2', 'r2');
  const a1 = add('Qnew', 'a1');

  it('prefers the single change over a combination', () => {
    const decisions = [
      changeDecision('r1', r1, 0),
      changeDecision('r2', r2, 0),
      decision('nine', 9), // one removal: 22 rows → 9
      decision('eight', 8), // even both removals leave 21 rows → 9
    ];
    const scenarios = shiftScenarios(s, decisions);
    const risk = riskFor('nine', scenarios);
    expect(risk?.effect.effect).toBe('applies');
    expect(risk?.scenario.scope).toBe('one');
    expect(risk?.scenario.neededThen).toBe(9);
    expect(riskFor('eight', scenarios)).toBeNull();
  });

  it('only a combination flips it: that one is named', () => {
    const big = state(26); // 11 needed
    const decisions = [
      changeDecision('r1', r1, 0),
      changeDecision('r2', r2, 0),
      decision('ten', 10), // one removal: 25 rows → 10
      decision('nine', 9), // needs 22 rows or fewer: four removals
    ];
    const scenarios = shiftScenarios(big, decisions);
    expect(riskFor('ten', scenarios)?.scenario.scope).toBe('one');
    expect(riskFor('nine', scenarios)).toBeNull();
    const more = shiftScenarios(big, [
      ...decisions,
      changeDecision('r3', remove('Qadmin3', 'r3'), 0),
      changeDecision('r4', remove('Qadmin4', 'r4'), 0),
    ]);
    expect(riskFor('nine', more)?.scenario).toMatchObject({ scope: 'removals', neededThen: 9 });
  });

  it('flags a rising target only for a decision that has enough signatures now', () => {
    const at = state(20); // 8 needed
    const decisions = [changeDecision('a1', a1, 0), decision('met', 8), decision('low', 3)];
    const scenarios = shiftScenarios(at, decisions);
    expect(riskFor('met', scenarios)?.effect).toMatchObject({ effect: 'needsMore', wasMet: true });
    expect(riskFor('low', scenarios)).toBeNull();
  });

  it('a flip outranks needing more', () => {
    const at = state(21); // 9 needed
    const decisions = [
      changeDecision('r1', r1, 0),
      changeDecision('a1', add('Qnew', 'a1'), 0),
      decision('eight', 8),
    ];
    const scenarios = shiftScenarios(at, decisions);
    expect(riskFor('eight', scenarios)?.effect.effect).toBe('applies');
  });
});

describe('the decisions the projection reads', () => {
  const base = {
    type: 'GROUP_KICK',
    subject: 'Qs',
    creatorAddress: null,
    createdAt: 0,
    blockHeight: 1,
    window: null,
    windowPhase: null,
    applyAtHeight: null,
    unusualRoute: false,
    tx: {} as Decision['tx'],
  };
  const tally = (approvalCount: number, rejectionCount: number) =>
    ({ approvalCount, rejectionCount }) as Decision['tally'];

  it('reads the confirmed approvals and rejections, and leaves out expired ones and those without a tally', () => {
    const decisions: Decision[] = [
      { ...base, signature: 'a', kind: 'kick', phase: 'open', tally: tally(5, 1) },
      { ...base, signature: 'b', kind: 'kick', phase: 'expired', tally: tally(9, 0) },
      { ...base, signature: 'c', kind: 'addAdmin', phase: 'tooLate', tally: tally(2, 0) },
      { ...base, signature: 'd', kind: 'kick', phase: 'open', tally: null },
    ];
    expect(shiftDecisionsOf(decisions)).toEqual([
      { signature: 'a', kind: 'kick', subject: 'Qs', approvals: 5, rejections: 1 },
      { signature: 'c', kind: 'addAdmin', subject: 'Qs', approvals: 2, rejections: 0 },
    ]);
    expect(toShiftDecision(decisions[3])).toBeNull();
  });

  it('keeps doubles in, and counts a repeated change once', () => {
    const open = { ...base, phase: 'open' as const };
    const decisions: Decision[] = [
      {
        ...open,
        signature: 'again',
        kind: 'addAdmin',
        subject: 'Qadmin2',
        tally: tally(5, 0),
        double: { reason: 'alreadyInEffect' },
      },
      {
        ...open,
        signature: 'gone',
        kind: 'removeAdmin',
        subject: 'Qnobody',
        tally: tally(2, 0),
        double: { reason: 'alreadyInEffect' },
      },
      { ...open, signature: 'first', kind: 'addAdmin', subject: 'Qnew', tally: tally(3, 0) },
      {
        ...open,
        signature: 'second',
        kind: 'addAdmin',
        subject: 'Qnew',
        tally: tally(1, 0),
        double: { reason: 'duplicate', otherSignature: 'first' },
      },
      { ...open, signature: 'k', kind: 'kick', tally: tally(8, 0) },
    ];
    const list = shiftDecisionsOf(decisions);
    expect(list.map((d) => d.signature)).toEqual(['again', 'gone', 'first', 'second', 'k']);
    const s = state(20);
    const scenarios = shiftScenarios(s, list);
    // An addition of a Minter Admin adds no seat, a removal of someone who isn't one removes none.
    expect(adminCountAfter(s, [add('Qadmin2', 'again'), remove('Qnobody', 'gone')])).toBe(20);
    for (const signature of ['again', 'gone']) {
      expect(scenarioFor(scenarios, signature)).toMatchObject({ countThen: 20, effects: [] });
      expect(hasImpact(scenarioFor(scenarios, signature))).toBe(false);
    }
    // Both copies of one addition add one seat, not two: 21 rows, 9 needed.
    const adds = scenarios.find((x) => x.scope === 'adds');
    expect(adds).toMatchObject({ countThen: 21, neededThen: 9 });
    expect(scenarioFor(scenarios, 'second')).toMatchObject({ countThen: 21 });
  });

  describe('an addition of a Minter Admin, while their removal is waiting', () => {
    // 18 admin rows, PCT40: 8 needed; at 17 rows, 7.
    const s = state(18);
    const open = { ...base, phase: 'open' as const };
    const decisions: Decision[] = [
      {
        ...open,
        signature: 'again',
        kind: 'addAdmin',
        subject: 'Qadmin3',
        tally: tally(7, 0),
        double: { reason: 'alreadyInEffect' },
      },
      { ...open, signature: 'out', kind: 'removeAdmin', subject: 'Qadmin3', tally: tally(2, 0) },
    ];
    const list = shiftDecisionsOf(decisions);

    it('applies at the lower target once the removal passes, and adds their seat back', () => {
      for (const result of [
        // Step down, before it is proposed…
        projectShift(s, list, [remove('Qadmin3')]),
        // …and the removal already waiting.
        scenarioFor(shiftScenarios(s, list), 'out'),
      ]) {
        expect(result).toMatchObject({
          followOn: ['again'],
          countLow: 17,
          neededLow: 7,
          countThen: 18,
          neededThen: 8,
        });
        expect(result?.effects.map((e) => [e.signature, e.effect])).toEqual([['again', 'applies']]);
        expect(hasImpact(result)).toBe(true);
      }
    });

    it('on its own it still changes nothing', () => {
      expect(scenarioFor(shiftScenarios(s, list), 'again')).toMatchObject({
        countThen: 18,
        effects: [],
        followOn: [],
      });
    });
  });
});

describe('targetSteps: the target before and after each approved admin change', () => {
  it('works back from today’s count, newest first', () => {
    const steps = targetSteps(
      [
        { signature: 'x1', address: 'Qa', added: false, height: 100 },
        { signature: 'x3', address: 'Qc', added: true, height: 300 },
        { signature: 'x2', address: 'Qb', added: false, height: 200 },
      ],
      21,
      'PCT40'
    );
    expect(
      steps.map((s) => [s.signature, s.countBefore, s.countAfter, s.neededBefore, s.neededAfter])
    ).toEqual([
      ['x3', 20, 21, 8, 9],
      ['x2', 21, 20, 9, 8],
      ['x1', 22, 21, 9, 9],
    ]);
    expect(targetMoves(steps).map((s) => s.signature)).toEqual(['x3', 'x2']);
  });

  it('the real case: four removals take MINTER from 21 rows (9 needed) to 17 (7 needed)', () => {
    const steps = targetSteps(
      [1, 2, 3, 4].map((i) => ({ address: `Q${i}`, added: false, height: 2_741_830 + i })),
      17,
      'PCT40'
    );
    expect(steps[steps.length - 1]).toMatchObject({ countBefore: 21, neededBefore: 9 });
    expect(steps[0]).toMatchObject({ countAfter: 17, neededAfter: 7 });
    expect(targetMoves(steps).map((s) => [s.neededBefore, s.neededAfter])).toEqual([
      [8, 7],
      [9, 8],
    ]);
  });

  it('counts an admin’s own leave, which takes their admin row away too', () => {
    // 22 rows now. Y was made an admin at 500 and left at 1000; Z was made one at 900.
    const changes = [
      { signature: 'addY', address: 'QY', added: true, height: 500 },
      { signature: 'addZ', address: 'QZ', added: true, height: 900 },
    ];
    const leaves = adminLeaves(
      [
        {
          signature: 'leaveY',
          type: 'LEAVE_GROUP',
          creatorAddress: 'QY',
          blockHeight: 1000,
          groupId: 694,
          txGroupId: 0,
          timestamp: 0,
        } as TxRow,
      ],
      changes
    );
    expect(leaves).toEqual([{ signature: 'leaveY', address: 'QY', height: 1000, wasAdmin: true }]);
    const steps = targetSteps(changes, 22, 'PCT40', leaves);
    expect(
      steps.map((s) => [s.signature, s.countBefore, s.countAfter, s.neededBefore, s.neededAfter])
    ).toEqual([
      ['addZ', 22, 23, 9, 10],
      ['addY', 21, 22, 9, 9],
    ]);
    expect(adminCountAt(changes, leaves, 22, 950)).toBe(23);
    expect(adminCountAt(changes, leaves, 22, 1000)).toBe(22);
  });

  it('takes a leave with nothing on record as a member’s, and a signer’s as an admin’s', () => {
    const changes = [{ signature: 'addZ', address: 'QZ', added: true, height: 900 }];
    const leaveRow = {
      signature: 'leaveY',
      type: 'LEAVE_GROUP',
      creatorAddress: 'QY',
      blockHeight: 1000,
      groupId: 694,
      txGroupId: 0,
      timestamp: 0,
    } as TxRow;
    const unknown = adminLeaves([leaveRow], changes);
    expect(unknown[0].wasAdmin).toBeNull();
    expect(targetSteps(changes, 22, 'PCT40', unknown)[0]).toMatchObject({
      countBefore: 21,
      countAfter: 22,
    });
    expect(adminCountAt(changes, unknown, 22, 950)).toBe(22);
    // Y signed a MINTER decision before leaving: an admin then.
    const signer = adminLeaves([leaveRow], changes, {
      approvals: [
        {
          signature: 'apY',
          type: 'GROUP_APPROVAL',
          creatorAddress: 'QY',
          blockHeight: 800,
          txGroupId: 694,
          timestamp: 0,
        } as TxRow,
      ],
    });
    expect(signer[0].wasAdmin).toBe(true);
    expect(targetSteps(changes, 22, 'PCT40', signer)[0]).toMatchObject({
      countBefore: 22,
      countAfter: 23,
      neededBefore: 9,
      neededAfter: 10,
    });
  });

  it('has nothing to say without changes, and never counts below zero', () => {
    expect(targetSteps([], 20, 'PCT40')).toEqual([]);
    const steps = targetSteps([{ address: 'Qa', added: true, height: 1 }], 0, 'PCT40');
    expect(steps[0]).toMatchObject({ countBefore: 0, countAfter: 0 });
  });
});

describe('adminLeaves: who left MINTER, and whether they were a Minter Admin then', () => {
  const leave = (signature: string, address: string, height: number, groupId = 694): TxRow =>
    ({
      signature,
      type: 'LEAVE_GROUP',
      creatorAddress: address,
      blockHeight: height,
      groupId,
      txGroupId: 0,
      timestamp: 0,
    }) as TxRow;
  const join = (address: string, height: number): TxRow =>
    ({
      signature: `join-${address}-${height}`,
      type: 'JOIN_GROUP',
      creatorAddress: address,
      blockHeight: height,
      groupId: 694,
      txGroupId: 0,
      timestamp: 0,
    }) as TxRow;
  const approval = (address: string, height: number): TxRow =>
    ({
      signature: `ap-${address}-${height}`,
      type: 'GROUP_APPROVAL',
      creatorAddress: address,
      blockHeight: height,
      txGroupId: 694,
      timestamp: 0,
    }) as TxRow;

  it('reads it from the newest approved admin change about them before the leave', () => {
    const changes = [
      { address: 'Qa', added: true, height: 100 },
      { address: 'Qa', added: false, height: 300 },
      { address: 'Qb', added: true, height: 200 },
      { address: 'Qb', added: false, height: 600 }, // after the leave: doesn't count
    ];
    const out = adminLeaves([leave('la', 'Qa', 500), leave('lb', 'Qb', 500)], changes);
    expect(out.map((l) => [l.address, l.wasAdmin])).toEqual([
      ['Qa', false],
      ['Qb', true],
    ]);
  });

  it('someone who joined since their last admin change was a member, not an admin', () => {
    const changes = [{ address: 'Qa', added: true, height: 100 }];
    const out = adminLeaves(
      [join('Qa', 200), leave('la', 'Qa', 500), leave('lc', 'Qc', 500), join('Qc', 50)],
      changes
    );
    expect(out.map((l) => [l.address, l.wasAdmin])).toEqual([
      ['Qa', false],
      ['Qc', false],
    ]);
  });

  it('a signature before the leave says they were an admin, when no change does', () => {
    const out = adminLeaves([leave('la', 'Qa', 500), leave('lb', 'Qb', 500)], [], {
      approvals: [approval('Qa', 400), approval('Qb', 700)],
    });
    expect(out.map((l) => [l.address, l.wasAdmin])).toEqual([
      ['Qa', true],
      ['Qb', null],
    ]);
  });

  it('keeps MINTER’s confirmed leaves once each, newest first, and skips the owner', () => {
    const out = adminLeaves(
      [
        leave('l1', 'Qa', 100),
        leave('l1', 'Qa', 100),
        leave('l2', 'Qb', 300),
        leave('other', 'Qc', 200, 7),
        { ...leave('pending', 'Qd', 0), blockHeight: undefined } as TxRow,
        leave('own', 'Qowner', 250),
      ],
      [],
      { owner: 'Qowner' }
    );
    expect(out.map((l) => l.signature)).toEqual(['l2', 'l1']);
  });
});

describe('approvedAdminChanges', () => {
  const row = (signature: string, fields: Partial<TxRow>): TxRow =>
    ({ signature, timestamp: 0, txGroupId: 694, groupId: 694, ...fields }) as TxRow;

  it('keeps approved admin changes once each, with the block they applied in', () => {
    const rows = [
      row('a', {
        type: 'ADD_GROUP_ADMIN',
        member: 'Qa',
        approvalStatus: 'APPROVED',
        approvalHeight: 10,
      }),
      row('a', {
        type: 'ADD_GROUP_ADMIN',
        member: 'Qa',
        approvalStatus: 'APPROVED',
        approvalHeight: 10,
      }),
      row('r', {
        type: 'REMOVE_GROUP_ADMIN',
        admin: 'Qr',
        approvalStatus: 'APPROVED',
        approvalHeight: 20,
      }),
      row('x', {
        type: 'REMOVE_GROUP_ADMIN',
        admin: 'Qx',
        approvalStatus: 'EXPIRED',
        approvalHeight: 30,
      }),
      row('p', { type: 'ADD_GROUP_ADMIN', member: 'Qp', approvalStatus: 'PENDING' }),
      row('k', {
        type: 'GROUP_KICK',
        member: 'Qk',
        approvalStatus: 'APPROVED',
        approvalHeight: 40,
      }),
      row('n', { type: 'REMOVE_GROUP_ADMIN', approvalStatus: 'APPROVED', approvalHeight: 50 }),
    ];
    expect(approvedAdminChanges(rows)).toEqual([
      { signature: 'a', address: 'Qa', added: true, height: 10 },
      { signature: 'r', address: 'Qr', added: false, height: 20 },
    ]);
  });
});
