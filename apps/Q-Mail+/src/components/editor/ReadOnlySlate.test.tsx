import { describe, expect, it } from 'vitest'
import { fireEvent, render as rtlRender, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { Provider } from 'react-redux'
import { store } from '../../state/store'
import { mockQortalAction, qortalCalls } from '../../test/setup'
import ReadOnlySlate from './ReadOnlySlate'

const render = (ui: ReactElement) => rtlRender(<Provider store={store}>{ui}</Provider>)

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
    expect(html).toContain('<a href="qortal://APP/Q-Tube" title="Open Q-Tube in a new tab"><span>tube</span></a>')
    // Web links can't open in Hub: shown as text with their target.
    expect(html).toContain('<span title="https://qortal.org/">site (https://qortal.org/)</span>')
  })

  it('renders nothing for missing or non-array content', () => {
    expect(render(<ReadOnlySlate content={undefined} />).container.innerHTML).toBe('')
    expect(render(<ReadOnlySlate content={'<p>html</p>'} />).container.innerHTML).toBe('')
  })

  it('keeps only qortal:// as a link; relative, same-origin and data: links become text', () => {
    const content = [
      {
        type: 'paragraph',
        children: [
          { type: 'link', url: '/render/APP/EvilApp', children: [{ text: 'View invoice' }] },
          { text: 'x', link: 'data:text/html,<script>alert(1)</script>' },
          { text: 'same', link: `${window.location.origin}/render/APP/Other` },
          { type: 'link', url: 'QORTAL://APP/Q-Tube', children: [{ text: 'tube' }] },
        ],
      },
    ]
    const { container } = render(<ReadOnlySlate content={content} />)
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual(['qortal://APP/Q-Tube'])
    expect(container.textContent).toContain('View invoice')
  })

  it('opens a qortal:// link through Hub on click, and a join link asks Hub to join', async () => {
    mockQortalAction('OPEN_NEW_TAB', true)
    mockQortalAction('JOIN_GROUP', {})
    const content = [
      {
        type: 'paragraph',
        children: [
          { type: 'link', url: 'qortal://APP/Q-Share+/share/Alice%20Smith/qshare_file_x', children: [{ text: 'file' }] },
          { text: 'join', link: 'qortal://use-group/action-join/groupid-1176' },
          { type: 'link', url: 'qortal://APP/../Evil', children: [{ text: 'evil' }] },
        ],
      },
    ]
    render(<ReadOnlySlate content={content} />)
    expect(screen.queryByRole('link', { name: 'evil' })).toBeNull()
    const file = new MouseEvent('click', { bubbles: true, cancelable: true })
    screen.getByRole('link', { name: 'file' }).dispatchEvent(file)
    expect(file.defaultPrevented).toBe(true)
    fireEvent.click(screen.getByRole('link', { name: 'join' }))
    await waitFor(() =>
      expect(qortalCalls()).toEqual([
        { action: 'OPEN_NEW_TAB', qortalLink: 'qortal://APP/Q-Share+/share/Alice%20Smith/qshare_file_x' },
        { action: 'JOIN_GROUP', groupId: 1176 },
      ])
    )
  })
})
