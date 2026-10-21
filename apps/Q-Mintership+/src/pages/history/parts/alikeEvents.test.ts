import { describe, expect, it } from 'vitest';
import type { TimelineEvent } from '../../../data/timeline';
import { alikeEvents, firstAlikeLines } from './alikeEvents';

const day = Date.UTC(2025, 0, 22, 12);
let n = 0;
const event = (fields: Partial<TimelineEvent>): TimelineEvent =>
  ({
    signature: `e${n++}`,
    kind: 'addAdmin',
    title: 'Made a Minter Admin',
    outcome: 'done',
    at: day,
    proposedAt: day,
    subject: `Q${n}`,
    ...fields,
  }) as TimelineEvent;

describe('MINTER events of one kind, the same day', () => {
  it('runs them together, apart from another kind, outcome or day', () => {
    const runs = alikeEvents([
      event({}),
      event({}),
      event({}),
      event({ outcome: 'expired' }),
      event({ at: day - 3 * 86_400_000 }),
      event({ kind: 'kick', title: 'Removed from MINTER' }),
    ]);
    expect(runs.map((r) => r.length)).toEqual([3, 1, 1, 1]);
  });

  it('shows the first lines whole', () => {
    const events = [
      event({}),
      event({}),
      event({ kind: 'kick', title: 'Removed' }),
      event({ title: 'X' }),
    ];
    expect(firstAlikeLines(events, 2)).toHaveLength(3);
  });
});
