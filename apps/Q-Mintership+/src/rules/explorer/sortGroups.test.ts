import { describe, expect, it } from 'vitest';
import type { GroupOf } from '../../data/explorer/account';
import { GROUP_SORTS, isGroupSort, sortGroups } from './sortGroups';

const ME = 'Qme';
const groups: GroupOf[] = [
  { groupId: 5, groupName: 'beta', memberCount: 40, created: 300 },
  { groupId: 694, groupName: 'MINTER', memberCount: 630, created: 100, isAdmin: true },
  { groupId: 7, groupName: 'Alpha', memberCount: 2, owner: ME, isAdmin: true, created: 500 },
  { groupId: 9, groupName: 'gamma' },
  { groupId: 3, groupName: 'Delta', memberCount: 40, isAdmin: true, created: 200 },
];
const order = (sort: Parameters<typeof sortGroups>[1]) =>
  sortGroups(groups, sort, ME, 694).map((g) => g.groupName);

describe('sortGroups', () => {
  it('MINTER first, then Core’s order', () => {
    expect(order('minter')).toEqual(['MINTER', 'beta', 'Alpha', 'gamma', 'Delta']);
  });

  it('by name, ignoring case', () => {
    expect(order('az')).toEqual(['Alpha', 'beta', 'Delta', 'gamma', 'MINTER']);
    expect(order('za')).toEqual(['MINTER', 'gamma', 'Delta', 'beta', 'Alpha']);
  });

  it('by members, ties by name, an unknown count last', () => {
    expect(order('members')).toEqual(['MINTER', 'beta', 'Delta', 'Alpha', 'gamma']);
    expect(order('fewest')).toEqual(['Alpha', 'beta', 'Delta', 'MINTER', 'gamma']);
  });

  it('its own groups first: owner, then admin, then the rest, each by name', () => {
    expect(order('roles')).toEqual(['Alpha', 'Delta', 'MINTER', 'beta', 'gamma']);
  });

  it('by when the group was made, an unknown date last', () => {
    expect(order('newest')).toEqual(['Alpha', 'beta', 'Delta', 'MINTER', 'gamma']);
    expect(order('oldest')).toEqual(['MINTER', 'Delta', 'beta', 'Alpha', 'gamma']);
  });

  it('knows its own sorts, and leaves the list it was given alone', () => {
    expect(GROUP_SORTS.every((option) => isGroupSort(option.value))).toBe(true);
    expect(isGroupSort('size')).toBe(false);
    const copy = [...groups];
    sortGroups(groups, 'az', ME, 694);
    expect(groups).toEqual(copy);
  });
});
