import { describe, expect, it } from 'vitest';
import { NULL_OWNER } from '../data/constants';
import type { TxRow } from '../data/types';
import { sortDecisions, type Decision, type DecisionKind, type DecisionPhase } from './decision';
import {
  approvedAddFor,
  doubleOf,
  isDouble,
  isRemovalDouble,
  markDoubles,
  type DecisionDouble,
  type DoubleCandidate,
  type DoubleContext,
} from './double';

const ADMIN = 'Q-admin';
const OTHER_ADMIN = 'Q-other-admin';
const MEMBER = 'Q-member';
const ADMINS = [ADMIN, OTHER_ADMIN, NULL_OWNER];

/** A decision as the rule reads it, with the flag markDoubles sets. */
type Candidate = DoubleCandidate & { double?: DecisionDouble | null };

let n = 0;
function decision(
  kind: DecisionKind,
  subject: string | null,
  fields: Partial<Candidate> = {}
): Candidate {
  n += 1;
  return {
    signature: `sig-${n}`,
    kind,
    subject,
    blockHeight: 1_000 + n,
    createdAt: 1_000_000 + n,
    phase: 'open',
    unusualRoute: false,
    ...fields,
  };
}

function ctx(decisions: DoubleCandidate[], extra: Partial<DoubleContext> = {}): DoubleContext {
  return { decisions, admins: ADMINS, ...extra };
}

describe('doubleOf: an addition of someone who is a Minter Admin already', () => {
  it('is in effect already, whoever proposed it', () => {
    const add = decision('addAdmin', ADMIN);
    expect(doubleOf(add, ctx([add]))).toEqual({ reason: 'alreadyInEffect' });
  });

  it('points to the approved addition that made them one, when it is known', () => {
    const add = decision('addAdmin', ADMIN);
    const approvedAdds = new Map([[ADMIN, 'approved-sig']]);
    expect(doubleOf(add, ctx([add], { approvedAdds }))).toEqual({
      reason: 'alreadyInEffect',
      otherSignature: 'approved-sig',
    });
    // Known for someone else only: no link.
    const elsewhere = new Map([[OTHER_ADMIN, 'approved-sig']]);
    expect(doubleOf(add, ctx([add], { approvedAdds: elsewhere }))).toEqual({
      reason: 'alreadyInEffect',
    });
    // Never a link to itself.
    const self = new Map([[ADMIN, add.signature]]);
    expect(doubleOf(add, ctx([add], { approvedAdds: self }))).toEqual({
      reason: 'alreadyInEffect',
    });
  });

  it('reads the admin rows as a list or a set', () => {
    const add = decision('addAdmin', ADMIN);
    expect(doubleOf(add, ctx([add], { admins: new Set(ADMINS) }))?.reason).toBe('alreadyInEffect');
    expect(doubleOf(add, ctx([add], { admins: [] }))).toBeNull();
  });

  it('marks every waiting copy of it, the first one too', () => {
    const first = decision('addAdmin', ADMIN);
    const second = decision('addAdmin', ADMIN);
    expect(doubleOf(first, ctx([first, second]))?.reason).toBe('alreadyInEffect');
    expect(doubleOf(second, ctx([first, second]))?.reason).toBe('alreadyInEffect');
  });
});

describe('doubleOf: a removal of someone who isn’t a Minter Admin', () => {
  it('is in effect already', () => {
    const remove = decision('removeAdmin', MEMBER);
    expect(doubleOf(remove, ctx([remove]))).toEqual({ reason: 'alreadyInEffect' });
  });

  it('never links to anything (only an addition does)', () => {
    const remove = decision('removeAdmin', MEMBER);
    const approvedAdds = new Map([[MEMBER, 'approved-sig']]);
    expect(doubleOf(remove, ctx([remove], { approvedAdds }))).toEqual({
      reason: 'alreadyInEffect',
    });
  });

  it('is no double while they are a Minter Admin', () => {
    const remove = decision('removeAdmin', ADMIN);
    expect(doubleOf(remove, ctx([remove]))).toBeNull();
  });
});

describe('doubleOf: the same change waiting more than once', () => {
  it('makes the newer one the double of the older one, by block', () => {
    const older = decision('addAdmin', MEMBER, { blockHeight: 500 });
    const newer = decision('addAdmin', MEMBER, { blockHeight: 900 });
    const all = [newer, older];
    expect(doubleOf(older, ctx(all))).toBeNull();
    expect(doubleOf(newer, ctx(all))).toEqual({
      reason: 'duplicate',
      otherSignature: older.signature,
    });
  });

  it('works for removals of a Minter Admin too', () => {
    const older = decision('removeAdmin', OTHER_ADMIN, { blockHeight: 500 });
    const newer = decision('removeAdmin', OTHER_ADMIN, { blockHeight: 600 });
    expect(doubleOf(older, ctx([older, newer]))).toBeNull();
    expect(doubleOf(newer, ctx([older, newer]))?.otherSignature).toBe(older.signature);
  });

  it('breaks a tie in the same block by time, then by signature', () => {
    const early = decision('addAdmin', MEMBER, { blockHeight: 700, createdAt: 10 });
    const late = decision('addAdmin', MEMBER, { blockHeight: 700, createdAt: 20 });
    expect(doubleOf(late, ctx([late, early]))?.otherSignature).toBe(early.signature);
    expect(doubleOf(early, ctx([late, early]))).toBeNull();
    const a = decision('addAdmin', MEMBER, { signature: 'a', blockHeight: 700, createdAt: 5 });
    const b = decision('addAdmin', MEMBER, { signature: 'b', blockHeight: 700, createdAt: 5 });
    expect(doubleOf(b, ctx([a, b]))?.otherSignature).toBe('a');
    expect(doubleOf(a, ctx([a, b]))).toBeNull();
  });

  it('takes one still unconfirmed as the newest', () => {
    const confirmed = decision('addAdmin', MEMBER, { blockHeight: 900, createdAt: 50 });
    const unconfirmed = decision('addAdmin', MEMBER, {
      blockHeight: null,
      createdAt: 10,
      phase: 'unconfirmed',
    });
    expect(doubleOf(confirmed, ctx([confirmed, unconfirmed]))).toBeNull();
    expect(doubleOf(unconfirmed, ctx([confirmed, unconfirmed]))?.otherSignature).toBe(
      confirmed.signature
    );
    // Two unconfirmed: by time.
    const later = decision('addAdmin', MEMBER, {
      blockHeight: null,
      createdAt: 20,
      phase: 'unconfirmed',
    });
    expect(doubleOf(later, ctx([unconfirmed, later]))?.otherSignature).toBe(unconfirmed.signature);
  });

  it('points every later copy to the oldest one', () => {
    const first = decision('addAdmin', MEMBER, { blockHeight: 100 });
    const second = decision('addAdmin', MEMBER, { blockHeight: 200 });
    const third = decision('addAdmin', MEMBER, { blockHeight: 300 });
    const all = [third, second, first];
    expect(doubleOf(first, ctx(all))).toBeNull();
    expect(doubleOf(second, ctx(all))?.otherSignature).toBe(first.signature);
    expect(doubleOf(third, ctx(all))?.otherSignature).toBe(first.signature);
  });

  it('counts an earlier copy only while it can still pass', () => {
    const blocked: DecisionPhase[] = ['expired', 'tooLate', 'rejectedMet'];
    for (const phase of blocked) {
      const older = decision('addAdmin', MEMBER, { blockHeight: 100, phase });
      const newer = decision('addAdmin', MEMBER, { blockHeight: 200 });
      expect(doubleOf(newer, ctx([older, newer])), phase).toBeNull();
    }
    const passing: DecisionPhase[] = ['open', 'early', 'thresholdMet'];
    for (const phase of passing) {
      const older = decision('addAdmin', MEMBER, { blockHeight: 100, phase });
      const newer = decision('addAdmin', MEMBER, { blockHeight: 200 });
      expect(doubleOf(newer, ctx([older, newer]))?.reason, phase).toBe('duplicate');
    }
  });

  it('leaves out anything on an unusual approval route', () => {
    const unusual = decision('addAdmin', MEMBER, { blockHeight: 100, unusualRoute: true });
    const newer = decision('addAdmin', MEMBER, { blockHeight: 200 });
    expect(doubleOf(newer, ctx([unusual, newer]))).toBeNull();
    const adminAdd = decision('addAdmin', ADMIN, { unusualRoute: true });
    expect(doubleOf(adminAdd, ctx([adminAdd]))).toBeNull();
  });

  it('needs the same kind and the same person', () => {
    const add = decision('addAdmin', MEMBER, { blockHeight: 100 });
    const otherPerson = decision('addAdmin', 'Q-someone-else', { blockHeight: 200 });
    expect(doubleOf(otherPerson, ctx([add, otherPerson]))).toBeNull();
    // An addition and a removal about one Minter Admin: only the addition is a double.
    const remove = decision('removeAdmin', OTHER_ADMIN, { blockHeight: 100 });
    const addBack = decision('addAdmin', OTHER_ADMIN, { blockHeight: 200 });
    expect(doubleOf(remove, ctx([remove, addBack]))).toBeNull();
    expect(doubleOf(addBack, ctx([remove, addBack]))?.reason).toBe('alreadyInEffect');
  });
});

describe('doubleOf: what is never a double', () => {
  it('a decision Core doesn’t name a subject for', () => {
    const a = decision('addAdmin', null);
    const b = decision('removeAdmin', null);
    expect(doubleOf(a, ctx([a, b]))).toBeNull();
    expect(doubleOf(b, ctx([a, b]))).toBeNull();
  });

  it('an addition of someone who isn’t a Minter Admin, on its own', () => {
    const add = decision('addAdmin', MEMBER);
    expect(doubleOf(add, ctx([add]))).toBeNull();
  });

  it('one that has expired', () => {
    const add = decision('addAdmin', ADMIN, { phase: 'expired' });
    const remove = decision('removeAdmin', MEMBER, { phase: 'expired' });
    expect(doubleOf(add, ctx([add]))).toBeNull();
    expect(doubleOf(remove, ctx([remove]))).toBeNull();
  });

  it('one Core has decided already, whatever its phase says', () => {
    for (const approvalStatus of ['APPROVED', 'REJECTED', 'EXPIRED', 'INVALID'] as const) {
      const add = decision('addAdmin', ADMIN, { tx: { approvalStatus } });
      const remove = decision('removeAdmin', MEMBER, { tx: { approvalStatus } });
      expect(doubleOf(add, ctx([add])), approvalStatus).toBeNull();
      expect(doubleOf(remove, ctx([remove])), approvalStatus).toBeNull();
      // A decided copy is no earlier one either.
      const older = decision('addAdmin', MEMBER, { blockHeight: 100, tx: { approvalStatus } });
      const newer = decision('addAdmin', MEMBER, { blockHeight: 200 });
      expect(doubleOf(newer, ctx([older, newer])), approvalStatus).toBeNull();
    }
    const pending = decision('addAdmin', ADMIN, { tx: { approvalStatus: 'PENDING' } });
    expect(doubleOf(pending, ctx([pending]))?.reason).toBe('alreadyInEffect');
  });

  it('anything but an admin change, even waiting twice', () => {
    const kinds: DecisionKind[] = ['invite', 'cancelInvite', 'kick', 'ban', 'cancelBan', 'other'];
    for (const kind of kinds) {
      const older = decision(kind, MEMBER, { blockHeight: 100 });
      const newer = decision(kind, MEMBER, { blockHeight: 200 });
      expect(doubleOf(newer, ctx([older, newer])), kind).toBeNull();
      const aboutAdmin = decision(kind, ADMIN);
      expect(doubleOf(aboutAdmin, ctx([aboutAdmin])), kind).toBeNull();
    }
  });
});

describe('doubleOf: a double while it waits, whatever its phase', () => {
  it('with enough signatures or rejections, too late to sign, early or on its way', () => {
    const phases: DecisionPhase[] = [
      'thresholdMet',
      'rejectedMet',
      'tooLate',
      'unconfirmed',
      'early',
    ];
    for (const phase of phases) {
      const add = decision('addAdmin', ADMIN, { phase });
      const remove = decision('removeAdmin', MEMBER, { phase });
      expect(doubleOf(add, ctx([add]))?.reason, phase).toBe('alreadyInEffect');
      expect(doubleOf(remove, ctx([remove]))?.reason, phase).toBe('alreadyInEffect');
    }
  });
});

describe('doubleOf: MINTER’s null owner', () => {
  it('is an admin row: adding it is in effect already, removing it is no double', () => {
    const add = decision('addAdmin', NULL_OWNER);
    const remove = decision('removeAdmin', NULL_OWNER);
    expect(doubleOf(add, ctx([add]))).toEqual({ reason: 'alreadyInEffect' });
    expect(doubleOf(remove, ctx([remove]))).toBeNull();
  });

  it('a second removal of it is a double of the first', () => {
    const first = decision('removeAdmin', NULL_OWNER, { blockHeight: 100 });
    const second = decision('removeAdmin', NULL_OWNER, { blockHeight: 200 });
    expect(doubleOf(second, ctx([first, second]))).toEqual({
      reason: 'duplicate',
      otherSignature: first.signature,
    });
  });
});

describe('markDoubles and isDouble', () => {
  it('sets `double` on the doubles and returns the others as they are', () => {
    const real = decision('addAdmin', MEMBER, { blockHeight: 100 });
    const copy = decision('addAdmin', MEMBER, { blockHeight: 200 });
    const already = decision('addAdmin', ADMIN);
    const invite = decision('invite', MEMBER);
    const marked = markDoubles([real, copy, already, invite], { admins: ADMINS });
    expect(marked[0]).toBe(real);
    expect(marked[3]).toBe(invite);
    expect(marked[1].double).toEqual({ reason: 'duplicate', otherSignature: real.signature });
    expect(marked[2].double).toEqual({ reason: 'alreadyInEffect' });
    expect(marked.map(isDouble)).toEqual([false, true, true, false]);
    // The input is left alone.
    expect(copy.double).toBeUndefined();
  });

  it('clears a flag that no longer holds', () => {
    const outdated = {
      ...decision('addAdmin', MEMBER),
      double: { reason: 'alreadyInEffect' as const },
    };
    const [after] = markDoubles([outdated], { admins: ADMINS });
    expect(after.double).toBeNull();
    expect(isDouble(after)).toBe(false);
  });
});

describe('approvedAddFor', () => {
  const row = (fields: Partial<TxRow>): TxRow => ({
    type: 'ADD_GROUP_ADMIN',
    timestamp: 1,
    signature: `row-${fields.approvalHeight ?? fields.blockHeight ?? 0}`,
    txGroupId: 694,
    groupId: 694,
    member: ADMIN,
    approvalStatus: 'APPROVED',
    ...fields,
  });

  it('finds the newest approved MINTER addition about the person', () => {
    const rows = [
      row({ signature: 'old', blockHeight: 100, approvalHeight: 200 }),
      row({ signature: 'new', blockHeight: 300, approvalHeight: 400 }),
      row({ signature: 'pending', blockHeight: 500, approvalStatus: 'PENDING' }),
      row({ signature: 'rejected', blockHeight: 600, approvalStatus: 'REJECTED' }),
      row({ signature: 'other-group', blockHeight: 700, approvalHeight: 800, groupId: 4242 }),
      row({ signature: 'other-person', blockHeight: 700, approvalHeight: 800, member: MEMBER }),
      row({ signature: 'removal', type: 'REMOVE_GROUP_ADMIN', approvalHeight: 900, admin: ADMIN }),
    ];
    expect(approvedAddFor(rows, ADMIN)).toBe('new');
  });

  it('falls back to the block, then nothing', () => {
    expect(approvedAddFor([row({ signature: 'by-block', blockHeight: 50 })], ADMIN)).toBe(
      'by-block'
    );
    expect(approvedAddFor([], ADMIN)).toBeNull();
    expect(approvedAddFor([row({ approvalStatus: 'EXPIRED', blockHeight: 1 })], ADMIN)).toBeNull();
  });
});

describe('sortDecisions with doubles', () => {
  /** A decision as the queue holds it, enough for sorting. */
  const queued = (signature: string, expiresAtHeight: number, double: boolean): Decision =>
    ({
      signature,
      phase: 'open',
      createdAt: 1,
      window: { expiresAtHeight },
      double: double ? { reason: 'alreadyInEffect' } : null,
    }) as unknown as Decision;

  it('puts doubles after every other decision, each part most urgent first', () => {
    const sorted = sortDecisions([
      queued('double-soon', 100, true),
      queued('real-late', 900, false),
      queued('double-late', 800, true),
      queued('real-soon', 200, false),
    ]);
    expect(sorted.map((d) => d.signature)).toEqual([
      'real-soon',
      'real-late',
      'double-soon',
      'double-late',
    ]);
  });
});

describe('isRemovalDouble', () => {
  it('is true only for a removal marked as a double', () => {
    const double = { reason: 'alreadyInEffect' as const };
    expect(isRemovalDouble({ kind: 'removeAdmin', double })).toBe(true);
    expect(isRemovalDouble({ kind: 'removeAdmin', double: { reason: 'duplicate', otherSignature: 'x' } })).toBe(true);
    expect(isRemovalDouble({ kind: 'removeAdmin', double: null })).toBe(false);
    expect(isRemovalDouble({ kind: 'removeAdmin' })).toBe(false);
    expect(isRemovalDouble({ kind: 'addAdmin', double })).toBe(false);
  });
});
