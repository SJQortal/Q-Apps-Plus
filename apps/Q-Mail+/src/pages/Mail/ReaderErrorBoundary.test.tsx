import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { READER_ERROR_TITLE, ReaderErrorBoundary } from './ReaderErrorBoundary'

const Reader = ({ subject }: { subject: unknown }) => <h2>{subject as any}</h2>

describe('ReaderErrorBoundary', () => {
  it('a message that cannot be drawn takes down the reader only, until another message opens', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const view = (key: string, subject: unknown) => (
      <div>
        <p>mailbox list</p>
        <ReaderErrorBoundary messageKey={key}>
          <Reader subject={subject} />
        </ReaderErrorBoundary>
      </div>
    )
    // An object as a React child throws, as a crafted subject did.
    const { rerender } = render(view('alice|m1', { crafted: true }))
    expect(screen.getByText(READER_ERROR_TITLE)).toBeTruthy()
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy()
    expect(screen.getByText('mailbox list')).toBeTruthy()
    rerender(view('bob|m2', 'Lunch'))
    expect(screen.getByRole('heading', { name: 'Lunch' })).toBeTruthy()
    expect(screen.queryByText(READER_ERROR_TITLE)).toBeNull()
    error.mockRestore()
  })
})
