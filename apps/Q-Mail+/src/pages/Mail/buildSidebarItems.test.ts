import { describe, expect, it } from 'vitest'
import { buildSidebarItems, type UnreadCounts } from './Mail'

const base = {
  inboxNames: ['alice', 'alice-work'],
  aliasesNames: ['shop'],
  aliasReplyLinks: {},
  sentNames: ['alice'],
  threadGroups: [{ id: 1, name: 'Devs' }],
  isThreadsSectionExpanded: false,
  primaryName: 'alice',
  canPublishState: true,
}

const byId = (items: ReturnType<typeof buildSidebarItems>) =>
  Object.fromEntries(items.map((item) => [item.id, item]))

describe('buildSidebarItems unread badges', () => {
  it('shows no badges without counts and keeps the +/- and ! markers', () => {
    const items = byId(buildSidebarItems({ ...base, hasPendingStateChanges: true }))
    expect(items.inbox.badgeText).toBeUndefined()
    expect(items['inbox-instance:alice'].badgeText).toBeUndefined()
    expect(items.aliases.badgeText).toBeUndefined()
    expect(items.threads.badgeText).toBe('+')
    expect(items['publish-mail-state'].badgeText).toBe('!')
    expect(byId(buildSidebarItems({ ...base, isThreadsSectionExpanded: true })).threads.badgeText).toBe('-')
  })

  it('puts the numbers on Inbox, each owned name and each watched alias', () => {
    const unreadCounts: UnreadCounts = {
      inbox: 5,
      byName: { alice: 3, 'alice-work': 2 },
      byAlias: { shop: 1 },
      aliases: 1,
      total: 6,
    }
    const items = byId(buildSidebarItems({ ...base, unreadCounts }))
    expect(items.inbox.badgeText).toBe('5')
    expect(items['inbox-instance:alice'].badgeText).toBe('3')
    expect(items['inbox-instance:alice-work'].badgeText).toBe('2')
    expect(items.aliases.badgeText).toBe('1')
    expect(items['aliases-instance:shop'].badgeText).toBe('1')
    expect(items.sent.badgeText).toBeUndefined()
    expect(items['publish-mail-state'].badgeText).toBeUndefined()
  })

  it('omits a badge for zero counts', () => {
    const items = byId(
      buildSidebarItems({
        ...base,
        unreadCounts: { inbox: 0, byName: { alice: 0 }, byAlias: { shop: 0 }, aliases: 0, total: 0 },
      })
    )
    expect(items.inbox.badgeText).toBeUndefined()
    expect(items['inbox-instance:alice'].badgeText).toBeUndefined()
    expect(items['aliases-instance:shop'].badgeText).toBeUndefined()
  })
})

describe('buildSidebarItems without group threads (Settings)', () => {
  it('leaves the Threads section and its groups out, and keeps everything else', () => {
    const shown = buildSidebarItems({ ...base, isThreadsSectionExpanded: true })
    const hidden = buildSidebarItems({ ...base, isThreadsSectionExpanded: true, showThreads: false })
    expect(shown.some((item) => item.id === 'threads')).toBe(true)
    expect(hidden.some((item) => item.id === 'threads' || item.id.startsWith('threads-group:'))).toBe(false)
    expect(hidden.map((item) => item.id)).toEqual(
      shown.filter((item) => item.id !== 'threads' && !item.id.startsWith('threads-group:')).map((item) => item.id)
    )
  })
})
