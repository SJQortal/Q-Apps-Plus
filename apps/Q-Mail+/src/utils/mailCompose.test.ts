import { describe, expect, it } from 'vitest'
import {
  aliasMailIdentifier,
  buildDirectMailObject,
  buildDirectMailPublishRequest,
  buildForwardHeaderHtml,
  buildForwardHtml,
  buildReplyThreadV2,
  REPLY_HISTORY_MAX_REFERENCES,
  directMailIdentifier,
  escapeHtml,
  htmlToTextLines,
  messageBodyLines,
  quoteLinesToHtml,
  recipientActivityByName,
  replyAllRecipients,
  replyFromOwnName,
  sortNamesByRecency,
  uniqueCopyRecipients,
  withSubjectPrefix,
} from './mailCompose'
import { buildNewMessageBody, footerBlockFor } from './mailFooter'
import { toPublishedMailHtml } from '../components/common/TextEditor/quillHtml'

describe('recipient recency', () => {
  const inbox = [
    { user: 'Ali', createdAt: 300 },
    { user: 'Bob', createdAt: 100 },
    { user: 'ali', createdAt: 200 },
  ]
  const opened = {
    sent1: { user: 'Me', recipient: 'Carl', createdAt: 250 },
    sent2: { user: 'me-work', recipient: 'Bob', to: ['Bob'], createdAt: 400 },
    junk: { user: 'Dana' },
  }

  it('takes the newest timestamp per correspondent, from either direction', () => {
    const activity = recipientActivityByName(inbox, opened, ['Me', 'me-work'])
    expect(activity.get('ali')).toBe(300)
    expect(activity.get('bob')).toBe(400)
    expect(activity.get('carl')).toBe(250)
    expect(activity.has('me')).toBe(false)
    expect(activity.has('dana')).toBe(false)
  })

  it('orders names by recency, then alphabetically for the unseen', () => {
    const activity = recipientActivityByName(inbox, opened, ['Me', 'me-work'])
    expect(sortNamesByRecency(['Zed', 'Ali', 'Bob', 'Carl', 'Amy'], activity)).toEqual([
      'Bob',
      'Ali',
      'Carl',
      'Amy',
      'Zed',
    ])
  })
})

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

describe('quoteLinesToHtml (forwards)', () => {
  it('emits one Quill 1 blockquote per line with escaped text', () => {
    expect(quoteLinesToHtml(['a <b>', '', 'c'])).toBe(
      '<blockquote>a &lt;b&gt;</blockquote><blockquote><br></blockquote><blockquote>c</blockquote>'
    )
  })
  it('caps very long quotes', () => {
    const html = quoteLinesToHtml(['1', '2', '3'], 2)
    expect(html).toBe('<blockquote>1</blockquote><blockquote>2</blockquote><blockquote>[…]</blockquote>')
  })
})

describe('the footer in the published body (textContentV2)', () => {
  const footer = { default: 'Simon & co\n\nqortal://APP/Q-Mail+', byName: { work: 'Simon at work' }, inReplies: true }
  const footerHtml = '<p>Simon &amp; co</p><p><br></p><p>qortal://APP/Q-Mail+</p>'

  it('a new message: a line to type on, then the footer paragraphs', () => {
    const body = buildNewMessageBody(footerBlockFor(footer, 'simon', 'new'))
    expect(toPublishedMailHtml(body)).toBe(`<p><br></p>${footerHtml}`)
    expect(toPublishedMailHtml(`<p>Hello</p>${footerHtml}`)).toBe(`<p>Hello</p>${footerHtml}`)
  })

  it('a reply: a line to type on, then the footer, and no quote of the original', () => {
    const body = buildNewMessageBody(footerBlockFor(footer, 'Work', 'reply'))
    expect(toPublishedMailHtml(body)).toBe('<p><br></p><p>Simon at work</p>')
  })

  it('a forward: the footer and a blank line above the forward header', () => {
    const html = buildForwardHtml(
      { from: 'Ali', subject: 'S', to: 'Me' },
      ['hello'],
      footerBlockFor(footer, 'simon', 'forward')
    )
    expect(toPublishedMailHtml(html)).toBe(
      `<p><br></p>${footerHtml}<p><br></p><p>---------- Forwarded message ---------</p><p>From: Ali</p><p>Subject: S</p><p>To: Me</p><p><br></p><blockquote>hello</blockquote>`
    )
  })

  it('no footer when it is empty or switched off for replies: the bodies are exactly as before', () => {
    const empty = { default: '', byName: {}, inReplies: true }
    expect(buildNewMessageBody(footerBlockFor(empty, 'simon', 'new'))).toBe('')
    expect(buildNewMessageBody(footerBlockFor({ ...footer, inReplies: false }, 'simon', 'reply'))).toBe('')
    expect(buildForwardHtml({ from: 'Ali', subject: 'S', to: 'Me' }, ['x'], footerBlockFor(empty, 'simon', 'forward'))).toBe(
      buildForwardHtml({ from: 'Ali', subject: 'S', to: 'Me' }, ['x'])
    )
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

describe('reply history: references only (1.0.1)', () => {
  it('buildReplyThreadV2 keeps the order and the reference shape, drops copies and local read markers', () => {
    const thread = buildReplyThreadV2(original, 'MAIL_PRIVATE')
    expect(thread).toEqual([
      { reference: { identifier: 'id-0', name: 'Bob', service: 'MAIL_PRIVATE' } },
      { reference: { identifier: 'id-1', name: 'Ali', service: 'MAIL_PRIVATE' } },
    ])
    expect(JSON.stringify(thread)).not.toContain('"data"')
    expect(JSON.stringify(thread)).not.toContain('zero')
    expect(JSON.stringify(thread)).not.toContain('deep')
  })

  it('takes the reference of an embedded copy that has none from its id and user, and skips repeats', () => {
    const replyTo = {
      id: 'm3',
      user: 'Ali',
      generalData: {
        threadV2: [
          { data: { id: 'm1', user: 'Bob', textContentV2: '<p>old</p>' } },
          { reference: { identifier: 'm1', name: 'bob', service: 'MAIL_PRIVATE' } },
          { reference: { identifier: 'm2', name: 'Ali' } },
          { reference: { identifier: 'x', name: 'Ali', service: 'MAIL' } },
          { reference: { identifier: 'm3', name: 'Ali', service: 'MAIL_PRIVATE' } },
          { data: { subject: 'no id' } },
          null,
        ],
      },
    }
    expect(buildReplyThreadV2(replyTo, 'MAIL_PRIVATE').map(entry => entry.reference.identifier)).toEqual(['m1', 'm2', 'm3'])
  })

  it(`keeps the newest ${REPLY_HISTORY_MAX_REFERENCES} references, the replied-to message last`, () => {
    const replyTo = {
      id: 'last',
      user: 'Ali',
      generalData: { threadV2: Array.from({ length: 30 }, (_, i) => ({ reference: { identifier: `m${i}`, name: 'Bob', service: 'MAIL_PRIVATE' } })) },
    }
    const thread = buildReplyThreadV2(replyTo, 'MAIL_PRIVATE')
    expect(REPLY_HISTORY_MAX_REFERENCES).toBe(10)
    expect(thread).toHaveLength(REPLY_HISTORY_MAX_REFERENCES)
    expect(thread[0].reference.identifier).toBe('m21')
    expect(thread[thread.length - 1].reference).toEqual({ identifier: 'last', name: 'Ali', service: 'MAIL_PRIVATE' })
  })

  it('a reply no longer grows with the conversation', () => {
    const body = (hop: number) => `<p>${`reply ${hop} `.repeat(30)}</p>`
    let message: any = { id: 'm0', user: 'A', createdAt: 1, textContentV2: body(0), generalData: { thread: [], threadV2: [] } }
    const sizes: number[] = []
    for (let hop = 1; hop <= 50; hop += 1) {
      const next = buildDirectMailObject({
        subject: 'Re: x',
        createdAt: hop + 1,
        attachments: [],
        textContentV2: body(hop),
        recipient: 'B',
        replyTo: message,
        service: 'MAIL_PRIVATE',
      })
      sizes.push(JSON.stringify(next).length)
      message = { ...next, id: `_mail_qortal_qmail_B_abc123_mail_${hop}`, user: hop % 2 ? 'B' : 'A' }
    }
    // Only references grow, until the cap: then not at all.
    expect(sizes[49]).toBe(sizes[39])
    expect(sizes[49]).toBeLessThan(3000)
    expect(JSON.stringify(message)).not.toContain('reply 1 ')
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
  it('appends the reply history references only for replies', () => {
    const mail = buildDirectMailObject({
      subject: 'Re: Hi',
      createdAt: 200,
      attachments: [],
      textContentV2: '<p>r</p>',
      recipient: 'Ali',
      replyTo: original,
      service: 'MAIL_PRIVATE',
    })
    expect(mail.generalData).toEqual({
      thread: [],
      threadV2: [
        { reference: { identifier: 'id-0', name: 'Bob', service: 'MAIL_PRIVATE' } },
        { reference: { identifier: 'id-1', name: 'Ali', service: 'MAIL_PRIVATE' } },
      ],
    })
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

describe('replyFromOwnName', () => {
  it('replies from the own name the mail was sent to, spelt as we own it', () => {
    const own = ['Simon James', 'POS+', 'MA\'s']
    expect(replyFromOwnName({ user: 'Ali', recipient: 'pos+' }, own)).toBe('POS+')
    expect(replyFromOwnName({ user: 'Ali', recipient: 'Simon James' }, own)).toBe('Simon James')
  })
  it('is null for mail to someone else, without a recipient, or to a name we no longer own', () => {
    const own = ['Simon James', 'POS+']
    expect(replyFromOwnName({ user: 'POS+', recipient: 'Ali' }, own)).toBeNull()
    expect(replyFromOwnName({ user: 'Ali' }, own)).toBeNull()
    expect(replyFromOwnName({ user: 'Ali', recipient: 'Sold Name' }, own)).toBeNull()
    expect(replyFromOwnName(null, own)).toBeNull()
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

describe('buildDirectMailPublishRequest (the whole publish, binding §3/§4)', () => {
  // A readable stand-in for objectToBase64: the test decodes it back.
  const encode = async (value: any) => `json:${JSON.stringify(value)}`
  const decode = (data64: string) => JSON.parse(data64.slice(5))
  const to = { name: 'Bob', address: 'QBOBaddr111111', publicKey: 'pkBob' }
  const carl = { name: 'Carl', address: 'QCARLaddr22222', publicKey: 'pkCarl' }
  const dana = { name: 'averyveryverylongname-dana', address: 'QDANAaddr33333', publicKey: 'pkDana' }
  const eve = { name: 'Eve', address: 'QEVEaddr444444', publicKey: 'pkEve' }
  const attachment = { name: 'Me', service: 'ATTACHMENT_PRIVATE', identifier: 'attachments_qmail_a_b', data64: 'AAA', filename: 'a.txt', originalFilename: 'x.txt', type: 'text/plain', size: 3 }
  const mail = {
    subject: 'Hello',
    createdAt: 1700000000000,
    attachments: [{ identifier: 'attachments_qmail_a_b', name: 'Me', service: 'ATTACHMENT_PRIVATE' }],
    textContentV2: '<p>Hi all</p>',
  }

  it('To, two Cc and one Bcc: order, identifiers, keys and the JSON of every copy', async () => {
    const request = await buildDirectMailPublishRequest({
      senderName: 'Me',
      service: 'MAIL_PRIVATE',
      sendId: 'SEND1',
      to,
      cc: [carl, dana],
      bcc: [eve],
      attachmentPublishes: [attachment],
      mail,
      encode,
    })
    expect(request.action).toBe('PUBLISH_MULTIPLE_QDN_RESOURCES')
    expect(request.encrypt).toBe(true)
    expect(request.publicKeys).toEqual(['pkBob', 'pkCarl', 'pkDana', 'pkEve'])
    expect(request.resources[0]).toBe(attachment)
    expect(request.resources.slice(1).map(r => r.identifier)).toEqual([
      '_mail_qortal_qmail_Bob_111111_mail_SEND1',
      '_mail_qortal_qmail_Carl_r22222_mail_SEND1',
      '_mail_qortal_qmail_averyveryverylongnam_r33333_mail_SEND1',
      '_mail_qortal_qmail_Eve_444444_mail_SEND1',
    ])
    request.resources.slice(1).forEach(resource => {
      expect(Object.keys(resource).sort()).toEqual(['action', 'data64', 'identifier', 'name', 'service'])
      expect(resource.action).toBe('PUBLISH_QDN_RESOURCE')
      expect(resource.name).toBe('Me')
      expect(resource.service).toBe('MAIL_PRIVATE')
    })
    const copies = request.resources.slice(1).map(r => decode(r.data64))
    expect(copies.map(c => c.recipient)).toEqual(['Bob', 'Carl', 'averyveryverylongname-dana', 'Eve'])
    copies.forEach(copy => {
      expect(copy).toEqual({
        subject: 'Hello',
        createdAt: 1700000000000,
        version: 1,
        attachments: mail.attachments,
        textContentV2: '<p>Hi all</p>',
        generalData: { thread: [], threadV2: [] },
        recipient: copy.recipient,
        to: ['Bob'],
        cc: ['Carl', 'averyveryverylongname-dana'],
      })
      // A Bcc name appears only as the recipient of its own copy.
      if (copy.recipient !== 'Eve') expect(JSON.stringify(copy)).not.toContain('Eve')
    })
  })

  it('no Cc and no Bcc is exactly the single-copy publish of before', async () => {
    const request = await buildDirectMailPublishRequest({
      senderName: 'Me', service: 'MAIL_PRIVATE', sendId: 'S', to, mail, encode,
    })
    expect(request.publicKeys).toEqual(['pkBob'])
    expect(request.resources).toHaveLength(1)
    expect(decode(request.resources[0].data64)).toMatchObject({ recipient: 'Bob', to: ['Bob'], cc: [] })
  })

  it('drops repeats: To in Cc, Cc in Bcc, a name twice', async () => {
    const request = await buildDirectMailPublishRequest({
      senderName: 'Me', service: 'MAIL_PRIVATE', sendId: 'S', to,
      cc: [{ ...to, name: 'bob' }, carl, { ...carl, name: ' CARL ' }],
      bcc: [carl, eve],
      mail, encode,
    })
    expect(request.publicKeys).toEqual(['pkBob', 'pkCarl', 'pkEve'])
    expect(request.resources.map(r => decode(r.data64).recipient)).toEqual(['Bob', 'Carl', 'Eve'])
    expect(decode(request.resources[2].data64).cc).toEqual(['Carl'])
    expect(uniqueCopyRecipients(to, [], [eve, eve]).bcc).toEqual([eve])
  })

  it('an alias send goes to the alias inbox only: no copies, no Cc names, Bcc keys kept', async () => {
    const request = await buildDirectMailPublishRequest({
      senderName: 'Me', service: 'MAIL_PRIVATE', sendId: 'S', to, aliasValue: 'secret box',
      cc: [carl], bcc: [eve], mail, encode,
    })
    expect(request.resources.map(r => r.identifier)).toEqual(['_mail_qortal_qmail_secret box_mail_S'])
    expect(decode(request.resources[0].data64)).toMatchObject({ recipient: 'Bob', to: ['Bob'], cc: [] })
    expect(request.publicKeys).toEqual(['pkBob', 'pkEve'])
  })

  it('a reply carries the history in every copy', async () => {
    const request = await buildDirectMailPublishRequest({
      senderName: 'Me', service: 'MAIL_PRIVATE', sendId: 'S', to, cc: [carl],
      mail: { ...mail, replyTo: original }, encode,
    })
    request.resources.forEach(resource => {
      const thread = decode(resource.data64).generalData.threadV2
      expect(thread).toHaveLength(2)
      expect(thread.every((entry: any) => !('data' in entry))).toBe(true)
    })
  })
})
