/**
 * An earlier message that cannot be drawn fails in its own place: the other
 * earlier messages and the open message stay (the per-card ErrorBoundary).
 */
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { HubThemeProvider } from '../../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme'
import { store } from '../../state/store'
import { ShowMessageV2 } from './ShowMessageV2'

// A card that throws while drawing, whatever the cause.
vi.mock('./ShowMessageV2Replies', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...actual,
    ShowMessageV2Replies: (props: any) => {
      if (props.message?.subject === 'BOOM') throw new Error('cannot draw')
      return actual.ShowMessageV2Replies(props)
    },
  }
})

const embedded = (id: string, subject: string, createdAt: number) => ({
  reference: { identifier: id, name: 'bob', service: 'MAIL_PRIVATE' },
  data: { id, user: 'bob', subject, createdAt, textContentV2: `<p>${subject} body</p>` },
})

describe('ShowMessageV2 and an earlier message that cannot be drawn', () => {
  it('shows "could not be shown" in its place and keeps the rest', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const message = {
      id: 'reply',
      user: 'alice',
      recipient: 'bob',
      subject: 'Re: Plan',
      createdAt: 3000,
      textContentV2: '<p>latest</p>',
      attachments: [],
      generalData: { thread: [], threadV2: [embedded('m1', 'BOOM', 1000), embedded('m2', 'Plan B', 2000)] },
    }
    render(
      <Provider store={store}>
        <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
          <ShowMessageV2 message={message} />
        </HubThemeProvider>
      </Provider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Show earlier · 2 messages' }))
    expect(screen.getByText('This earlier message could not be shown.')).toBeTruthy()
    expect(screen.getByRole('article', { name: 'bob: Plan B' })).toBeTruthy()
    expect(screen.getByText('latest')).toBeTruthy()
    error.mockRestore()
  })
})
