import { describe, expect, it } from 'vitest';
import type { ApprovalStatus } from '../data/types';
import {
  OUTCOME_LABEL,
  decidedHeight,
  decisionOutcome,
  outcomeSentence,
  signatureRange,
  type DecisionOutcome,
} from './outcome';

const MAX = 10_080;

describe('decisionOutcome', () => {
  it('maps every approval status Core answers with', () => {
    const cases: Array<[ApprovalStatus | undefined, DecisionOutcome]> = [
      ['PENDING', 'pending'],
      [undefined, 'pending'],
      ['APPROVED', 'approved'],
      ['NOT_REQUIRED', 'applied'],
      ['REJECTED', 'rejected'],
      ['EXPIRED', 'expired'],
      ['INVALID', 'invalid'],
    ];
    for (const [status, outcome] of cases)
      expect(decisionOutcome({ approvalStatus: status })).toBe(outcome);
  });
});

describe('decidedHeight', () => {
  it('takes Core’s approvalHeight when it has one', () => {
    expect(
      decidedHeight({ approvalStatus: 'APPROVED', approvalHeight: 120, blockHeight: 100 }, MAX)
    ).toBe(120);
    expect(
      decidedHeight({ approvalStatus: 'REJECTED', approvalHeight: 150, blockHeight: 100 }, MAX)
    ).toBe(150);
    expect(
      decidedHeight({ approvalStatus: 'INVALID', approvalHeight: 130, blockHeight: 100 }, MAX)
    ).toBe(130);
  });

  it('works out an expiry, and a change applied at once, from its own block', () => {
    expect(decidedHeight({ approvalStatus: 'EXPIRED', blockHeight: 100 }, MAX)).toBe(10_181);
    expect(decidedHeight({ approvalStatus: 'NOT_REQUIRED', blockHeight: 100 }, MAX)).toBe(100);
  });

  it('is null while it waits, or when the chain doesn’t say', () => {
    expect(decidedHeight({ approvalStatus: 'PENDING', blockHeight: 100 }, MAX)).toBeNull();
    expect(decidedHeight({ approvalStatus: 'APPROVED', blockHeight: 100 }, MAX)).toBeNull();
    expect(decidedHeight({ approvalStatus: 'EXPIRED' }, MAX)).toBeNull();
  });
});

describe('signatureRange', () => {
  it('reads from just before its block to the block before its decision', () => {
    // Core counts only answers confirmed before the decision block: one that
    // landed in it (or later) didn't count, so it isn't read.
    expect(
      signatureRange(
        { approvalStatus: 'APPROVED', approvalHeight: 900, blockHeight: 100 },
        MAX,
        5e6
      )
    ).toEqual({ start: 90, end: 899 });
    // Expired at h + max + 1: the last signature that could count was in h + max - 1.
    expect(signatureRange({ approvalStatus: 'EXPIRED', blockHeight: 100 }, MAX, 5e6)).toEqual({
      start: 90,
      end: 10_179,
    });
  });

  it('never reads past the tip or one window, and never below block 1', () => {
    expect(signatureRange({ approvalStatus: 'PENDING', blockHeight: 100 }, MAX, 500)).toEqual({
      start: 90,
      end: 500,
    });
    expect(
      signatureRange(
        { approvalStatus: 'APPROVED', approvalHeight: 99_999, blockHeight: 100 },
        MAX,
        5e6
      )
    ).toEqual({ start: 90, end: 10_179 });
    expect(signatureRange({ approvalStatus: 'PENDING', blockHeight: 4 }, MAX, 50)).toEqual({
      start: 1,
      end: 50,
    });
  });

  it('is null for an unconfirmed transaction', () => {
    expect(signatureRange({ approvalStatus: 'PENDING' }, MAX, 500)).toBeNull();
  });
});

describe('outcome words', () => {
  it('has a label and a sentence for every outcome', () => {
    const all: DecisionOutcome[] = [
      'pending',
      'approved',
      'applied',
      'rejected',
      'expired',
      'invalid',
    ];
    for (const outcome of all) {
      expect(OUTCOME_LABEL[outcome]).toMatch(/^[A-Z]/);
      expect(outcomeSentence(outcome, 'kick')).toMatch(/^[A-Z].+\.$/);
    }
  });

  it('tells an expired nomination it can be nominated again', () => {
    expect(outcomeSentence('expired', 'invite')).toMatch(/can be nominated again/);
    expect(outcomeSentence('expired', 'ban')).toMatch(/didn’t happen/);
  });
});
