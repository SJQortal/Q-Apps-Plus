import { describe, expect, it } from 'vitest'
import {
  aliasMailIdentifier,
  buildDirectMailObject,
  buildForwardHeaderHtml,
  buildReplyQuoteHtml,
  buildReplyThreadV2,
  directMailIdentifier,
  escapeHtml,
  htmlToTextLines,
  messageBodyLines,
  quoteLinesToHtml,
  replyAllRecipients,
  stripEmbeddedHistory,
  withSubjectPrefix,
} from './mailCompose'

describe('withSubjectPrefix', () => {
  it('adds Re: and Fwd: once', () => {
    expect(withSubjectPrefix('Hello', 'Re')).toBe('Re: Hello')
    expect(withSubjectPrefix('Hello', 'Fwd')).toBe('Fwd: Hello')
  })
  it('does not stack prefixes, whatever the case or spacing', () => {
    expect(withSubjectPrefix('Re: Hello', 'Re')).toBe('Re: Hello')
    expect(withSubjectPrefix('RE:Hello', 'Re')).toBe('RE:Hello')
    expect(withSubjectPrefix('  re : Hello', 'Re')).toBe('re : Hello')
    expect(withSubjectPrefix('Fwd: Hello', 'Fwd')).toBe('Fwd: Hello')
    expect(withSubjectPrefix('FW: Hello', 'Fwd')).toBe('FW: Hello')
  })
  it('swaps a Fwd: for a Re: when replying to a forward, and vice versa', () => {
    expect(withSubjectPrefix('Fwd: Hello', 'Re')).toBe('Re: Hello')
    expect(withSubjectPrefix('Re: Hello', 'Fwd')).toBe('Fwd: Hello')
  })
  it('copes with empty and non-string subjects', () => {
    expect(withSubjectPrefix('', 'Re')).toBe('Re:')
    expect(withSubjectPrefix(undefined, 'Fwd')).toBe('Fwd:')
  })
})

describe('escapeHtml', () => {
  it('really escapes (Bugs #16)', () => {
    expect(escapeHtml(`<b>&"'`)).toBe('&lt;b&gt;&amp;&quot;&#39;')
    expect(escapeHtml(undefined)).toBe('')
  })
})

describe('htmlToTextLines', () => {
  it('breaks on <br> and block ends, drops tags, decodes entities', () => {
    const html = '<p>Hi <b>there</b></p><p><br></p><p>Line &amp; two<br>three</p><ul><li>a</li><li>b</li></ul>'
    expect(htmlToTextLines(html)).toEqual(['Hi there', '', 'Line & two', 'three', '• a', '• b'])
  })
  it('trims leading and trailing blank lines and collapses long blank runs', () => {
    expect(htmlToTextLines('<p><br></p><p><br></p><p>x</p><p><br></p><p><br></p><p>y</p><p><br></p>')).toEqual([
      'x',
      '',
      'y',
    ])
  })
  it('handles non-strings', () => {
    expect(htmlToTextLines(undefined)).toEqual([])
    expect(htmlToTextLines(42)).toEqual([])
  })
})

describe('messageBodyLines', () => {
  it('prefers textContentV2, then Slate textContent, then htmlContent', () => {
    expect(messageBodyLines({ textContentV2: '<p>v2</p>', htmlContent: '<p>old</p>' })).toEqual(['v2'])
    expect(messageBodyLines({ textContent: [{ type: 'paragraph' }] }, () => 'slate text')).toEqual(['slate text'])
    expect(messageBodyLines({ textContent: 'plain\ntext' })).toEqual(['plain', 'text'])
    expect(messageBodyLines({ htmlContent: '<p>html</p>' })).toEqual(['html'])
    expect(messageBodyLines(null)).toEqual([])
  })
})

describe('quoteLinesToHtml / buildReplyQuoteHtml', () => {
  it('emits one Quill 1 blockquote per line with escaped text', () => {
    expect(quoteLinesToHtml(['a <b>', '', 'c'])).toBe(
      '<blockquote>a &lt;b&gt;</blockquote><blockquote><br></blockquote><blockquote>c</blockquote>'
    )
  })
  it('caps very long quotes', () => {
    const html = quoteLinesToHtml(['1', '2', '3'], 2)
    expect(html).toBe('<blockquote>1</blockquote><blockquote>2</blockquote><blockquote>[…]</blockquote>')
  })
  it('starts with an empty paragraph to type in, then the intro and the quote', () => {
    const html = buildReplyQuoteHtml({ sender: 'Ali <x>', sentAt: '2026-10-01 10:00:00', lines: ['hello'] })
    expect(html).toBe(
      '<p><br></p><p>On 2026-10-01 10:00:00, Ali &lt;x&gt; wrote:</p><blockquote>hello</blockquote>'
    )
    expect(buildReplyQuoteHtml({ lines: [] })).toContain('- no message body -')
  })
})

describe('buildForwardHeaderHtml', () => {
  it('escapes every field and keeps the original header shape', () => {
    const html = buildForwardHeaderHtml({ from: 'A<', subject: 'S & T', to: 'Me', sentAt: 'today' })
    expect(html).toBe(
      '<p>---------- Forwarded message ---------</p><p>From: A&lt;</p><p>Date: today</p><p>Subject: S &amp; T</p><p>To: Me</p><p><br></p>'
    )
  })
})

const original = {
  id: 'id-1',
  user: 'Ali',
  subject: 'Hi',
  createdAt: 100,
  attachments: [],
  textContentV2: '<p>first</p>',
  generalData: {
    thread: [],
    threadV2: [
      {
        reference: { identifier: 'id-0', name: 'Bob', service: 'MAIL_PRIVATE' },
        data: {
          id: 'id-0',
          user: 'Bob',
          createdAt: 50,
          textContentV2: '<p>zero</p>',
          generalData: { thread: [], threadV2: [{ reference: {}, data: { id: 'deep' } }] },
        },
      },
      {
        reference: { identifier: 'id-1', name: 'Ali', service: 'MAIL_PRIVATE' },
        data: { markedAsReadLocally: true, createdAt: 60 },
      },
    ],
  },
  recipient: 'Bob',
  isValid: true,
}

describe('embedded reply history (Bugs #12)', () => {
  it('stripEmbeddedHistory drops generalData and nothing else', () => {
    const stripped = stripEmbeddedHistory(original)
    expect(stripped.generalData).toBeUndefined()
    expect(stripped).toMatchObject({ id: 'id-1', user: 'Ali', subject: 'Hi', createdAt: 100, textContentV2: '<p>first</p>', isValid: true })
    expect(stripEmbeddedHistory(null)).toBeNull()
  })

  it('buildReplyThreadV2 keeps the order, strips nested history and drops local read markers', () => {
    const thread = buildReplyThreadV2(original, 'MAIL_PRIVATE')
    expect(thread).toHaveLength(2)
    expect(thread[0].reference).toEqual({ identifier: 'id-0', name: 'Bob', service: 'MAIL_PRIVATE' })
    expect(thread[0].data).toEqual({ id: 'id-0', user: 'Bob', createdAt: 50, textContentV2: '<p>zero</p>' })
    expect(thread[1].reference).toEqual({ identifier: 'id-1', name: 'Ali', service: 'MAIL_PRIVATE' })
    expect(thread[1].data.generalData).toBeUndefined()
    expect(thread[1].data.user).toBe('Ali')
    expect(JSON.stringify(thread)).not.toContain('markedAsReadLocally')
    expect(JSON.stringify(thread)).not.toContain('deep')
  })

  it('the payload no longer grows geometrically', () => {
    let message: any = { id: 'm0', user: 'A', createdAt: 1, textContentV2: '<p>x</p>', generalData: { thread: [], threadV2: [] } }
    const sizes: number[] = []
    for (let hop = 1; hop <= 6; hop += 1) {
      const next = buildDirectMailObject({
        subject: 'Re: x',
        createdAt: hop + 1,
        attachments: [],
        textContentV2: '<p>y</p>',
        recipient: 'B',
        replyTo: message,
        service: 'MAIL_PRIVATE',
      })
      sizes.push(JSON.stringify(next).length)
      message = { ...next, id: `m${hop}`, user: hop % 2 ? 'B' : 'A' }
    }
    // linear growth: each hop adds about one stripped message
    const deltas = sizes.slice(1).map((size, i) => size - sizes[i])
    const spread = Math.max(...deltas) - Math.min(...deltas)
    expect(spread).toBeLessThan(40)
    expect(sizes[5]).toBeLessThan(sizes[0] * 8)
  })
})

describe('buildDirectMailObject', () => {
  it('writes the binding fields plus additive to/cc', () => {
    const mail = buildDirectMailObject({
      subject: 'S',
      createdAt: 123,
      attachments: [{ identifier: 'a', name: 'n', service: 'ATTACHMENT_PRIVATE' }],
      textContentV2: '<p>b</p>',
      recipient: 'Bob',
      service: 'MAIL_PRIVATE',
    })
    expect(mail).toEqual({
      subject: 'S',
      createdAt: 123,
      version: 1,
      attachments: [{ identifier: 'a', name: 'n', service: 'ATTACHMENT_PRIVATE' }],
      textContentV2: '<p>b</p>',
      generalData: { thread: [], threadV2: [] },
      recipient: 'Bob',
      to: ['Bob'],
      cc: [],
    })
  })
  it('appends the reply history only for replies', () => {
    const mail = buildDirectMailObject({
      subject: 'Re: Hi',
      createdAt: 200,
      attachments: [],
      textContentV2: '<p>r</p>',
      recipient: 'Ali',
      replyTo: original,
      service: 'MAIL_PRIVATE',
    })
    expect(mail.generalData.threadV2).toHaveLength(2)
    expect(mail.generalData.threadV2[1].data.id).toBe('id-1')
  })
})

describe('identifiers (binding)', () => {
  it('match the original builders exactly', () => {
    expect(directMailIdentifier('averyveryverylongname12345', 'QabcdefXYZ123', 'sid')).toBe(
      '_mail_qortal_qmail_averyveryverylongnam_XYZ123_mail_sid'
    )
    expect(aliasMailIdentifier('my alias_x', 'sid')).toBe('_mail_qortal_qmail_my alias_x_mail_sid')
  })
})

describe('replyAllRecipients', () => {
  it('is the sender plus to/cc minus own names, deduped, sender first', () => {
    const result = replyAllRecipients(
      { user: 'Ali', to: ['Me', 'Carl', 'ali'], cc: ['dana', 'Carl', 'MyAlias'] },
      ['me', 'MyAlias']
    )
    expect(result).toEqual({ to: 'Ali', others: ['Carl', 'dana'] })
  })
  it('works for mail from the original app (no to/cc)', () => {
    expect(replyAllRecipients({ user: 'Ali' }, ['Me'])).toEqual({ to: 'Ali', others: [] })
  })
})
