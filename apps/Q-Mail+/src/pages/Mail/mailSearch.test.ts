import { describe, expect, it } from 'vitest'
import {
  buildFullSearchText,
  buildMetaSearchText,
  extractBodyText,
  getSearchTerms,
  includesAllTerms,
  mailboxLabel,
  mailboxRefOf,
  mailboxTypeForRef,
  tagForMailbox,
} from './mailSearch'
import { highlightRuns } from './MailMessageRow'

describe('mailSearch rules', () => {
  it('lower-cases and splits the query; every term must match', () => {
    expect(getSearchTerms('  Hello   World ')).toEqual(['hello', 'world'])
    expect(includesAllTerms('hello there world', ['hello', 'world'])).toBe(true)
    expect(includesAllTerms('hello there', ['hello', 'world'])).toBe(false)
    expect(includesAllTerms('anything', [])).toBe(true)
  })

  it('reads Quill HTML, Slate textContentV2 and legacy Slate textContent bodies', () => {
    expect(extractBodyText({ textContentV2: '<p>Hello <b>bold</b>&nbsp;world</p>' })).toBe('Hello  bold  world')
    expect(extractBodyText({ textContentV2: [{ children: [{ text: 'slate v2' }] }] })).toBe('slate v2')
    expect(extractBodyText({ textContent: [{ children: [{ text: 'legacy slate' }] }] })).toBe('legacy slate')
    expect(extractBodyText({})).toBe('')
  })

  it('matches sender, subject, metadata and (for sent) the recipient label from the identifier', () => {
    const row = { id: '_mail_qortal_qmail_bob_abc123_mail_x1', user: 'alice', description: 'Invoice' }
    expect(buildMetaSearchText(row, 'inbox', 'Quarterly report')).toBe('alice quarterly report invoice')
    expect(buildMetaSearchText(row, 'sent')).toContain('bob')
    expect(buildMetaSearchText(row, 'sent')).toContain('address abc123')
    expect(buildFullSearchText(row, 'inbox', { subject: 'Hi', recipient: 'alice', textContentV2: '<p>body text</p>' })).toBe(
      'alice alice hi invoice body text'
    )
  })

  it('tags rows with their mailbox and labels them', () => {
    const tagged = tagForMailbox({ id: 'x' }, { kind: 'alias', alias: 'shop' })
    expect(mailboxRefOf(tagged)).toEqual({ kind: 'alias', alias: 'shop' })
    expect(mailboxRefOf({ id: 'x' })).toBeUndefined()
    expect(mailboxTypeForRef({ kind: 'sent' })).toBe('sent')
    expect(mailboxTypeForRef({ kind: 'alias' })).toBe('inbox')
    expect(mailboxLabel({ kind: 'alias', alias: 'shop' })).toBe('Alias · shop')
    expect(mailboxLabel({ kind: 'sent' })).toBe('Sent')
    expect(mailboxLabel({ kind: 'archived' })).toBe('Archived')
    expect(mailboxLabel({ kind: 'inbox', name: 'alice' })).toBe('Inbox · alice')
  })

  it('highlights every term, case-insensitively, longest first on ties', () => {
    expect(highlightRuns('Hello World', ['world'])).toEqual([
      { text: 'Hello ', hit: false },
      { text: 'World', hit: true },
    ])
    expect(highlightRuns('report reports', ['report', 'reports'])).toEqual([
      { text: 'report', hit: true },
      { text: ' ', hit: false },
      { text: 'reports', hit: true },
    ])
    expect(highlightRuns('nothing', ['zzz'])).toEqual([{ text: 'nothing', hit: false }])
    expect(highlightRuns('plain', [])).toEqual([{ text: 'plain', hit: false }])
  })
})
