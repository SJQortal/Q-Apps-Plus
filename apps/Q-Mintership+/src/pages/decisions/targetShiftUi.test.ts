import { describe, expect, it } from 'vitest';
import type { DecisionRisk, ShiftEffect, ShiftScenario } from '../../rules/targetShift';
import {
  changeNames,
  changeReason,
  effectLine,
  joinAnd,
  reasonWords,
  riskChipLabel,
  riskExplanation,
  scenarioLead,
  seatChange,
  shiftSentence,
  targetChangedTitle,
  targetMove,
  withdrawAdvice,
} from './targetShiftUi';

const scenario = (over: Partial<ShiftScenario> = {}): ShiftScenario => ({
  scope: 'one',
  changes: [{ signature: 'rm', kind: 'removeAdmin', subject: 'Qx' }],
  followOn: [],
  countNow: 21,
  countThen: 20,
  neededNow: 9,
  neededThen: 8,
  effects: [],
  ...over,
});
const effect = (over: Partial<ShiftEffect> = {}): ShiftEffect => ({
  signature: 'kick',
  effect: 'applies',
  approvals: 8,
  rejections: 0,
  neededNow: 9,
  neededThen: 8,
  more: 0,
  wasMet: false,
  cascade: false,
  ...over,
});
const LABELS: Record<string, string> = {
  rm: 'Remove a Minter Admin: Dex Demote',
  rm2: 'Remove a Minter Admin: Admin B',
  kick: 'Remove from MINTER: Kai Target',
};
const labelOf = (sig: string) => LABELS[sig] ?? 'A decision';

describe('the target in words', () => {
  it('joins names', () => {
    expect(joinAnd([])).toBe('');
    expect(joinAnd(['a'])).toBe('a');
    expect(joinAnd(['a', 'b'])).toBe('a and b');
    expect(joinAnd(['a', 'b', 'c'])).toBe('a, b and c');
  });

  it('says which way the target moves', () => {
    expect(targetMove(9, 8)).toBe('drops from 9 to 8 signatures');
    expect(targetMove(8, 9)).toBe('rises from 8 to 9 signatures');
    expect(targetMove(8, 8)).toBe('stays at 8 signatures');
    expect(targetMove(2, 1)).toBe('drops from 2 to 1 signature');
  });

  it('says what an admin change does to the seats and the target', () => {
    expect(shiftSentence(scenario(), 'If this passes')).toBe(
      'If this passes, MINTER has 20 admin seats and the target drops from 9 to 8 signatures.'
    );
    expect(
      shiftSentence(scenario({ countThen: 19, neededThen: 8, neededNow: 8 }), 'If it passes')
    ).toBe('If it passes, MINTER has 19 admin seats; the target stays at 8 signatures.');
  });

  it('leads with what passes', () => {
    expect(scenarioLead(scenario())).toBe('If this passes');
    expect(scenarioLead(scenario(), false)).toBe('If it passes');
    const two = [
      { signature: 'a', kind: 'removeAdmin' as const, subject: 'Qa' },
      { signature: 'b', kind: 'removeAdmin' as const, subject: 'Qb' },
    ];
    expect(scenarioLead(scenario({ scope: 'removals', changes: two }))).toBe(
      'If all 2 waiting admin removals pass'
    );
    expect(scenarioLead(scenario({ scope: 'adds', changes: two }))).toBe(
      'If all 2 waiting new admins pass'
    );
    expect(scenarioLead(scenario({ scope: 'all', changes: two }))).toBe(
      'If all 2 waiting admin changes pass'
    );
  });

  it('describes each decision it would change', () => {
    expect(effectLine(effect(), 'Remove from MINTER: Kai Target')).toBe(
      'Remove from MINTER: Kai Target (8 of 9)'
    );
    expect(effectLine(effect({ effect: 'rejected', rejections: 8 }), 'Ban')).toBe(
      'Ban (8 rejections; 8 would end it)'
    );
    expect(
      effectLine(
        effect({
          effect: 'needsMore',
          approvals: 8,
          neededNow: 8,
          neededThen: 9,
          more: 1,
          wasMet: true,
        }),
        'Invite'
      )
    ).toBe('Invite (8 of 8: enough now, 1 short then)');
    expect(
      effectLine(
        effect({ effect: 'needsMore', approvals: 5, neededNow: 8, neededThen: 9, more: 4 }),
        'Invite'
      )
    ).toBe('Invite (5 of 8 now, 5 of 9 then)');
  });

  it('names the admin changes, a proposal not made yet included', () => {
    expect(changeNames([{ signature: 'rm', kind: 'removeAdmin', subject: 'Qx' }], labelOf)).toBe(
      'Remove a Minter Admin: Dex Demote'
    );
    expect(changeNames([{ kind: 'removeAdmin', subject: 'Qx' }], labelOf)).toBe('this proposal');
  });
});

describe('the chip on an affected decision', () => {
  const risk = (over: Partial<DecisionRisk> = {}): DecisionRisk => ({
    effect: effect(),
    scenario: scenario(),
    ...over,
  });

  it('says where the target may go', () => {
    expect(riskChipLabel(risk())).toBe('Target may drop to 8');
    expect(riskChipLabel(risk({ scenario: scenario({ neededNow: 8, neededThen: 9 }) }))).toBe(
      'Target may rise to 9'
    );
  });

  it('explains it: which change, the new target, and what Core would do', () => {
    expect(riskExplanation(risk(), labelOf)).toEqual([
      'If Remove a Minter Admin: Dex Demote passes, MINTER has 20 admin seats and the target drops from 9 to 8 signatures.',
      'This decision has 8 signatures, so Core would apply it at once, in the same block or the next, with no new signature.',
    ]);
    expect(
      riskExplanation(
        risk({
          effect: effect({ effect: 'rejected', rejections: 8 }),
          scenario: scenario({ followOn: ['rm2'], countThen: 19 }),
        }),
        labelOf
      )
    ).toEqual([
      'If Remove a Minter Admin: Dex Demote passes (with Remove a Minter Admin: Admin B, which would then apply at once too), MINTER has 19 admin seats and the target drops from 9 to 8 signatures.',
      'It has 8 rejections, so it would end as rejected at once, in the same block or the next.',
    ]);
    const two = scenario({
      scope: 'removals',
      changes: [
        { signature: 'rm', kind: 'removeAdmin', subject: 'Qx' },
        { signature: 'rm2', kind: 'removeAdmin', subject: 'Qy' },
      ],
    });
    expect(riskExplanation(risk({ scenario: two }), labelOf)[0]).toMatch(
      /^If Remove a Minter Admin: Dex Demote and Remove a Minter Admin: Admin B pass, /
    );
    expect(
      riskExplanation(
        risk({
          effect: effect({ effect: 'needsMore', approvals: 8, more: 1, wasMet: true }),
          scenario: scenario({ neededNow: 8, neededThen: 9, countThen: 21 }),
        }),
        labelOf
      )[1]
    ).toBe(
      'It has 8 signatures: enough today, but if the admin change comes first it needs 1 more.'
    );
  });

  it('says what a withdrawal does and costs', () => {
    expect(withdrawAdvice('0.01 QORT')).toMatch(
      /withdraw your signature before the admin change passes\. A withdrawal counts as a rejection, only each admin’s latest decision counts, and it costs 0\.01 QORT\.$/
    );
    expect(withdrawAdvice('0.01 QORT', 'Core applies it')).toMatch(
      /withdraw your signature before Core applies it\./
    );
  });
});

describe('why the target changed since the last visit', () => {
  const change = (added: boolean) => ({ address: 'Q', added, height: 1 });

  it('counts the approved changes read, and says whether they explain the new count', () => {
    expect(changeReason(23, 21, [change(false), change(false)])).toEqual({
      added: 0,
      removed: 2,
      complete: true,
    });
    expect(changeReason(23, 21, [change(false)])).toMatchObject({ complete: false });
    expect(changeReason(20, 20, [change(true), change(false)])).toEqual({
      added: 1,
      removed: 1,
      complete: true,
    });
    expect(changeReason(20, 21, null)).toEqual({ added: 0, removed: 0, complete: false });
    expect(changeReason(20, 20, [])).toMatchObject({ complete: false });
  });

  it('puts it in words', () => {
    expect(reasonWords({ added: 0, removed: 2, complete: true })).toBe(
      '2 Minter Admins were removed'
    );
    expect(reasonWords({ added: 1, removed: 0, complete: true })).toBe('1 Minter Admin was added');
    expect(reasonWords({ added: 1, removed: 2, complete: true })).toBe(
      '1 Minter Admin was added and 2 were removed'
    );
    expect(seatChange(23, 21)).toBe('MINTER has 2 fewer admin seats (21; it had 23)');
    expect(seatChange(20, 21)).toBe('MINTER has 1 more admin seat (21; it had 20)');
    expect(seatChange(20, 20)).toBe('MINTER still has 20 admin seats');
    expect(targetChangedTitle(9, 7)).toBe('The target changed from 9 to 7 signatures');
    expect(targetChangedTitle(8, 8)).toBe('MINTER’s admin seats changed');
  });
});
