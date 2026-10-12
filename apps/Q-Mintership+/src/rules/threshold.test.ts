import { describe, expect, it } from 'vitest';
import {
  APPROVAL_THRESHOLDS,
  approvalsNeeded,
  describeThreshold,
  isApprovalThreshold,
  meetsThreshold,
  thresholdPercent,
} from './threshold';

describe('meetsThreshold (Core Group.ApprovalThreshold.meetsTheshold)', () => {
  it('MINTER today: PCT40 with 20 admin rows (null owner included) needs 8', () => {
    expect(meetsThreshold('PCT40', 7, 20)).toBe(false);
    expect(meetsThreshold('PCT40', 8, 20)).toBe(true);
    expect(approvalsNeeded('PCT40', 20)).toBe(8);
  });

  it('uses integer maths: approvals*100 >= totalAdmins*pct', () => {
    // 21 admins (as until block 2740684): 8*100=800 < 840, 9*100=900 >= 840.
    expect(meetsThreshold('PCT40', 8, 21)).toBe(false);
    expect(meetsThreshold('PCT40', 9, 21)).toBe(true);
    expect(approvalsNeeded('PCT40', 21)).toBe(9);
    // 17 admins (blocks 2741835–2749086): 7 were enough.
    expect(approvalsNeeded('PCT40', 17)).toBe(7);
    expect(meetsThreshold('PCT40', 7, 17)).toBe(true);
    expect(meetsThreshold('PCT40', 6, 17)).toBe(false);
  });

  it('matches the research table for 20 admins', () => {
    expect(approvalsNeeded('NONE', 20)).toBe(0);
    expect(approvalsNeeded('ONE', 20)).toBe(1);
    expect(approvalsNeeded('PCT20', 20)).toBe(4);
    expect(approvalsNeeded('PCT60', 20)).toBe(12);
    expect(approvalsNeeded('PCT80', 20)).toBe(16);
    expect(approvalsNeeded('PCT100', 20)).toBe(20);
  });

  it('NONE is always met and ONE needs one approval', () => {
    expect(meetsThreshold('NONE', 0, 20)).toBe(true);
    expect(meetsThreshold('ONE', 0, 20)).toBe(false);
    expect(meetsThreshold('ONE', 1, 20)).toBe(true);
  });

  it('approvalsNeeded is always the smallest count that meets the threshold', () => {
    for (const threshold of APPROVAL_THRESHOLDS) {
      for (let admins = 0; admins <= 60; admins++) {
        const needed = approvalsNeeded(threshold, admins);
        expect(meetsThreshold(threshold, needed, admins)).toBe(true);
        if (needed > 0) expect(meetsThreshold(threshold, needed - 1, admins)).toBe(false);
      }
    }
  });

  it('describes thresholds for people', () => {
    expect(isApprovalThreshold('PCT40')).toBe(true);
    expect(isApprovalThreshold('PCT50')).toBe(false);
    expect(thresholdPercent('PCT40')).toBe(40);
    expect(thresholdPercent('ONE')).toBeNull();
    expect(describeThreshold('PCT40')).toBe('40% of admins');
    expect(describeThreshold('ONE')).toBe('one admin');
  });
});
