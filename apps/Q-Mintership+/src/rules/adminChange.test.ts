import { describe, expect, it } from 'vitest';
import {
  ADMIN_CHANGE_TITLE,
  OWN_ADMIN_ROLE_LEAD,
  adminChangeBlock,
  adminChangeBlockText,
  adminChangeMode,
  chainsOwnSignature,
  ownAdminRole,
  type AdminChangeBlock,
  type AdminChangeFacts,
  type AdminChangeKind,
} from './adminChange';

const facts = (over: Partial<AdminChangeFacts>): AdminChangeFacts => ({
  kind: 'addAdmin',
  self: false,
  proposerIsAdmin: true,
  subjectIsMember: true,
  subjectIsAdmin: false,
  subjectIsOwner: false,
  waiting: false,
  ...over,
});

describe('adminChangeMode and titles', () => {
  it('names each of the four proposals', () => {
    expect(adminChangeMode('addAdmin', true)).toBe('become');
    expect(adminChangeMode('addAdmin', false)).toBe('promote');
    expect(adminChangeMode('removeAdmin', true)).toBe('stepDown');
    expect(adminChangeMode('removeAdmin', false)).toBe('remove');
    expect(ADMIN_CHANGE_TITLE).toEqual({
      become: 'Become a Minter Admin',
      promote: 'Make a Minter Admin',
      stepDown: 'Step down as Minter Admin',
      remove: 'Remove a Minter Admin',
    });
  });
});

describe('adminChangeBlock: adding a Minter Admin', () => {
  it('lets any MINTER member propose themselves', () => {
    expect(adminChangeBlock(facts({ self: true, proposerIsAdmin: false }))).toBeNull();
  });

  it('lets a Minter Admin propose another member', () => {
    expect(adminChangeBlock(facts({ proposerIsAdmin: true }))).toBeNull();
  });

  it('keeps members from proposing anyone but themselves', () => {
    expect(adminChangeBlock(facts({ proposerIsAdmin: false }))).toBe('adminsOnly');
  });

  it('needs the account to be a MINTER member, and not an admin already', () => {
    expect(adminChangeBlock(facts({ subjectIsMember: false }))).toBe('notMember');
    expect(
      adminChangeBlock(facts({ self: true, proposerIsAdmin: false, subjectIsMember: false }))
    ).toBe('notMember');
    expect(adminChangeBlock(facts({ subjectIsAdmin: true }))).toBe('alreadyAdmin');
    expect(
      adminChangeBlock(facts({ self: true, proposerIsAdmin: true, subjectIsAdmin: true }))
    ).toBe('alreadyAdmin');
  });

  it('stops a second proposal while one is waiting', () => {
    expect(adminChangeBlock(facts({ waiting: true }))).toBe('waiting');
    expect(adminChangeBlock(facts({ self: true, proposerIsAdmin: false, waiting: true }))).toBe(
      'waiting'
    );
  });
});

describe('adminChangeBlock: removing a Minter Admin', () => {
  const remove = (over: Partial<AdminChangeFacts>) =>
    facts({ kind: 'removeAdmin', subjectIsAdmin: true, ...over });

  it('lets a Minter Admin propose removing another admin, or step down', () => {
    expect(adminChangeBlock(remove({}))).toBeNull();
    expect(adminChangeBlock(remove({ self: true }))).toBeNull();
  });

  it('keeps members who are not admins out, also from their own role', () => {
    expect(adminChangeBlock(remove({ proposerIsAdmin: false }))).toBe('adminsOnly');
    expect(
      adminChangeBlock(remove({ self: true, proposerIsAdmin: false, subjectIsAdmin: false }))
    ).toBe('adminsOnly');
  });

  it("never MINTER's owner account, whoever asks", () => {
    expect(adminChangeBlock(remove({ subjectIsOwner: true }))).toBe('owner');
    expect(adminChangeBlock(remove({ subjectIsOwner: true, proposerIsAdmin: false }))).toBe(
      'owner'
    );
  });

  it('needs the account to be an admin, and no removal already waiting', () => {
    expect(adminChangeBlock(remove({ subjectIsAdmin: false }))).toBe('notAdmin');
    expect(adminChangeBlock(remove({ waiting: true }))).toBe('waiting');
    expect(adminChangeBlock(remove({ self: true, waiting: true }))).toBe('waiting');
  });
});

describe('adminChangeBlockText', () => {
  it('has words for every block, kind and side', () => {
    const blocks: AdminChangeBlock[] = [
      'owner',
      'adminsOnly',
      'notMember',
      'alreadyAdmin',
      'notAdmin',
      'waiting',
    ];
    const kinds: AdminChangeKind[] = ['addAdmin', 'removeAdmin'];
    for (const block of blocks)
      for (const kind of kinds)
        for (const self of [true, false])
          expect(adminChangeBlockText(block, kind, self)).toMatch(/^[A-Z].+\.$/);
  });

  it('speaks to the person about their own role', () => {
    expect(adminChangeBlockText('alreadyAdmin', 'addAdmin', true)).toBe(
      'You’re already a Minter Admin.'
    );
    expect(adminChangeBlockText('waiting', 'addAdmin', true)).toBe(
      'Your proposal to become a Minter Admin is already waiting for signatures.'
    );
    expect(adminChangeBlockText('waiting', 'removeAdmin', true)).toBe(
      'Your step-down is already waiting for signatures.'
    );
    expect(adminChangeBlockText('adminsOnly', 'removeAdmin', true)).toBe(
      'You’re not a Minter Admin right now.'
    );
  });

  it('points a member who picked someone else to their own proposal', () => {
    expect(adminChangeBlockText('adminsOnly', 'addAdmin', false)).toMatch(
      /Any member can propose themselves with Become a Minter Admin/
    );
    expect(adminChangeBlockText('adminsOnly', 'removeAdmin', false)).toMatch(/Only Minter Admins/);
  });
});

describe('ownAdminRole', () => {
  it('offers members Become, admins Step down, and anyone else nothing', () => {
    expect(ownAdminRole({ isMember: true, isAdmin: false })).toBe('become');
    expect(ownAdminRole({ isMember: true, isAdmin: true })).toBe('stepDown');
    expect(ownAdminRole({ isMember: false, isAdmin: false })).toBeNull();
    expect(OWN_ADMIN_ROLE_LEAD.stepDown).toMatch(/step down/);
  });
});

describe('chainsOwnSignature', () => {
  it('adds the proposer’s signature only for a Minter Admin, who can sign', () => {
    expect(chainsOwnSignature(true)).toBe(true);
    expect(chainsOwnSignature(false)).toBe(false);
  });
});
