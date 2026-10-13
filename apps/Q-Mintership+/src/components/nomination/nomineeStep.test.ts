import { describe, expect, it } from 'vitest';
import { nomineeStep, type NomineeStepInput } from './nomineeStep';

const base: NomineeStepInput = {
  isMember: false,
  activeBan: false,
  hasJoinRequest: false,
  storedInvite: false,
  state: 'waiting',
};

describe("the nominee's next step", () => {
  it('is Accept while the nomination waits or collects signatures', () => {
    expect(nomineeStep(base)).toBe('accept');
    expect(nomineeStep({ ...base, state: 'signing' })).toBe('accept');
  });

  it('is done once a join request is open', () => {
    expect(nomineeStep({ ...base, hasJoinRequest: true })).toBe('ready');
    expect(nomineeStep({ ...base, state: 'signing', hasJoinRequest: true })).toBe('ready');
  });

  it('is Join once approved, with or without a nomination record', () => {
    expect(nomineeStep({ ...base, state: 'approved' })).toBe('join');
    expect(nomineeStep({ ...base, state: null, storedInvite: true })).toBe('join');
  });

  it('is nothing for members, banned accounts, or without an open nomination', () => {
    expect(nomineeStep({ ...base, isMember: true, storedInvite: true })).toBeNull();
    expect(nomineeStep({ ...base, activeBan: true, state: 'blocked' })).toBeNull();
    expect(nomineeStep({ ...base, state: null })).toBeNull();
    expect(nomineeStep({ ...base, state: 'expired' })).toBeNull();
  });
});
