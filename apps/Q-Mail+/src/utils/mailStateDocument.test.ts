import { describe, expect, it } from 'vitest'
import {
  MAIL_STATE_DOCUMENT_IDENTIFIER,
  MAIL_STATE_DOCUMENT_SERVICE,
  arePublishedStateEntriesEqual,
  buildPublishedMailStateDocument,
  mergePublishedStateEntries,
  normalizePublishedStateEntry,
  parsePublishedMailStateDocument,
} from './mailStateDocument'

describe('qmail_state_v1 document', () => {
  it('keeps the binding service and identifier', () => {
    expect(MAIL_STATE_DOCUMENT_SERVICE).toBe('DOCUMENT_PRIVATE')
    expect(MAIL_STATE_DOCUMENT_IDENTIFIER).toBe('qmail_state_v1')
  })

  it('normalizes entries the way the original app does (read only ever true, empty subject omitted)', () => {
    expect(normalizePublishedStateEntry({ read: false, subject: '  ', updatedAt: 0 })).toEqual({})
    expect(normalizePublishedStateEntry({ read: true, subject: ' Hi ', updatedAt: 5 })).toEqual({
      read: true,
      subject: 'Hi',
      updatedAt: 5,
    })
    expect(mergePublishedStateEntries({ read: true, subject: 'old', updatedAt: 1 }, { subject: 'new', updatedAt: 2 })).toEqual({
      read: true,
      subject: 'new',
      updatedAt: 2,
    })
    expect(arePublishedStateEntriesEqual({ read: true, updatedAt: 1 }, { read: true, updatedAt: 9 })).toBe(true)
    expect(arePublishedStateEntriesEqual({ read: true }, {})).toBe(false)
  })

  it('builds exactly the documented shape plus the additive archived map', () => {
    const { document, mergedEntries } = buildPublishedMailStateDocument({
      ownerAddress: 'QAddr',
      names: ['alice', 'alice-work'],
      publishedEntries: { m1: { read: true, updatedAt: 1 } },
      localEntries: { m1: { subject: 'Hello' }, m2: { read: true } },
      archived: { m3: { at: 7 } },
      now: 100,
    })
    expect(Object.keys(document)).toEqual(['version', 'updatedAt', 'ownerAddress', 'names', 'messages', 'archived'])
    expect(document.version).toBe(1)
    expect(document.updatedAt).toBe(100)
    expect(document.ownerAddress).toBe('QAddr')
    expect(document.names).toEqual(['alice', 'alice-work'])
    expect(document.messages).toEqual({
      m1: { read: true, subject: 'Hello', updatedAt: 100 },
      m2: { read: true, subject: undefined, updatedAt: 100 },
    })
    expect(document.archived).toEqual({ m3: { at: 7 } })
    expect(mergedEntries).toBe(document.messages)
    // Per-message entries never carry extra keys (the original normaliser would drop them).
    Object.values(document.messages).forEach((entry) => {
      expect(Object.keys(entry).every((key) => ['read', 'subject', 'updatedAt'].includes(key))).toBe(true)
    })
  })

  it('parses a document from the original app (no archived map) and from Q-Mail+', () => {
    const original = {
      version: 1,
      updatedAt: 1,
      ownerAddress: 'Q',
      names: ['a'],
      messages: {
        keep: { read: true },
        subjectOnly: { subject: 'S' },
        drop: { updatedAt: 5 },
        junk: 'x',
      },
    }
    expect(parsePublishedMailStateDocument(original)).toEqual({
      messages: { keep: { read: true }, subjectOnly: { subject: 'S' } },
      archived: {},
    })
    const plus = { ...original, archived: { keep: { at: 3 }, bad: { at: 'x' } } }
    expect(parsePublishedMailStateDocument(plus)?.archived).toEqual({ keep: { at: 3 } })
    expect(parsePublishedMailStateDocument(null)).toBeNull()
    expect(parsePublishedMailStateDocument({ version: 1 })).toBeNull()
    expect(parsePublishedMailStateDocument({ archived: { a: { at: 1 } } })).toEqual({
      messages: {},
      archived: { a: { at: 1 } },
    })
  })
})
