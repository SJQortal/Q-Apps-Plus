import { beforeEach, describe, expect, it } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { mockQortalAction, qortalCalls } from '../test/setup'
import { resetNameCache } from './nameCache'
import {
  peekSentRecipientName,
  resetSentRecipientCache,
  resolveSentRecipientName,
  sentRecipientCacheStats,
  useSentRecipient,
} from './sentRecipientCache'

describe('sentRecipientCache', () => {
  beforeEach(() => {
    resetNameCache()
    resetSentRecipientCache()
  })

  it('resolves a short name with one GET_NAME_DATA per group and no SEARCH_NAMES', async () => {
    mockQortalAction('GET_NAME_DATA', (request: any) =>
      request.name === 'bob' ? { name: 'bob', owner: 'QBobAddress123456' } : {}
    )
    mockQortalAction('SEARCH_NAMES', [])
    const [a, b, c] = await Promise.all([
      resolveSentRecipientName('bob', '123456'),
      resolveSentRecipientName('bob', '123456'),
      resolveSentRecipientName('Bob', '123456'),
    ])
    expect([a, b, c]).toEqual(['bob', 'bob', 'bob'])
    expect(await resolveSentRecipientName('bob', '123456')).toBe('bob')
    expect(qortalCalls('GET_NAME_DATA')).toHaveLength(1)
    expect(qortalCalls('SEARCH_NAMES')).toHaveLength(0)
    expect(peekSentRecipientName('bob', '123456')).toBe('bob')
    expect(sentRecipientCacheStats().hits).toBe(1)
  })

  it('falls back to one prefix search for a truncated name, and rejects a same-prefix name with another owner', async () => {
    mockQortalAction('GET_NAME_DATA', { name: 'alexanderthegreat123', owner: 'QSomeoneElse999999' })
    mockQortalAction('SEARCH_NAMES', (request: any) => {
      expect(request.prefix).toBe(true)
      expect(request.limit).toBe(10)
      return [
        { name: 'alexanderthegreat1234', owner: 'QOther000000' },
        { name: 'alexanderthegreat12345', owner: 'QRightOwnerABCDEF' },
      ]
    })
    expect(await resolveSentRecipientName('alexanderthegreat123', 'ABCDEF')).toBe('alexanderthegreat12345')
    expect(await resolveSentRecipientName('alexanderthegreat123', 'abcdef')).toBe('alexanderthegreat12345')
    expect(qortalCalls('GET_NAME_DATA')).toHaveLength(1)
    expect(qortalCalls('SEARCH_NAMES')).toHaveLength(1)
  })

  it('sends a "+" in the prefix as %2B so q-apps.js does not turn it into a space', async () => {
    mockQortalAction('GET_NAME_DATA', {})
    mockQortalAction('SEARCH_NAMES', (request: any) =>
      request.query === 'bob%2Bbuilder12345678' ? [{ name: 'bob+builder123456789', owner: 'QBuilderPLUS01' }] : []
    )
    expect(await resolveSentRecipientName('bob+builder12345678', 'PLUS01')).toBe('bob+builder123456789')
    expect(qortalCalls('SEARCH_NAMES')[0].query).toBe('bob%2Bbuilder12345678')
  })

  it('remembers a miss so the row never asks again', async () => {
    mockQortalAction('GET_NAME_DATA', {})
    mockQortalAction('SEARCH_NAMES', [])
    expect(await resolveSentRecipientName('ghost', 'ZZZZZZ')).toBeNull()
    expect(await resolveSentRecipientName('ghost', 'ZZZZZZ')).toBeNull()
    expect(peekSentRecipientName('ghost', 'ZZZZZZ')).toBeNull()
    expect(qortalCalls('SEARCH_NAMES')).toHaveLength(1)
  })

  describe('names with "_" and other punctuation (Bug #19)', () => {
    it('resolves "x_y_z" from its whole prefix, not from "x"', async () => {
      mockQortalAction('GET_NAME_DATA', (request: any) =>
        request.name === 'x_y_z' ? { name: 'x_y_z', owner: 'QOwnerOfXyz9ABCDEF' } : {}
      )
      mockQortalAction('SEARCH_NAMES', [])
      const { result } = renderHook(() => useSentRecipient('_mail_qortal_qmail_x_y_z_ABCDEF_mail_id1'))
      await waitFor(() => expect(result.current.isExact).toBe(true))
      expect(result.current).toEqual({ name: 'x_y_z', isAlias: false, isExact: true })
      expect(qortalCalls('GET_NAME_DATA').map((call: any) => call.name)).toEqual(['x_y_z'])
      expect(qortalCalls('SEARCH_NAMES')).toHaveLength(0)
    })

    it('resolves a truncated long name with "|" and spaces through one prefix search', async () => {
      mockQortalAction('GET_NAME_DATA', {})
      mockQortalAction('SEARCH_NAMES', [
        { name: 'Custom Node on Qortal GO | GUIDE', owner: 'QGuideOwner0GUIDE1' },
      ])
      const { result } = renderHook(() =>
        useSentRecipient('_mail_qortal_qmail_Custom Node on Qorta_GUIDE1_mail_id2')
      )
      expect(result.current.name).toBe('Custom Node on Qorta')
      await waitFor(() => expect(result.current.name).toBe('Custom Node on Qortal GO | GUIDE'))
      expect(qortalCalls('GET_NAME_DATA')[0].name).toBe('Custom Node on Qorta')
    })

    it('treats alias mail to "a_b" as an alias and looks nothing up', () => {
      const { result } = renderHook(() => useSentRecipient('_mail_qortal_qmail_a_b_mail_id3'))
      expect(result.current).toEqual({ name: 'a_b', isAlias: true, isExact: true })
      const { result: apostrophe } = renderHook(() => useSentRecipient("_mail_qortal_qmail_MA's_mail_id4"))
      expect(apostrophe.current).toEqual({ name: "MA's", isAlias: true, isExact: true })
      expect(qortalCalls('GET_NAME_DATA')).toHaveLength(0)
    })

    it('keeps "POS+" groups apart from "POS"', async () => {
      mockQortalAction('GET_NAME_DATA', (request: any) =>
        request.name === 'POS+' ? { name: 'POS+', owner: 'QPlusOwner00PLUS22' } : { name: 'POS', owner: 'QPosOwner000POS333' }
      )
      expect(await resolveSentRecipientName('POS+', 'PLUS22')).toBe('POS+')
      expect(await resolveSentRecipientName('POS', 'POS333')).toBe('POS')
      expect(peekSentRecipientName('POS+', 'PLUS22')).toBe('POS+')
    })
  })
})
