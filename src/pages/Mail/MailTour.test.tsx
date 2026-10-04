import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CONSENT_DESCRIPTION_ID, MailTour, TOUR_STEPS, findTourAnchor } from './MailTour'
import { CONSENT_STORAGE_KEY } from '../../components/modals/ConsentModal'
import { nextHiddenState, PANE_HEADER_HEIGHT } from '../../layout/PaneHeader'
import { isOverlayOpen } from '../../hooks/useKeyboardShortcuts'

const fixtures: HTMLElement[] = []
function mount(html: string) {
  const node = document.createElement('div')
  node.innerHTML = html
  document.body.appendChild(node)
  fixtures.push(node)
}

beforeEach(() => {
  // The disclaimer has been shown and closed on this browser.
  localStorage.setItem(CONSENT_STORAGE_KEY, 'true')
})

afterEach(() => {
  fixtures.splice(0).forEach((node) => node.remove())
})

describe('MailTour', () => {
  it('waits until the welcome dialog has been shown and closed before the first tip', async () => {
    localStorage.removeItem(CONSENT_STORAGE_KEY)
    render(<MailTour run onDone={vi.fn()} />)
    expect(screen.queryByText('Tip 1 of 3')).toBeNull()

    // ConsentModal opens: it sets the flag and its text is in the DOM.
    localStorage.setItem(CONSENT_STORAGE_KEY, 'true')
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    dialog.innerHTML = `<p id="${CONSENT_DESCRIPTION_ID}">disclaimer</p>`
    await act(async () => {
      document.body.appendChild(dialog)
    })
    fixtures.push(dialog)
    expect(screen.queryByText('Tip 1 of 3')).toBeNull()

    // The user taps Got it: the dialog leaves the DOM and the tips start.
    await act(async () => {
      dialog.remove()
    })
    await waitFor(() => expect(screen.getByText('Tip 1 of 3')).toBeTruthy())
  })

  it('walks three tips anchored to the real controls and reports done at the end', () => {
    mount(`
      <button data-qapp-lib-sidebar-item="compose">Compose</button>
      <button data-qapp-lib-sidebar-item="inbox">Inbox</button>
      <button data-qapp-lib-sidebar-item="aliases">Aliases</button>`)
    const onDone = vi.fn()
    render(<MailTour run onDone={onDone} />)

    expect(screen.getByText('Tip 1 of 3')).toBeTruthy()
    expect(document.querySelector('[data-qmail-tour-step="compose"]')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Tip 2 of 3')).toBeTruthy()
    expect(document.querySelector('[data-qmail-tour-step="mailboxes"]')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Tip 3 of 3')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('is a labelled dialog that blocks shortcuts, and hands focus to its anchor when done', async () => {
    mount(`<button data-qapp-lib-sidebar-item="compose">Compose</button>`)
    function Host() {
      const [run, setRun] = React.useState(true)
      return <MailTour run={run} onDone={() => setRun(false)} />
    }
    render(<Host />)
    const dialog = screen.getByRole('dialog', { name: TOUR_STEPS[0].title })
    expect(dialog.getAttribute('aria-describedby')).toBe('qmail-tour-progress qmail-tour-body')
    expect(document.getElementById('qmail-tour-body')?.textContent).toBe(TOUR_STEPS[0].body)
    expect(isOverlayOpen()).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    await waitFor(() => expect(document.activeElement?.textContent).toBe('Compose'))
    expect(isOverlayOpen()).toBe(false)
  })

  it('can be skipped from the first tip, and still shows without an anchor', () => {
    const onDone = vi.fn()
    render(<MailTour run onDone={onDone} />)
    expect(screen.getByText('Write a message')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('prefers the rail, then the phone chrome, for each step', () => {
    mount(`
      <button data-qmail-tour="compose">Compose</button>
      <nav aria-label="Mailboxes"><button aria-label="Inbox">Inbox</button><button aria-label="Aliases">Aliases</button></nav>`)
    expect(findTourAnchor(TOUR_STEPS[0])?.getAttribute('data-qmail-tour')).toBe('compose')
    expect(findTourAnchor(TOUR_STEPS[1])?.getAttribute('aria-label')).toBe('Inbox')
    expect(findTourAnchor(TOUR_STEPS[2])?.getAttribute('aria-label')).toBe('Aliases')
  })
})

describe('PaneHeader hide-on-scroll', () => {
  it('hides after scrolling down past the header, returns on scroll up and at the top', () => {
    expect(nextHiddenState(false, 0, 20)).toBe(false) // still within the header height
    expect(nextHiddenState(false, 100, 140)).toBe(true) // down
    expect(nextHiddenState(true, 140, 143)).toBe(true) // tiny jitter keeps the state
    expect(nextHiddenState(true, 143, 120)).toBe(false) // up
    expect(nextHiddenState(true, 200, PANE_HEADER_HEIGHT)).toBe(false) // back at the top
  })
})
