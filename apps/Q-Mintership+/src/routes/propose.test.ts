/**
 * The + Propose pages' addresses (Simon, 2026-10-18: each choice a page of
 * its own): one slug per kind, back and forth, `?who=` to start with someone.
 */
import { describe, expect, it } from 'vitest';
import { PROPOSE_ORDER } from '../pages/decisions/proposeKinds';
import { PROPOSE_SLUGS, proposeKindOf, proposePath } from './paths';

describe('proposePath', () => {
  it('gives each kind its page, and reads it back', () => {
    expect(PROPOSE_ORDER.map((kind) => proposePath(kind))).toEqual([
      '/propose/remove-member',
      '/propose/decline-join-request',
      '/propose/ban',
      '/propose/make-minter-admin',
      '/propose/remove-minter-admin',
      '/propose/lift-ban',
      '/propose/cancel-invite',
    ]);
    for (const kind of PROPOSE_ORDER) expect(proposeKindOf(PROPOSE_SLUGS[kind])).toBe(kind);
    expect(proposeKindOf('ask-minter-admins')).toBeNull();
    expect(proposeKindOf(undefined)).toBeNull();
  });

  it('starts with someone from ?who=', () => {
    expect(proposePath('cancelBan', 'QAbc')).toBe('/propose/lift-ban?who=QAbc');
  });
});
