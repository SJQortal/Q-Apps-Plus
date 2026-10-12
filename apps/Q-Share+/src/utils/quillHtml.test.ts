import { describe, expect, it } from 'vitest';
import { isQuillHtmlEmpty, normalizeQuillHtml } from './quillHtml';

describe('normalizeQuillHtml (Quill 2 → Quill 1 storage format)', () => {
  it('turns Quill 2 raw list markup into ul/ol like the original Q-Share stores', () => {
    const quill2 =
      '<ol><li data-list="bullet"><span class="ql-ui" contenteditable="false"></span>one</li>' +
      '<li data-list="bullet"><span class="ql-ui" contenteditable="false"></span>two</li>' +
      '<li data-list="ordered"><span class="ql-ui" contenteditable="false"></span>first</li></ol>';
    expect(normalizeQuillHtml(quill2)).toBe('<ul><li>one</li><li>two</li></ul><ol><li>first</li></ol>');
  });

  it('maps checklists to Quill 1 data-checked lists', () => {
    const quill2 = '<ol><li data-list="checked">done</li><li data-list="unchecked">todo</li></ol>';
    expect(normalizeQuillHtml(quill2)).toBe(
      '<ul data-checked="true"><li>done</li></ul><ul data-checked="false"><li>todo</li></ul>'
    );
  });

  it('keeps indent classes on list items', () => {
    const quill2 = '<ol><li data-list="bullet">a</li><li data-list="bullet" class="ql-indent-1">b</li></ol>';
    expect(normalizeQuillHtml(quill2)).toBe('<ul><li>a</li><li class="ql-indent-1">b</li></ul>');
  });

  it('turns Quill 2 code-block containers into pre.ql-syntax', () => {
    const quill2 =
      '<div class="ql-code-block-container" spellcheck="false"><div class="ql-code-block">const a = 1;</div>' +
      '<div class="ql-code-block">const b = 2;</div></div>';
    expect(normalizeQuillHtml(quill2)).toBe(
      '<pre class="ql-syntax" spellcheck="false">const a = 1;\nconst b = 2;\n</pre>'
    );
  });

  it('turns the bare <pre> of getSemanticHTML into pre.ql-syntax and drops its leading newline', () => {
    expect(normalizeQuillHtml('<pre>\nlet x;\n</pre>')).toBe(
      '<pre class="ql-syntax" spellcheck="false">let x;\n</pre>'
    );
  });

  it('makes the first &nbsp; of each run a plain space so words can wrap', () => {
    expect(normalizeQuillHtml('<p>hello&nbsp;big&nbsp;world</p>')).toBe('<p>hello big world</p>');
    expect(normalizeQuillHtml('<p>a&nbsp;&nbsp;&nbsp;b</p>')).toBe('<p>a &nbsp;&nbsp;b</p>');
  });

  it('is idempotent', () => {
    const once = normalizeQuillHtml('<p>a&nbsp;&nbsp;b</p><ol><li data-list="bullet">x</li></ol><pre>\ncode\n</pre>');
    expect(normalizeQuillHtml(once)).toBe(once);
  });

  it('leaves Quill 1 markup unchanged', () => {
    const quill1 =
      '<h1>Title</h1><p class="ql-align-center">Hi <strong>there</strong> <span class="ql-size-large">big</span></p>' +
      '<ul><li>one</li><li class="ql-indent-1">two</li></ul><ol><li>first</li></ol>' +
      '<blockquote>quote</blockquote><pre class="ql-syntax" spellcheck="false">code\n</pre><p><br></p>';
    expect(normalizeQuillHtml(quill1)).toBe(quill1);
  });

  it('keeps inline styles, links and images', () => {
    const html = '<p><span style="color: rgb(230, 0, 0);">red</span> <a href="qortal://APP/Q-Tube" rel="noopener noreferrer" target="_blank">link</a></p><p><img src="data:image/png;base64,abc"></p>';
    expect(normalizeQuillHtml(html)).toBe(html);
  });

  it('returns an empty string for empty input', () => {
    expect(normalizeQuillHtml('')).toBe('');
    expect(normalizeQuillHtml(null)).toBe('');
  });
});

describe('isQuillHtmlEmpty', () => {
  it('treats the editor placeholder markup as empty', () => {
    expect(isQuillHtmlEmpty('<p><br></p>')).toBe(true);
    expect(isQuillHtmlEmpty('<p>&nbsp;</p>')).toBe(true);
    expect(isQuillHtmlEmpty('')).toBe(true);
    expect(isQuillHtmlEmpty(undefined)).toBe(true);
  });
  it('keeps text and media', () => {
    expect(isQuillHtmlEmpty('<p>hi</p>')).toBe(false);
    expect(isQuillHtmlEmpty('<p><img src="x.png"></p>')).toBe(false);
  });
});
