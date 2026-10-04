import { beforeEach, describe, expect, it } from 'vitest'
import { mockQortalAction, qortalCalls } from '../test/setup'
import {
  lookupName,
  nameCacheStats,
  nameExists,
  peekName,
  resetNameCache,
  resolveName,
  searchDirectoryNames,
  searchNamesQuery,
} from './nameCache'

describe('nameCache', () => {
  beforeEach(() => {
    resetNameCache()
    mockQortalAction('GET_NAME_DATA', (request: any) => {
      if (request.name.toLowerCase() === 'ali') return { name: 'Ali', owner: 'QALI' }
      if (request.name.toLowerCase() === 'nokey') return { name: 'NoKey', owner: 'QNOKEY' }
      throw new Error('Name not found')
    })
    mockQortalAction('GET_ACCOUNT_DATA', (request: any) => {
      if (request.address === 'QALI') return { address: 'QALI', publicKey: 'PK_ALI' }
      return { address: request.address }
    })
  })

  it('looks a name up once, whatever the case or spacing', async () => {
    expect(await lookupName('Ali')).toEqual({ status: 'found', name: 'Ali', address: 'QALI' })
    expect(await lookupName('ali ')).toEqual({ status: 'found', name: 'Ali', address: 'QALI' })
    expect(await lookupName(' ALI')).toEqual({ status: 'found', name: 'Ali', address: 'QALI' })
    expect(qortalCalls('GET_NAME_DATA')).toHaveLength(1)
    expect(nameCacheStats().hits).toBe(2)
  })

  it('merges identical lookups that are in flight', async () => {
    const [a, b] = await Promise.all([lookupName('Ali'), lookupName('ali')])
    expect(a).toEqual(b)
    expect(qortalCalls('GET_NAME_DATA')).toHaveLength(1)
  })

  it('remembers a missing name and reports it without throwing', async () => {
    expect(await lookupName('Nobody')).toEqual({ status: 'missing' })
    expect(await nameExists('Nobody')).toBe(false)
    expect(qortalCalls('GET_NAME_DATA')).toHaveLength(1)
    expect(peekName('nobody')).toEqual({ status: 'missing' })
    expect(peekName('unknown')).toBeUndefined()
    expect(await lookupName('')).toEqual({ status: 'missing' })
  })

  it('rethrows transport errors instead of caching a miss', async () => {
    mockQortalAction('GET_NAME_DATA', () => {
      throw new Error('Request timed out')
    })
    await expect(lookupName('Ali')).rejects.toThrow('timed out')
    expect(peekName('Ali')).toBeUndefined()
  })

  it('resolves name → address → public key with one request each', async () => {
    expect(await resolveName('Ali')).toEqual({ name: 'Ali', address: 'QALI', publicKey: 'PK_ALI' })
    expect(await resolveName('ali')).toEqual({ name: 'Ali', address: 'QALI', publicKey: 'PK_ALI' })
    expect(qortalCalls('GET_NAME_DATA')).toHaveLength(1)
    expect(qortalCalls('GET_ACCOUNT_DATA')).toHaveLength(1)
  })

  it('returns null for an unknown name or an account without a key', async () => {
    expect(await resolveName('Nobody')).toBeNull()
    expect(await resolveName('NoKey')).toBeNull()
    expect(await nameExists('NoKey')).toBe(true)
  })

  it('encodes only the "+" in a SEARCH_NAMES query (q-apps.js would send it as a space)', () => {
    expect(searchNamesQuery('bob+builder')).toBe('bob%2Bbuilder')
    expect(searchNamesQuery('a+b+')).toBe('a%2Bb%2B')
    expect(searchNamesQuery("Zoë Ångström & O'Neil/2")).toBe("Zoë Ångström & O'Neil/2")
    expect(searchNamesQuery('')).toBe('')
  })

  describe('searchDirectoryNames (To suggestions)', () => {
    const directory = ['Alice', 'alicia', 'Alfred', 'Bob', 'bob+builder']
    beforeEach(() => {
      mockQortalAction('SEARCH_NAMES', (request: any) => {
        const query = decodeURIComponent(request.query).toLowerCase()
        return directory
          .filter(name => name.toLowerCase().startsWith(query))
          .slice(0, request.limit)
          .map(name => ({ name, owner: `Q${name}` }))
      })
    })

    it('asks once per query for the session, whatever the case, and merges searches in flight', async () => {
      const [a, b] = await Promise.all([searchDirectoryNames('Ali'), searchDirectoryNames('ali')])
      expect(a).toEqual(['Alice', 'alicia'])
      expect(b).toEqual(a)
      expect(await searchDirectoryNames(' ALI ')).toEqual(['Alice', 'alicia'])
      expect(qortalCalls('SEARCH_NAMES')).toHaveLength(1)
      expect(qortalCalls('SEARCH_NAMES')[0]).toEqual({
        action: 'SEARCH_NAMES',
        query: 'ali',
        prefix: true,
        limit: 30,
        reverse: false,
      })
      expect(nameCacheStats().searchRequests).toBe(1)
    })

    it('answers a longer query from a shorter complete one, without a request', async () => {
      expect(await searchDirectoryNames('al')).toEqual(['Alice', 'alicia', 'Alfred'])
      expect(await searchDirectoryNames('alic')).toEqual(['Alice', 'alicia'])
      expect(await searchDirectoryNames('alfz')).toEqual([])
      expect(qortalCalls('SEARCH_NAMES')).toHaveLength(1)
    })

    it('asks again when the shorter result was cut at the limit', async () => {
      expect(await searchDirectoryNames('al', 2)).toEqual(['Alice', 'alicia'])
      expect(await searchDirectoryNames('alf', 2)).toEqual(['Alfred'])
      expect(qortalCalls('SEARCH_NAMES')).toHaveLength(2)
    })

    it('encodes "+" and does not cache a failure', async () => {
      expect(await searchDirectoryNames('bob+')).toEqual(['bob+builder'])
      expect(qortalCalls('SEARCH_NAMES')[0].query).toBe('bob%2B')
      mockQortalAction('SEARCH_NAMES', () => {
        throw new Error('Request timed out')
      })
      await expect(searchDirectoryNames('carl')).rejects.toThrow('timed out')
      mockQortalAction('SEARCH_NAMES', [{ name: 'Carl' }])
      expect(await searchDirectoryNames('carl')).toEqual(['Carl'])
      expect(await searchDirectoryNames('')).toEqual([])
    })
  })
})
