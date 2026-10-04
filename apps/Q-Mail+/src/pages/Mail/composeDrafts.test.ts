import { describe, expect, it, vi } from 'vitest'
import {
  COMPOSE_DRAFTS_CHANGED_EVENT,
  composeDraftKey,
  deleteComposeDraft,
  draftSnippet,
  getComposeDraftsStorageKey,
  listComposeDrafts,
  readComposeDrafts,
  saveComposeDraft,
  sanitizeComposeDraft,
  subscribeToComposeDrafts,
  threadDraftKey,
} from './composeDrafts'
import { describeDraftTarget } from './DraftsMailbox'

const address = 'QADDR'

const base = {
  draftId: 'id',
  fromName: 'Me',
  toName: 'You',
  subject: 'S',
  value: '<p>hello <b>world</b></p>',
  aliasValue: '',
  showAlias: false,
  showBCC: false,
  bccNames: [],
  updatedAt: 10,
}

describe('composeDrafts storage', () => {
  it('keeps the original key and reads the original shape', () => {
    expect(getComposeDraftsStorageKey(address)).toBe('qmail_compose_drafts_QADDR')
    localStorage.setItem('qmail_compose_drafts_QADDR', JSON.stringify({ 'me::you': base }))
    expect(readComposeDrafts(address)).toEqual({ 'me::you': base })
  })

  it('drops entries without from/to and ignores junk', () => {
    localStorage.setItem(
      'qmail_compose_drafts_QADDR',
      JSON.stringify({ ok: base, bad: { subject: 'x' }, worse: 'string', list: [1] })
    )
    expect(Object.keys(readComposeDrafts(address))).toEqual(['ok'])
    localStorage.setItem('qmail_compose_drafts_QADDR', 'not json')
    expect(readComposeDrafts(address)).toEqual({})
  })

  it('keys: new mail, reply and thread post are distinct', () => {
    expect(composeDraftKey(' Me', 'YOU ')).toBe('me::you')
    expect(composeDraftKey('Me', 'You', 'abc')).toBe('me::you::reply:abc')
    expect(threadDraftKey(12, null)).toBe('thread::12::new')
    expect(threadDraftKey('12', 'qortal_qmail_thread_group12_tok')).toBe('thread::12::qortal_qmail_thread_group12_tok')
  })

  it('round-trips the additive fields and strips unknown ones', () => {
    const draft = sanitizeComposeDraft({
      ...base,
      kind: 'thread',
      attachments: [{ name: 'a.png', size: 12, type: 'image/png' }, { size: 1 }],
      replyTo: { id: 'm1', user: 'You', subject: 'Hi', createdAt: 5 },
      replyAll: true,
      groupId: ' 7 ',
      groupName: 'G',
      threadId: 't1',
      threadTitle: 'T',
      somethingElse: 1,
    })
    expect(draft).toEqual({
      ...base,
      kind: 'thread',
      attachments: [{ name: 'a.png', size: 12, type: 'image/png' }],
      replyTo: { id: 'm1', user: 'You', subject: 'Hi', createdAt: 5 },
      replyAll: true,
      groupId: '7',
      groupName: 'G',
      threadId: 't1',
      threadTitle: 'T',
    })
    expect(sanitizeComposeDraft(base)).toEqual(base)
    expect(sanitizeComposeDraft({ ...base, replyTo: null })?.replyTo).toBeNull()
  })

  it('saves, lists newest first, deletes, and announces every change', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToComposeDrafts(listener)
    saveComposeDraft(address, 'me::a', { ...base, toName: 'A', updatedAt: 1 })
    saveComposeDraft(address, 'me::b', { ...base, toName: 'B', updatedAt: 3 })
    saveComposeDraft(address, 'thread::1::new', { ...base, toName: 'G', kind: 'thread', updatedAt: 2 })
    expect(listComposeDrafts(address).map(item => item.key)).toEqual(['me::b', 'thread::1::new', 'me::a'])
    expect(listener).toHaveBeenCalledTimes(3)
    expect(deleteComposeDraft(address, 'me::a')).toBe(true)
    expect(deleteComposeDraft(address, 'me::a')).toBe(false)
    expect(deleteComposeDraft(address, '')).toBe(false)
    expect(listComposeDrafts(address)).toHaveLength(2)
    unsubscribe()
    window.dispatchEvent(new CustomEvent(COMPOSE_DRAFTS_CHANGED_EVENT))
    expect(listener).toHaveBeenCalledTimes(4)
  })

  it('makes a short text snippet from the HTML body', () => {
    expect(draftSnippet('<p>hello <b>world</b></p><p>&amp; more</p>')).toBe('hello world & more')
    expect(draftSnippet('x'.repeat(200), 10)).toBe('xxxxxxxxxx…')
    expect(draftSnippet(undefined)).toBe('')
  })
})

describe('drafts after the original app rewrites the map', () => {
  // The original keeps only these ten fields of every entry when it saves.
  const originalRewrite = () => {
    const key = getComposeDraftsStorageKey(address)
    const parsed = JSON.parse(localStorage.getItem(key) || '{}')
    const rewritten: Record<string, any> = {}
    Object.entries(parsed).forEach(([k, d]: [string, any]) => {
      rewritten[k] = {
        draftId: d.draftId,
        fromName: d.fromName,
        toName: d.toName,
        subject: d.subject,
        value: d.value,
        aliasValue: d.aliasValue,
        showAlias: d.showAlias,
        showBCC: d.showBCC,
        bccNames: d.bccNames,
        updatedAt: d.updatedAt,
      }
    })
    localStorage.setItem(key, JSON.stringify(rewritten))
  }

  it('keeps thread posts as thread posts and replies as replies, rebuilt from the key', () => {
    const threadId = 'qortal_qmail_thread_group7_tok1'
    saveComposeDraft(address, threadDraftKey('7', threadId), {
      ...base,
      toName: 'Qortal Devs',
      kind: 'thread',
      groupId: '7',
      groupName: 'Qortal Devs',
      threadId,
      threadTitle: 'Roadmap',
    })
    saveComposeDraft(address, threadDraftKey('7', null), {
      ...base,
      toName: 'Qortal Devs',
      subject: 'New idea',
      kind: 'thread',
      groupId: '7',
      groupName: 'Qortal Devs',
      threadId: null,
      threadTitle: 'New idea',
    })
    saveComposeDraft(address, composeDraftKey('Me', 'bob', 'mail-1'), {
      ...base,
      toName: 'bob',
      replyTo: { id: 'mail-1', user: 'bob' },
    })
    originalRewrite()
    const drafts = readComposeDrafts(address)
    const post = drafts[threadDraftKey('7', threadId)]
    expect(post).toMatchObject({ kind: 'thread', groupId: '7', groupName: 'Qortal Devs', threadId })
    expect(describeDraftTarget(post)).toBe('Post in Qortal Devs')
    const fresh = drafts[threadDraftKey('7', null)]
    expect(fresh).toMatchObject({ kind: 'thread', groupId: '7', threadId: null, threadTitle: 'New idea' })
    expect(describeDraftTarget(fresh)).toBe('New thread in Qortal Devs')
    const reply = drafts[composeDraftKey('Me', 'bob', 'mail-1')]
    expect(reply.replyTo).toEqual({ id: 'mail-1', user: 'bob' })
    expect(describeDraftTarget(reply)).toBe('Reply to bob')
  })

  it('leaves a plain mail draft as mail', () => {
    saveComposeDraft(address, composeDraftKey('thread', 'bob'), { ...base, fromName: 'thread', toName: 'bob' })
    originalRewrite()
    const draft = readComposeDrafts(address)[composeDraftKey('thread', 'bob')]
    expect(draft.kind).toBeUndefined()
    expect(draft.replyTo).toBeUndefined()
  })
})
