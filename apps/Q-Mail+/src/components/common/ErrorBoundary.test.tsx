import { describe, expect, it, vi } from 'vitest'
import { Suspense, type ComponentType } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'
import { lazyNamed } from './lazyNamed'

describe('ErrorBoundary', () => {
  it('shows a Reload message instead of a blank app when a chunk fails to load', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const loader = vi.fn(async (): Promise<{ Pane: ComponentType }> => {
      throw new TypeError('Failed to fetch dynamically imported module')
    })
    const Pane = lazyNamed(loader, 'Pane', 0)
    const onReload = vi.fn()
    render(
      <ErrorBoundary onReload={onReload}>
        <p>shell</p>
        <Suspense fallback={<p>loading</p>}>
          <Pane />
        </Suspense>
      </ErrorBoundary>
    )
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText('Something went wrong')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onReload).toHaveBeenCalledTimes(1)
    error.mockRestore()
  })

  it('with a fallback, shows it in place and clears the error for a new resetKey', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const Card = ({ broken }: { broken: boolean }) => {
      if (broken) throw new Error('Objects are not valid as a React child')
      return <p>card</p>
    }
    const view = (key: string, broken: boolean) => (
      <div>
        <p>mailbox</p>
        <ErrorBoundary resetKey={key} fallback={<p>This message could not be shown</p>}>
          <Card broken={broken} />
        </ErrorBoundary>
      </div>
    )
    const { rerender } = render(view('a', true))
    expect(screen.getByText('This message could not be shown')).toBeTruthy()
    expect(screen.getByText('mailbox')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    // The same message stays on its fallback; another one renders again.
    rerender(view('a', false))
    expect(screen.getByText('This message could not be shown')).toBeTruthy()
    rerender(view('b', false))
    expect(screen.getByText('card')).toBeTruthy()
    error.mockRestore()
  })

  it('renders its children when nothing fails', () => {
    render(
      <ErrorBoundary>
        <p>inbox</p>
      </ErrorBoundary>
    )
    expect(screen.getByText('inbox')).toBeTruthy()
  })
})
