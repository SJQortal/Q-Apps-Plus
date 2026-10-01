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
