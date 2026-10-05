import { describe, expect, it } from 'vitest'
import {
  MAIL_STATE_DOCUMENT_IDENTIFIER,
  MAIL_STATE_DOCUMENT_SERVICE,
  arePublishedStateEntriesEqual,
  buildPublishedMailStateDocument,
  isLocalEntryPublished,
  mergeAliasReplyLinks,
  mergePublishedStateEntries,
  mergeRemoteStateIntoPublishBase,
  mergeWatchedAliases,
  normalizePublishedSettings,
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
      settings: null,
    })
    const plus = { ...original, archived: { keep: { at: 3 }, bad: { at: 'x' } } }
    expect(parsePublishedMailStateDocument(plus)?.archived).toEqual({ keep: { at: 3 } })
    expect(parsePublishedMailStateDocument(null)).toBeNull()
    expect(parsePublishedMailStateDocument({ version: 1 })).toBeNull()
    expect(parsePublishedMailStateDocument({ archived: { a: { at: 1 } } })).toEqual({
      messages: {},
      archived: { a: { at: 1 } },
      settings: null,
    })
  })

  it('writes the additive settings object after archived, in the documented shape', () => {
    const { document } = buildPublishedMailStateDocument({
      ownerAddress: 'QAddr',
      names: ['alice'],
      publishedEntries: {},
      localEntries: { m1: { read: true } },
      archived: {},
      settings: {
        uiTheme: 'hub20',
        textSize: 'large',
        watchedAliases: ['Support', ' support ', 'Sales', ''],
        aliasReplyLinks: { Support: 'alice-support', sales: ' ', '': 'x' },
      },
      now: 100,
    })
    expect(Object.keys(document)).toEqual([
      'version',
      'updatedAt',
      'ownerAddress',
      'names',
      'messages',
      'archived',
      'settings',
    ])
    expect(document.settings).toEqual({
      watchedAliases: ['Support', 'Sales'],
      aliasReplyLinks: { support: 'alice-support' },
      uiTheme: 'hub20',
      textSize: 'large',
    })
    expect(Object.keys(document.settings!)).toEqual(['watchedAliases', 'aliasReplyLinks', 'uiTheme', 'textSize'])
    // Without settings the document is exactly what it was before.
    const { document: plain } = buildPublishedMailStateDocument({
      ownerAddress: 'QAddr',
      names: ['alice'],
      publishedEntries: {},
      localEntries: {},
      archived: {},
      now: 100,
    })
    expect(Object.keys(plain)).toEqual(['version', 'updatedAt', 'ownerAddress', 'names', 'messages', 'archived'])
    expect('settings' in plain).toBe(false)
  })

  it('writes the footer last in settings, in the exact stored shape, and leaves it out when empty', () => {
    const settings = {
      uiTheme: 'black' as const,
      textSize: 'medium' as const,
      watchedAliases: [],
      aliasReplyLinks: {},
      footer: { default: 'Simon\r\nqortal://APP/Q-Mail+ \n', byName: { Work: 'Work line', Home: '' }, inReplies: false },
    }
    const { document } = buildPublishedMailStateDocument({
      ownerAddress: 'QAddr',
      names: ['alice'],
      publishedEntries: {},
      localEntries: {},
      archived: {},
      settings,
      now: 100,
    })
    expect(Object.keys(document.settings!)).toEqual(['watchedAliases', 'aliasReplyLinks', 'uiTheme', 'textSize', 'footer'])
    expect(JSON.parse(JSON.stringify(document.settings!.footer))).toEqual({
      default: 'Simon\nqortal://APP/Q-Mail+',
      byName: { Work: 'Work line' },
      inReplies: false,
    })
    const { document: noFooter } = buildPublishedMailStateDocument({
      ownerAddress: 'QAddr',
      names: ['alice'],
      publishedEntries: {},
      localEntries: {},
      archived: {},
      settings: { ...settings, footer: { default: ' ', byName: {}, inReplies: true } },
      now: 100,
    })
    expect('footer' in noFooter.settings!).toBe(false)
  })

  it('parses a footer when present and keeps a document without one as before', () => {
    const base = { version: 1, updatedAt: 1, ownerAddress: 'Q', names: ['a'], messages: { m: { read: true } } }
    expect(
      parsePublishedMailStateDocument({ ...base, settings: { footer: { default: 'Hi', byName: { b: 'B' } } } })?.settings
    ).toEqual({ watchedAliases: [], aliasReplyLinks: {}, footer: { default: 'Hi', byName: { b: 'B' }, inReplies: true } })
    expect(parsePublishedMailStateDocument({ ...base, settings: { footer: 'nope' } })?.settings).toEqual({
      watchedAliases: [],
      aliasReplyLinks: {},
    })
    expect(parsePublishedMailStateDocument({ ...base, settings: { footer: { default: '' } } })?.settings).toEqual({
      watchedAliases: [],
      aliasReplyLinks: {},
    })
  })

  it('parses settings when present, keeps only known values, and ignores a missing or broken object', () => {
    const base = { version: 1, updatedAt: 1, ownerAddress: 'Q', names: ['a'], messages: { m: { read: true } } }
    expect(parsePublishedMailStateDocument(base)?.settings).toBeNull()
    expect(parsePublishedMailStateDocument({ ...base, settings: 'nope' })?.settings).toBeNull()
    expect(parsePublishedMailStateDocument({ ...base, settings: [] })?.settings).toBeNull()
    expect(
      parsePublishedMailStateDocument({
        ...base,
        settings: {
          uiTheme: 'neon',
          textSize: 'huge',
          watchedAliases: ['a', 7, 'A', 'b'],
          aliasReplyLinks: { A: 'reply-a', b: 3 },
          future: true,
        },
      })?.settings
    ).toEqual({ watchedAliases: ['a', 'b'], aliasReplyLinks: { a: 'reply-a' } })
    expect(
      parsePublishedMailStateDocument({ ...base, settings: { uiTheme: 'black', textSize: 'small' } })?.settings
    ).toEqual({ uiTheme: 'black', textSize: 'small', watchedAliases: [], aliasReplyLinks: {} })
    // A document that only carries settings is still usable.
    expect(parsePublishedMailStateDocument({ settings: { watchedAliases: ['x'] } })).toEqual({
      messages: {},
      archived: {},
      settings: { watchedAliases: ['x'], aliasReplyLinks: {} },
    })
    expect(normalizePublishedSettings(null)).toBeNull()
  })

  it('unions alias lists with the local side winning', () => {
    const local = ['Support', 'sales']
    expect(mergeWatchedAliases(local, ['SUPPORT', 'Sales'])).toBe(local)
    expect(mergeWatchedAliases(local, ['Billing', 'support', 'billing'])).toEqual(['Support', 'sales', 'Billing'])
    expect(mergeWatchedAliases([], ['A', 'a'])).toEqual(['A'])

    const links = { support: 'alice-support' }
    expect(mergeAliasReplyLinks(links, { support: 'other', SUPPORT: 'other2' })).toBe(links)
    expect(mergeAliasReplyLinks(links, { Sales: 'alice-sales', support: 'other' })).toEqual({
      support: 'alice-support',
      sales: 'alice-sales',
    })
    expect(mergeAliasReplyLinks({}, { x: '' })).toEqual({})
  })
})

describe('mergeRemoteStateIntoPublishBase', () => {
  const base = {
    publishedEntries: {},
    archived: { b1: { at: 50 } },
    watchedAliases: ['bob'],
    aliasReplyLinks: {},
  }

  it('keeps what other devices published when this one never loaded it', () => {
    const remote = {
      messages: { m1: { read: true, subject: 'Hi' } },
      archived: { a1: { at: 10 }, b1: { at: 1 } },
      settings: { watchedAliases: ['alice'], aliasReplyLinks: { alice: 'alice-reply' } },
    }
    const merged = mergeRemoteStateIntoPublishBase(base, remote)
    expect(merged.publishedEntries).toEqual({ m1: { read: true, subject: 'Hi' } })
    // Local archive entries win; ids only the document knows are kept.
    expect(merged.archived).toEqual({ b1: { at: 50 }, a1: { at: 10 } })
    expect(merged.watchedAliases).toEqual(['bob', 'alice'])
    expect(merged.aliasReplyLinks).toEqual({ alice: 'alice-reply' })
    const { document } = buildPublishedMailStateDocument({
      ownerAddress: 'Qx',
      names: ['bob'],
      publishedEntries: merged.publishedEntries,
      localEntries: {},
      archived: merged.archived,
      now: 5,
    })
    expect(document.messages.m1).toEqual({ read: true, subject: 'Hi' })
    expect(Object.keys(document.archived!)).toEqual(['b1', 'a1'])
  })

  it('changes nothing when there is no published document', () => {
    expect(mergeRemoteStateIntoPublishBase(base, null)).toBe(base)
  })
})

describe('isLocalEntryPublished', () => {
  it('treats a local unread over a published read as in sync, even after a publish', () => {
    const published = { read: true, subject: 'Hi', updatedAt: 1 }
    const localUnread = { subject: 'Hi' }
    expect(isLocalEntryPublished(localUnread, published)).toBe(true)
    // Publishing OR-merges read, so the published entry stays read and still counts as in sync.
    const { mergedEntries } = buildPublishedMailStateDocument({
      ownerAddress: 'Qx',
      names: [],
      publishedEntries: { m: published },
      localEntries: { m: localUnread },
      archived: {},
      now: 2,
    })
    expect(isLocalEntryPublished(localUnread, mergedEntries.m)).toBe(true)
  })

  it('still reports a local read or a new subject the document lacks', () => {
    expect(isLocalEntryPublished({ read: true }, { subject: 'Hi' })).toBe(false)
    expect(isLocalEntryPublished({ subject: 'New' }, { read: true, subject: 'Old' })).toBe(false)
    expect(isLocalEntryPublished({ read: true, subject: 'Hi' }, undefined)).toBe(false)
    expect(isLocalEntryPublished({ read: true, subject: 'Hi' }, { read: true, subject: 'Hi' })).toBe(true)
  })
})
