import { describe, expect, it } from 'vitest'
import { toQuill1Html } from './quillHtml'

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
