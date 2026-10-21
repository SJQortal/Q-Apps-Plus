/**
 * Round-trip through the real Quill 2 build: paste Quill 1 markup (what old
 * shares hold), read it back as root.innerHTML the way react-quill-new does
 * with useSemanticHTML off (Quill 2.0.3's getSemanticHTML() drops code-block
 * text), and check the normalised result is what the original app stores.
 */
import { describe, expect, it } from 'vitest';
import Quill from 'quill';
import { normalizeQuillHtml } from './quillHtml';

function roundTrip(html: string): string {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const quill = new Quill(host, { theme: undefined });
  quill.clipboard.dangerouslyPasteHTML(html, 'api');
  const out = normalizeQuillHtml(quill.root.innerHTML);
  host.remove();
  return out;
}

describe('Quill 2 round trip of Quill 1 content', () => {
  it('keeps bullet and ordered lists as ul/ol with wrapping spaces', () => {
    expect(roundTrip('<ul><li>one two</li><li>three</li></ul><ol><li>first</li></ol>')).toBe(
      '<ul><li>one two</li><li>three</li></ul><ol><li>first</li></ol>'
    );
  });

  it('keeps headers, bold, blockquote and alignment', () => {
    expect(
      roundTrip('<h1>Title</h1><p class="ql-align-center">Hi <strong>there</strong></p><blockquote>q</blockquote>')
    ).toBe('<h1>Title</h1><p class="ql-align-center">Hi <strong>there</strong></p><blockquote>q</blockquote>');
  });

  it('keeps nested Quill 1 indents and checklists', () => {
    expect(
      roundTrip('<ul><li>a</li><li class="ql-indent-1">b</li></ul><ul data-checked="true"><li>done</li></ul>')
    ).toBe('<ul><li>a</li><li class="ql-indent-1">b</li></ul><ul data-checked="true"><li>done</li></ul>');
  });

  it('keeps code blocks as pre.ql-syntax', () => {
    expect(roundTrip('<pre class="ql-syntax" spellcheck="false">let a = 1;\nlet b = 2;\n</pre>')).toBe(
      '<pre class="ql-syntax" spellcheck="false">let a = 1;\nlet b = 2;\n</pre>'
    );
  });
});
