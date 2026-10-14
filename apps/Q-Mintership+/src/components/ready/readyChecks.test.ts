/** The line under the self-check: what's still needed before Continue, in plain words. */
import { describe, expect, it } from 'vitest';
import { readyHint, type ReadyTicks } from './readyChecks';

const ALL: ReadyTicks = { node: true, key: true, final: true };

describe('readyHint', () => {
  it('counts the boxes still to tick, and says which once Continue was pressed', () => {
    const base = { balance: 1, feeQort: 0.01 };
    expect(readyHint({ ...base, ticks: {}, attempted: false })).toBe(
      'Tick all 3 boxes to continue.'
    );
    expect(readyHint({ ...base, ticks: { node: true }, attempted: false })).toBe(
      'Tick 2 more boxes to continue.'
    );
    expect(readyHint({ ...base, ticks: { node: true, key: true }, attempted: true })).toBe(
      "Can't continue yet: tick 1 more box above."
    );
    expect(readyHint({ ...base, ticks: ALL, attempted: false })).toBe(
      'Ready. Next, Hub asks you to confirm.'
    );
  });

  it('puts a balance below the fee first', () => {
    expect(readyHint({ ticks: ALL, balance: 0, feeQort: 0.01, attempted: true })).toBe(
      'Continue opens once your confirmed balance covers the 0.01 QORT fee.'
    );
  });

  it("doesn't say Ready while the balance is still being read", () => {
    const checking = { balance: undefined, feeQort: 0.01, attempted: false, checking: true };
    expect(readyHint({ ...checking, ticks: ALL })).toBe(
      'Checking your balance for the 0.01 QORT fee…'
    );
    // The boxes still come first.
    expect(readyHint({ ...checking, ticks: { node: true } })).toBe(
      'Tick 2 more boxes to continue.'
    );
    // A balance that couldn't be read: Continue opens, and it is checked again before Hub.
    expect(readyHint({ ...checking, ticks: ALL, checking: false })).toBe(
      'Ready. Next, Hub asks you to confirm.'
    );
  });
});
