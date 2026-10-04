import { beforeEach, describe, expect, it } from 'vitest'
import { fetchedUrls, mockFetchRoute, mockQortalAction, qortalCalls } from '../test/setup'
import {
  GROUP_MEMBERS_PAGE_SIZE,
  getGroupMemberAddresses,
  getGroupMembers,
  getGroupPublicKeys,
  peekGroupMemberCount,
  groupMembersStats,
  invalidateGroupMembers,
  memberNames,
  peekGroupMembers,
  resetGroupMembersCache,
  toMembersByName,
} from './groupMembersCache'

const address = (i: number) => `Q${String(i).padStart(33, '0')}`

function mockMemberPages(groupId: string, total: number) {
  const members = Array.from({ length: total }, (_, i) => ({ member: address(i), isAdmin: i === 0 }))
  for (let offset = 0; offset <= total; offset += GROUP_MEMBERS_PAGE_SIZE) {
    const page = members.slice(offset, offset + GROUP_MEMBERS_PAGE_SIZE)
    mockFetchRoute(`/groups/members/${groupId}?limit=${GROUP_MEMBERS_PAGE_SIZE}&offset=${offset}`, {
      memberCount: total,
      members: page,
    })
  }
}

function mockNamesFor(namedAddresses: Record<string, string>) {
  // Routes are matched in insertion order; register named addresses before the catch-all.
  for (const [addr, name] of Object.entries(namedAddresses)) {
    mockFetchRoute(`/names/address/${encodeURIComponent(addr)}`, [{ name, owner: addr }])
  }
  mockFetchRoute(/^\/names\/address\//, [])
}

describe('groupMembersCache', () => {
  beforeEach(() => {
    resetGroupMembersCache()
    mockQortalAction('GET_ACCOUNT_DATA', (request: Record<string, any>) => ({ address: request.address, publicKey: `PK_${request.address}` }))
  })

  it('pages members 100 at a time and stops on a short page, never with limit=0', async () => {
    mockMemberPages('7', 230)
    mockNamesFor({})
    const result = await getGroupMembers('7')
    expect(result.members).toHaveLength(230)
    const pages = fetchedUrls('/groups/members/7')
    expect(pages).toEqual([
      '/groups/members/7?limit=100&offset=0',
      '/groups/members/7?limit=100&offset=100',
      '/groups/members/7?limit=100&offset=200',
    ])
    expect(pages.some((url) => url.includes('limit=0'))).toBe(false)
  })

  it('stops after one page when the group has fewer than 100 members', async () => {
    mockMemberPages('3', 12)
    mockNamesFor({})
    await getGroupMembers('3')
    expect(fetchedUrls('/groups/members/3')).toHaveLength(1)
  })

  it('includes nameless members in the public keys and keys them by address in the composer map', async () => {
    mockMemberPages('3', 3)
    mockNamesFor({ [address(0)]: 'alice', [address(2)]: 'carol' })
    const result = await getGroupMembers('3')
    expect(memberNames(result.members)).toEqual(['alice', 'carol'])

    const keys = await getGroupPublicKeys('3')
    expect(keys).toEqual([`PK_${address(0)}`, `PK_${address(1)}`, `PK_${address(2)}`])

    const byName = toMembersByName(result.members)
    expect(Object.keys(byName).sort()).toEqual(['alice', 'carol', address(1)].sort())
    expect(byName.alice).toEqual({ publicKey: `PK_${address(0)}`, address: address(0), name: 'alice' })
    expect(Object.values(byName).map((m) => m.publicKey).sort()).toEqual(keys.slice().sort())
  })

  it('leaves out members whose public key is not on chain yet', async () => {
    mockMemberPages('4', 2)
    mockNamesFor({})
    mockQortalAction('GET_ACCOUNT_DATA', (request: Record<string, any>) =>
      request.address === address(1) ? { address: request.address } : { address: request.address, publicKey: 'PK_ok' }
    )
    expect(await getGroupPublicKeys('4')).toEqual(['PK_ok'])
    expect(Object.keys(toMembersByName((await getGroupMembers('4')).members))).toEqual([address(0)])
  })

  it('resolves each address once across groups and reuses a member list for 10 minutes', async () => {
    mockMemberPages('1', 5)
    mockMemberPages('2', 5) // same five addresses
    mockNamesFor({ [address(0)]: 'alice' })

    await Promise.all([getGroupMembers('1'), getGroupMembers('1')]) // in-flight merge
    await getGroupMembers('2')
    await getGroupMembers('1')

    expect(fetchedUrls('/names/address/')).toHaveLength(5)
    expect(qortalCalls('GET_ACCOUNT_DATA')).toHaveLength(5)
    expect(fetchedUrls('/groups/members/1')).toHaveLength(1)
    expect(fetchedUrls('/groups/members/2')).toHaveLength(1)
    const stats = groupMembersStats()
    expect(stats.groupFetches).toBe(2)
    expect(stats.groupHits).toBeGreaterThanOrEqual(1)
    expect(peekGroupMembers('1')?.members).toHaveLength(5)

    // A stale list is fetched again, but the per-address answers are still cached.
    expect(peekGroupMembers('1', 0)).toBeNull()
    await getGroupMembers('1', { maxAgeMs: 0 })
    expect(fetchedUrls('/groups/members/1')).toHaveLength(2)
    expect(fetchedUrls('/names/address/')).toHaveLength(5)

    invalidateGroupMembers('1')
    expect(peekGroupMembers('1')).toBeNull()
  })

  it('throws on a failed member page instead of returning a partial list', async () => {
    mockFetchRoute('/groups/members/9?', { error: 'nope' }, { status: 500 })
    await expect(getGroupMembers('9')).rejects.toThrow(/group members/)
    expect(peekGroupMembers('9')).toBeNull()
  })

  it('counts members from the member pages alone, and the full list reuses those pages', async () => {
    mockMemberPages('9', 150)
    mockNamesFor({})
    const addresses = await getGroupMemberAddresses('9')
    expect(addresses).toHaveLength(150)
    expect(peekGroupMemberCount('9')).toBe(150)
    expect(qortalCalls('GET_ACCOUNT_DATA')).toHaveLength(0)
    expect(fetchedUrls('/names/address')).toHaveLength(0)
    await getGroupMembers('9')
    // No second walk of the member pages.
    expect(fetchedUrls('/groups/members/9')).toHaveLength(2)
  })

  it('does not ask again for an account without a public key on every refresh', async () => {
    mockMemberPages('8', 2)
    mockNamesFor({})
    mockQortalAction('GET_ACCOUNT_DATA', () => ({ publicKey: '' }))
    await getGroupMembers('8')
    expect(qortalCalls('GET_ACCOUNT_DATA')).toHaveLength(2)
    await getGroupMembers('8', { force: true })
    expect(qortalCalls('GET_ACCOUNT_DATA')).toHaveLength(2)
  })
})
