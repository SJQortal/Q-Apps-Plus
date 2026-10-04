import { describe, expect, it } from 'vitest'
import Quill from 'quill'
import { toPublishedMailHtml, toQuill1Html } from './quillHtml'

const UI = '<span class="ql-ui" contenteditable="false"></span>'

describe('toQuill1Html', () => {
  it('leaves Quill 1 and plain HTML untouched', () => {
    const quill1 = '<p>Hi <strong>there</strong></p><ul><li>a</li><li class="ql-indent-1">b</li></ul><ol><li>1</li></ol><pre class="ql-syntax" spellcheck="false">x\n</pre>'
    expect(toQuill1Html(quill1)).toBe(quill1)
    expect(toQuill1Html('')).toBe('')
    expect(toQuill1Html(undefined as any)).toBe(undefined)
  })

  it('turns Quill 2 bullet lists into <ul>', () => {
    const quill2 = `<ol><li data-list="bullet">${UI}one</li><li data-list="bullet" class="ql-indent-1">${UI}two</li></ol>`
    expect(toQuill1Html(quill2)).toBe('<ul><li>one</li><li class="ql-indent-1">two</li></ul>')
  })

  it('keeps ordered lists as <ol> and splits mixed runs', () => {
    const quill2 = `<p>x</p><ol><li data-list="ordered">${UI}1</li><li data-list="ordered">${UI}2</li><li data-list="bullet">${UI}b</li><li data-list="ordered">${UI}3</li></ol><p>y</p>`
    expect(toQuill1Html(quill2)).toBe('<p>x</p><ol><li>1</li><li>2</li></ol><ul><li>b</li></ul><ol><li>3</li></ol><p>y</p>')
  })

  it('maps checklists to Quill 1 data-checked lists', () => {
    const quill2 = `<ol><li data-list="checked">${UI}done</li><li data-list="unchecked">${UI}todo</li></ol>`
    expect(toQuill1Html(quill2)).toBe('<ul data-checked="true"><li>done</li></ul><ul data-checked="false"><li>todo</li></ul>')
  })

  it('turns Quill 2 code blocks into a single <pre class="ql-syntax">', () => {
    const quill2 = '<div class="ql-code-block-container" spellcheck="false"><div class="ql-code-block">const a = 1 &lt; 2</div><div class="ql-code-block">b()</div></div>'
    expect(toQuill1Html(quill2)).toBe('<pre class="ql-syntax" spellcheck="false">const a = 1 &lt; 2\nb()\n</pre>')
  })

  it('is idempotent', () => {
    const quill2 = `<ol><li data-list="bullet">${UI}one</li></ol>`
    const once = toQuill1Html(quill2)
    expect(toQuill1Html(once)).toBe(once)
  })

  it('keeps inline formatting, alignment, colours and links', () => {
    const quill2 = `<h1 class="ql-align-center">T</h1><p><span style="color: rgb(230, 0, 0);">red</span> <a href="qortal://APP/Q-Tube" rel="noopener noreferrer" target="_blank">link</a> <sub>s</sub></p><ol><li data-list="bullet">${UI}<em>i</em></li></ol>`
    expect(toQuill1Html(quill2)).toBe('<h1 class="ql-align-center">T</h1><p><span style="color: rgb(230, 0, 0);">red</span> <a href="qortal://APP/Q-Tube" rel="noopener noreferrer" target="_blank">link</a> <sub>s</sub></p><ul><li><em>i</em></li></ul>')
  })
})

/** What the composer hands to publish: the editor's own HTML for `ops`. */
function editorHtml(ops: any[]): string {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const quill = new Quill(host, { theme: 'snow' })
  quill.setContents(ops as any)
  const html = quill.root.innerHTML
  host.remove()
  return html
}

describe('toPublishedMailHtml (textContentV2 as published)', () => {
  it('publishes plain spaces, not &nbsp; (Quill 2 semantic HTML)', () => {
    expect(toPublishedMailHtml('<p>Hello&nbsp;there,&nbsp;friend</p>')).toBe('<p>Hello there, friend</p>')
    expect(toPublishedMailHtml('<p><strong>bold</strong>&nbsp;and&nbsp;<em>it</em></p>')).toBe('<p><strong>bold</strong> and <em>it</em></p>')
  })

  it('keeps one &nbsp; between spaces in runs of two or more, as Quill 1 mail has', () => {
    expect(toPublishedMailHtml('<p>a&nbsp;&nbsp;b</p>')).toBe('<p>a &nbsp;b</p>')
    expect(toPublishedMailHtml('<p>a   b</p>')).toBe('<p>a &nbsp; b</p>')
    // A line of spaces only stays visible.
    expect(toPublishedMailHtml('<p>&nbsp;</p>')).toBe('<p>&nbsp;</p>')
  })

  it('a plain paragraph with single spaces is left exactly as it is', () => {
    expect(toPublishedMailHtml('<p>Hello there</p>')).toBe('<p>Hello there</p>')
  })

  it('a long line wraps: no non-breaking spaces at all', () => {
    const words = Array.from({ length: 80 }, (_, i) => `word${i}`).join(' ')
    const published = toPublishedMailHtml(editorHtml([{ insert: `${words}\n` }]))
    expect(published).toBe(`<p>${words}</p>`)
    expect(published).not.toMatch(/&nbsp;|\u00a0/)
    expect(toPublishedMailHtml(`<p>${words.replace(/ /g, '&nbsp;')}</p>`)).toBe(`<p>${words}</p>`)
  })

  it('bullet list, exactly as published', () => {
    const html = editorHtml([
      { insert: 'first point' }, { insert: '\n', attributes: { list: 'bullet' } },
      { insert: 'a sub point' }, { insert: '\n', attributes: { list: 'bullet', indent: 1 } },
      { insert: 'second point' }, { insert: '\n', attributes: { list: 'bullet' } },
    ])
    expect(toPublishedMailHtml(html)).toBe(
      '<ul><li>first point</li><li class="ql-indent-1">a sub point</li><li>second point</li></ul>'
    )
  })

  it('numbered list, exactly as published', () => {
    const html = editorHtml([
      { insert: 'Intro line\n' },
      { insert: 'step one' }, { insert: '\n', attributes: { list: 'ordered' } },
      { insert: 'step two' }, { insert: '\n', attributes: { list: 'ordered' } },
    ])
    expect(toPublishedMailHtml(html)).toBe('<p>Intro line</p><ol><li>step one</li><li>step two</li></ol>')
  })

  it('code block, exactly as published (indentation kept as plain spaces)', () => {
    const html = editorHtml([
      { insert: 'if (a < b) {' }, { insert: '\n', attributes: { 'code-block': true } },
      { insert: '  run(a, b)' }, { insert: '\n', attributes: { 'code-block': true } },
      { insert: '}' }, { insert: '\n', attributes: { 'code-block': true } },
    ])
    expect(toPublishedMailHtml(html)).toBe(
      '<pre class="ql-syntax" spellcheck="false">if (a &lt; b) {\n  run(a, b)\n}\n</pre>'
    )
    // A code line typed with browser non-breaking spaces still publishes plain ones.
    expect(
      toPublishedMailHtml('<div class="ql-code-block-container" spellcheck="false"><div class="ql-code-block">&nbsp;&nbsp;x()</div></div>')
    ).toBe('<pre class="ql-syntax" spellcheck="false">  x()\n</pre>')
  })

  it('blank lines, inline formatting and the reply quote keep the Quill 1 shape', () => {
    const html = editorHtml([
      { insert: 'Thanks, see below.\n\n' },
      { insert: 'bold', attributes: { bold: true } }, { insert: ' and ' },
      { insert: 'a link', attributes: { link: 'https://example.org' } }, { insert: '\n' },
      { insert: 'On 1 Oct, Alice wrote:\n' },
      { insert: 'the original' }, { insert: '\n', attributes: { blockquote: true } },
    ])
    expect(toPublishedMailHtml(html)).toBe(
      '<p>Thanks, see below.</p><p><br></p><p><strong>bold</strong> and <a href="https://example.org" rel="noopener noreferrer" target="_blank">a link</a></p><p>On 1 Oct, Alice wrote:</p><blockquote>the original</blockquote>'
    )
    // Quill 2 semantic HTML's empty line.
    expect(toPublishedMailHtml('<p>a</p><p></p><p>b</p>')).toBe('<p>a</p><p><br></p><p>b</p>')
  })

  it('drops a pending-format cursor span', () => {
    expect(toPublishedMailHtml('<p>Hi <strong><span class="ql-cursor">\uFEFF</span></strong></p>')).toBe('<p>Hi <strong></strong></p>')
  })

  it('is idempotent and leaves display conversion (toQuill1Html) alone', () => {
    const once = toPublishedMailHtml('<p>a&nbsp;&nbsp;&nbsp;b&nbsp;c</p>')
    expect(once).toBe('<p>a &nbsp; b c</p>')
    expect(toPublishedMailHtml(once)).toBe(once)
    expect(toQuill1Html('<p>a&nbsp;b</p>')).toBe('<p>a&nbsp;b</p>')
  })
})
