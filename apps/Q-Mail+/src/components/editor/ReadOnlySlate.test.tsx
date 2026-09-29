import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import ReadOnlySlate from './ReadOnlySlate'

describe('ReadOnlySlate (legacy textContent renderer)', () => {
  it('renders the old Slate mail format with marks and blocks', () => {
    const content = [
      { type: 'paragraph', textAlign: 'center', children: [{ text: 'Hi ' }, { text: 'bold', bold: true }, { text: ' and ', italic: true }, { text: 'u', underline: true }] },
      { type: 'heading-2', children: [{ text: 'Title' }] },
      { type: 'block-quote', children: [{ text: 'quoted' }] },
      { type: 'code-block', children: [{ type: 'code-line', children: [{ text: 'x = 1' }] }] },
      { type: 'link', url: 'qortal://APP/Q-Tube', children: [{ text: 'tube' }] },
      { type: 'paragraph', children: [{ text: 'site', link: 'https://qortal.org' }] },
    ]
    const { container } = render(<ReadOnlySlate content={content} mode="mail" />)
    const html = container.innerHTML
    expect(html).toContain('<p class="paragraph-mail" style="text-align: center;">')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em> and </em>')
    expect(html).toContain('<u>u</u>')
    expect(html).toContain('<h2 class="h2">')
    expect(html).toContain('<blockquote><span>quoted</span></blockquote>')
    expect(html).toContain('<pre class="code-block"><code><div><span>x = 1</span></div></code></pre>')
    expect(html).toContain('<a href="qortal://APP/Q-Tube"><span>tube</span></a>')
    expect(html).toContain('<a href="https://qortal.org">site</a>')
  })

  it('renders nothing for missing or non-array content', () => {
    expect(render(<ReadOnlySlate content={undefined} />).container.innerHTML).toBe('')
    expect(render(<ReadOnlySlate content={'<p>html</p>'} />).container.innerHTML).toBe('')
  })
})
