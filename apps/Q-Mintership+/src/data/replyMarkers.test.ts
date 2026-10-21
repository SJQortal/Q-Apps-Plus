import { describe, expect, it } from 'vitest';
import {
  fnv1a64,
  nameMark,
  replyDescription,
  replyDescriptionFor,
  replyMarker,
} from './replyMarkers';

describe('the reply marker', () => {
  it('hashes with FNV-1a 64 (the published test values)', () => {
    expect(fnv1a64('')).toBe('cbf29ce484222325');
    expect(fnv1a64('a')).toBe('af63dc4c8601ec8c');
    expect(fnv1a64('foobar')).toBe('85944171f73967e8');
  });

  it('marks a name whatever its case and spaces around it; any name has the same shape', () => {
    expect(nameMark('  Nora Nominator ')).toBe(nameMark('nora nominator'));
    expect(nameMark('bob+builder')).not.toBe(nameMark('bob builder'));
    for (const name of ['Ünïcode Ñame', 'a~b', 'crowetic⠀', 'x'.repeat(40)])
      expect(replyMarker(name)).toMatch(/^~qmpre[0-9a-f]{16}~$/);
  });

  it('opens the description, so a prefix match finds it', () => {
    expect(replyDescription('Wren Waiting')).toBe(
      `${replyMarker('Wren Waiting')} A reply in Q-Mintership+`
    );
  });

  it('tells nobody about a comment that answers nothing, or one’s own', () => {
    expect(replyDescriptionFor('Nora', null)).toBeUndefined();
    expect(replyDescriptionFor('Nora', ' ')).toBeUndefined();
    expect(replyDescriptionFor('Nora', ' nora ')).toBeUndefined();
    expect(replyDescriptionFor('Nora', 'Wren')).toBe(replyDescription('Wren'));
  });
});
