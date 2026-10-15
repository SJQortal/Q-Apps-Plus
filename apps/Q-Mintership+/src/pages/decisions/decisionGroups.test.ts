import { describe, expect, it } from 'vitest';
import { decisionGroup, groupDecisions } from './decisionGroups';
import type { Decision } from '../../rules/decision';

type Kind = Decision['kind'];
const d = (kind: Kind, decline?: boolean, id: string = kind) => ({ kind, decline, id });

describe('decisions by type', () => {
  it('puts each kind in its group, a declined join request apart from removals', () => {
    expect(decisionGroup(d('invite'))).toBe('invite');
    expect(decisionGroup(d('kick'))).toBe('removal');
    expect(decisionGroup(d('ban'))).toBe('removal');
    expect(decisionGroup(d('kick', true))).toBe('decline');
    expect(decisionGroup(d('cancelBan'))).toBe('liftBan');
    expect(decisionGroup(d('cancelInvite'))).toBe('cancelInvite');
    expect(decisionGroup(d('addAdmin'))).toBe('admins');
    expect(decisionGroup(d('removeAdmin'))).toBe('admins');
    expect(decisionGroup(d('other'))).toBe('other');
  });

  it('lists only the groups that have decisions, new minters first, each in the queue’s order', () => {
    const queue = [
      d('cancelInvite', undefined, 'c1'),
      d('invite', undefined, 'i1'),
      d('ban', undefined, 'b1'),
      d('invite', undefined, 'i2'),
      d('kick', undefined, 'k1'),
      d('cancelInvite', undefined, 'c2'),
    ];
    expect(groupDecisions(queue).map((g) => [g.label, g.decisions.map((x) => x.id)])).toEqual([
      ['Add to MINTER', ['i1', 'i2']],
      ['Remove or ban', ['b1', 'k1']],
      ['Cancel an approved invite', ['c1', 'c2']],
    ]);
    expect(groupDecisions([])).toEqual([]);
  });
});
