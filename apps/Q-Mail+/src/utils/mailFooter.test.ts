import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  MAIL_FOOTER_CHANGED_EVENT,
  MAIL_FOOTER_MAX_LENGTH,
  applyPublishedFooter,
  buildNewMessageBody,
  emptyMailFooter,
  footerBlockFor,
  footerTextForName,
  footerTextToHtml,
  isMailFooterEmpty,
  mailFooterStorageKey,
  normalizeFooterText,
  normalizeMailFooter,
  readMailFooter,
  swapFooterInBody,
  writeMailFooter,
} from './mailFooter'

const address = 'QFooterAddress'

describe('mail footer storage', () => {
  beforeEach(() => localStorage.clear())

  it('uses qmail_footer_<address> and the documented JSON shape', () => {
    expect(mailFooterStorageKey(address)).toBe('qmail_footer_QFooterAddress')
    expect(mailFooterStorageKey('')).toBe('')
    writeMailFooter(address, { default: 'Simon\r\nqortal://APP/Q-Mail+  \n\n', byName: { Work: 'Simon at work', Empty: '  ' }, inReplies: false })
    expect(JSON.parse(localStorage.getItem('qmail_footer_QFooterAddress')!)).toEqual({
      default: 'Simon\nqortal://APP/Q-Mail+',
      byName: { Work: 'Simon at work' },
      inReplies: false,
    })
    expect(readMailFooter(address)).toEqual({
      default: 'Simon\nqortal://APP/Q-Mail+',
      byName: { Work: 'Simon at work' },
      inReplies: false,
    })
  })

  it('reads an empty footer (replies on) when nothing or something broken is stored', () => {
    expect(readMailFooter(address)).toEqual(emptyMailFooter())
    expect(emptyMailFooter().inReplies).toBe(true)
    localStorage.setItem('qmail_footer_QFooterAddress', '{nope')
    expect(readMailFooter(address)).toEqual(emptyMailFooter())
    localStorage.setItem('qmail_footer_QFooterAddress', '[]')
    expect(readMailFooter(address)).toEqual(emptyMailFooter())
    expect(readMailFooter('')).toEqual(emptyMailFooter())
  })

  it('announces a write so an open Settings page can reload', () => {
    const listener = vi.fn()
    window.addEventListener(MAIL_FOOTER_CHANGED_EVENT, listener)
    writeMailFooter(address, { default: 'x', byName: {}, inReplies: true })
    window.removeEventListener(MAIL_FOOTER_CHANGED_EVENT, listener)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('applies a published footer only when this device has never set one', () => {
    const published = { default: 'From QDN', byName: {}, inReplies: false }
    expect(applyPublishedFooter(address, emptyMailFooter())).toBe(false)
    expect(applyPublishedFooter(address, published)).toBe(true)
    expect(readMailFooter(address).default).toBe('From QDN')

    writeMailFooter(address, { default: 'Mine', byName: {}, inReplies: true })
    expect(applyPublishedFooter(address, { ...published, default: 'Other' })).toBe(false)
    expect(readMailFooter(address)).toEqual({ default: 'Mine', byName: {}, inReplies: true })
  })

  it('keeps a cleared footer cleared: the published one does not come back', () => {
    const published = { default: 'From QDN', byName: { Bob: 'Bob' }, inReplies: true }
    writeMailFooter(address, { default: 'Mine', byName: {}, inReplies: true })
    // Settings → Footer emptied: the key stays, holding an empty footer.
    writeMailFooter(address, { default: '', byName: {}, inReplies: true })
    expect(applyPublishedFooter(address, published)).toBe(false)
    expect(isMailFooterEmpty(readMailFooter(address))).toBe(true)
    // The switch alone set on this device also counts as a local choice.
    localStorage.clear()
    writeMailFooter(address, { default: '', byName: {}, inReplies: false })
    expect(applyPublishedFooter(address, published)).toBe(false)
    expect(readMailFooter(address)).toEqual({ default: '', byName: {}, inReplies: false })
  })
})

describe('mail footer text', () => {
  it('normalises line endings, trailing spaces, outer blank lines and length', () => {
    expect(normalizeFooterText('\n\n  Simon  \r\n\r\nQortal\n\n')).toBe('  Simon\n\nQortal')
    expect(normalizeFooterText(42)).toBe('')
    expect(normalizeFooterText('a'.repeat(MAIL_FOOTER_MAX_LENGTH + 10))).toHaveLength(MAIL_FOOTER_MAX_LENGTH)
  })

  it('normalises an object: per-name footers deduped case-insensitively, empty ones dropped', () => {
    expect(normalizeMailFooter(null)).toBeNull()
    expect(normalizeMailFooter('x')).toBeNull()
    expect(normalizeMailFooter({ default: 'D', byName: { Bob: 'B1', bob: 'B2', ' ': 'x', Ann: '' } })).toEqual({
      default: 'D',
      byName: { Bob: 'B1' },
      inReplies: true,
    })
    expect(isMailFooterEmpty(emptyMailFooter())).toBe(true)
    expect(isMailFooterEmpty({ default: '', byName: { a: 'b' }, inReplies: true })).toBe(false)
  })

  it("uses the name's own footer, else the default", () => {
    const footer = { default: 'Default', byName: { Work: 'Work footer' }, inReplies: true }
    expect(footerTextForName(footer, 'work')).toBe('Work footer')
    expect(footerTextForName(footer, 'home')).toBe('Default')
    expect(footerTextForName(footer, '')).toBe('Default')
  })

  it('turns text into Quill 1 paragraphs, escaped as the editor serialises, links left as text', () => {
    expect(footerTextToHtml('')).toBe('')
    expect(footerTextToHtml('Simon & "Co" <me>\n\nqortal://APP/Q-Mail+')).toBe(
      '<p>Simon &amp; "Co" &lt;me&gt;</p><p><br></p><p>qortal://APP/Q-Mail+</p>'
    )
    expect(footerTextToHtml('<script>alert(1)</script>')).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>')
  })
})

describe('footer blocks in the body', () => {
  const footer = { default: 'Simon', byName: { Work: 'Simon\nWork' }, inReplies: true }

  it('builds a new message body: a line to type on, then the footer', () => {
    expect(buildNewMessageBody(footerBlockFor(footer, 'me', 'new'))).toBe('<p><br></p><p>Simon</p>')
    expect(buildNewMessageBody(footerBlockFor(emptyMailFooter(), 'me', 'new'))).toBe('')
  })

  it('adds a blank line after the footer of a reply or forward, and nothing when replies are off', () => {
    expect(footerBlockFor(footer, 'work', 'reply')).toBe('<p>Simon</p><p>Work</p><p><br></p>')
    expect(footerBlockFor(footer, 'me', 'forward')).toBe('<p>Simon</p><p><br></p>')
    expect(footerBlockFor({ ...footer, inReplies: false }, 'me', 'reply')).toBe('')
    expect(footerBlockFor({ ...footer, inReplies: false }, 'me', 'new')).toBe('<p>Simon</p>')
  })

  it('swaps the footer of a new message at the end, and only if it is still as inserted', () => {
    const body = '<p>Hello</p><p>Simon</p>'
    expect(swapFooterInBody(body, '<p>Simon</p>', '<p>Simon</p><p>Work</p>', 'new', false)).toBe(
      '<p>Hello</p><p>Simon</p><p>Work</p>'
    )
    expect(swapFooterInBody('<p>Hello</p><p>Simon!</p>', '<p>Simon</p>', '<p>X</p>', 'new', false)).toBeNull()
    expect(swapFooterInBody(body, '<p>Simon</p>', '', 'new', false)).toBe('<p>Hello</p>')
    expect(swapFooterInBody(body, '<p>Simon</p>', '<p>Simon</p>', 'new', false)).toBe(body)
  })

  it('adds a footer to a body that had none only while it is untouched', () => {
    expect(swapFooterInBody('', '', '<p>Simon</p>', 'new', true)).toBe('<p><br></p><p>Simon</p>')
    expect(swapFooterInBody('<p><br></p>', '', '<p>Simon</p>', 'new', true)).toBe('<p><br></p><p>Simon</p>')
    expect(swapFooterInBody('<p>Hi</p>', '', '<p>Simon</p>', 'new', false)).toBeNull()
    const reply = '<p><br></p><p>alice wrote:</p><blockquote>x</blockquote>'
    expect(swapFooterInBody(reply, '', '<p>Simon</p><p><br></p>', 'reply', true)).toBe(
      '<p><br></p><p>Simon</p><p><br></p><p>alice wrote:</p><blockquote>x</blockquote>'
    )
    expect(swapFooterInBody(reply, '', '<p>Simon</p><p><br></p>', 'reply', false)).toBeNull()
  })

  it('swaps the footer of a reply in place, above the quote', () => {
    const reply = '<p>Thanks</p><p>Simon</p><p><br></p><p>alice wrote:</p><blockquote>Simon</blockquote>'
    expect(swapFooterInBody(reply, '<p>Simon</p><p><br></p>', '<p>W</p><p><br></p>', 'reply', false)).toBe(
      '<p>Thanks</p><p>W</p><p><br></p><p>alice wrote:</p><blockquote>Simon</blockquote>'
    )
  })
})
