import { beforeEach, describe, expect, it } from 'vitest'
import { mockQortalAction, qortalCalls } from '../test/setup'
import {
  lookupName,
  nameCacheStats,
  nameExists,
  peekName,
  resetNameCache,
  resolveName,
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
})
