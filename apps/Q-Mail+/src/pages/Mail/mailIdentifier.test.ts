import { describe, expect, it } from 'vitest'
import {
  getSentRecipientDisplayLabel,
  getSentRecipientGroupKey,
  isSentMailIdentifier,
  parseSentRecipientFromIdentifier,
} from './mailIdentifier'
import { aliasMailIdentifier as buildAliasMailIdentifier, directMailIdentifier as buildDirectMailIdentifier } from '../../utils/mailCompose'

const ADDRESS = 'QdSnUy6sUiEnaN87dWmE92g1uQjrvPgrWG'
const SUFFIX = ADDRESS.slice(-6)

describe('parseSentRecipientFromIdentifier (Bug #19)', () => {
  const names = [
    'bob',
    'a_b',
    'x_y_z',
    "MA's",
    'POS+',
    'Custom Node on Qortal GO | GUIDE',
    'dot.name',
    'my_mail_box',
    '_leading',
    'trailing_',
    'abcdefghijklmnopqrs_tuv',
  ]

  it.each(names)('reads name and suffix of direct mail to %j', name => {
    const identifier = buildDirectMailIdentifier(name, ADDRESS, 'Ab12Cd')
    expect(identifier).toBe(`_mail_qortal_qmail_${name.slice(0, 20)}_${SUFFIX}_mail_Ab12Cd`)
    expect(parseSentRecipientFromIdentifier(identifier)).toEqual({
      recipientName: name.slice(0, 20),
      recipientAddress: SUFFIX,
    })
  })

  it('keeps the truncated 20-character prefix of a long name', () => {
    const identifier = buildDirectMailIdentifier('Custom Node on Qortal GO | GUIDE', ADDRESS, 'xyz')
    expect(parseSentRecipientFromIdentifier(identifier).recipientName).toBe('Custom Node on Qorta')
    expect(getSentRecipientDisplayLabel(identifier)).toBe('Custom Node on Qorta')
  })

  it.each(['a_b', 'x_y_z', "MA's", 'POS+', 'Custom Node on Qortal GO | GUIDE', 'mail_mail_'])(
    'reads alias mail to %j as an alias with no address',
    alias => {
      const identifier = buildAliasMailIdentifier(alias, 'Q1w2E3')
      expect(parseSentRecipientFromIdentifier(identifier)).toEqual({
        recipientName: alias,
        recipientAddress: null,
      })
    }
  )

  it('reads legacy identifiers without the leading _mail_', () => {
    expect(parseSentRecipientFromIdentifier(`qortal_qmail_a_b_${SUFFIX}_mail_abc`)).toEqual({
      recipientName: 'a_b',
      recipientAddress: SUFFIX,
    })
    expect(parseSentRecipientFromIdentifier('qortal_qmail_x_y_mail_abc')).toEqual({
      recipientName: 'x_y',
      recipientAddress: null,
    })
  })

  it('treats a name longer than 20 characters before a 6-character tail as an alias', () => {
    const alias = 'this_alias_is_far_too_long_ABCDEF'
    expect(parseSentRecipientFromIdentifier(buildAliasMailIdentifier(alias, 'id1'))).toEqual({
      recipientName: alias,
      recipientAddress: null,
    })
  })

  it('returns nulls for identifiers that are not sent mail', () => {
    expect(parseSentRecipientFromIdentifier('qortal_qmail_thmsg_group5_tok_uid')).toEqual({
      recipientName: null,
      recipientAddress: null,
    })
    expect(parseSentRecipientFromIdentifier('attachments_qmail_a_b')).toEqual({
      recipientName: null,
      recipientAddress: null,
    })
    expect(parseSentRecipientFromIdentifier('')).toEqual({ recipientName: null, recipientAddress: null })
  })

  it('still accepts the search query shape with an empty id', () => {
    expect(parseSentRecipientFromIdentifier(`qortal_qmail_x_y_z_${SUFFIX}_mail_`)).toEqual({
      recipientName: 'x_y_z',
      recipientAddress: SUFFIX,
    })
  })
})

describe('sent grouping and labels', () => {
  it('groups every message to the same underscore name together, apart from a look-alike name', () => {
    const one = buildDirectMailIdentifier('a_b', ADDRESS, 'id1')
    const two = buildDirectMailIdentifier('a_b', ADDRESS, 'id2')
    const other = buildDirectMailIdentifier('a', ADDRESS, 'id3')
    expect(getSentRecipientGroupKey(one)).toBe(`recipient:a_b:${SUFFIX.toLowerCase()}`)
    expect(getSentRecipientGroupKey(two)).toBe(getSentRecipientGroupKey(one))
    expect(getSentRecipientGroupKey(other)).not.toBe(getSentRecipientGroupKey(one))
  })

  it('groups alias mail by the whole alias and labels it', () => {
    const identifier = buildAliasMailIdentifier('x_y_z', 'id1')
    expect(getSentRecipientGroupKey(identifier)).toBe('alias:x_y_z')
    expect(getSentRecipientDisplayLabel(identifier)).toBe('x_y_z')
  })

  it('isSentMailIdentifier is unchanged for underscore names', () => {
    expect(isSentMailIdentifier(buildDirectMailIdentifier('x_y_z', ADDRESS, 'id'))).toBe(true)
    expect(isSentMailIdentifier('qortal_qmail_thread_group1_tok')).toBe(false)
  })
})
