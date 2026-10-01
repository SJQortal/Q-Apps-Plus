import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TextEditor } from './TextEditor'

describe('TextEditor toolbar', () => {
  it('mounts Quill on our two-row toolbar and keeps the rare controls behind More', () => {
    const { container } = render(<TextEditor inlineContent="<p>hi</p>" setInlineContent={vi.fn()} />)
    // Quill attached to the container we pointed it at (it adds its own classes).
    const toolbar = container.querySelector('.qmail-toolbar')
    expect(toolbar).toBeTruthy()
    expect(toolbar?.classList.contains('ql-toolbar')).toBe(true)
    expect(container.querySelector('.ql-editor')?.textContent).toBe('hi')

    // Everyday controls are labelled; the rare ones live in the hidden row.
    expect(screen.getByRole('button', { name: 'Bold' })).toBeTruthy()
    const more = screen.getByRole('button', { name: 'More formatting options' })
    const moreRow = container.querySelector('.qmail-toolbar-more')
    expect(moreRow?.classList.contains('is-open')).toBe(false)
    expect(more.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(more)
    expect(moreRow?.classList.contains('is-open')).toBe(true)
    expect(screen.getByRole('button', { name: 'Fewer formatting options' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Subscript' })).toBeTruthy()
  })

  it('gives each editor its own toolbar id, so two composers do not share one', () => {
    const { container } = render(
      <>
        <TextEditor inlineContent="" setInlineContent={vi.fn()} />
        <TextEditor inlineContent="" setInlineContent={vi.fn()} />
      </>
    )
    const ids = Array.from(container.querySelectorAll('.qmail-toolbar')).map(el => el.id)
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
    expect(container.querySelectorAll('.ql-editor')).toHaveLength(2)
  })
})
