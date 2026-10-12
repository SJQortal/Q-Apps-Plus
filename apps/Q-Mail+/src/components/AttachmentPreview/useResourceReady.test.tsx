import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { mockQortalAction, qortalCalls } from '../../test/setup'
import { resetAttachmentCache } from '../../utils/attachmentCache'
import { RESOURCE_SETTLING_DELAYS_MS, isSettlingStatus, useResourceReady } from './useResourceReady'

const ref = { name: 'alice', service: 'MAIL_PRIVATE', identifier: '_mail_qortal_qmail_bob_abcdef_mail_x1' }

function Ready() {
  const r = useResourceReady(ref)
  return (
    <div>
      <span data-testid="phase">{r.phase}</span>
      <span data-testid="status">{r.status?.status || ''}</span>
    </div>
  )
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

const tick = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

const statusCalls = () => qortalCalls('GET_QDN_RESOURCE_STATUS').length

function answerInOrder(answers: Array<{ status: string }>) {
  let i = 0
  mockQortalAction('GET_QDN_RESOURCE_STATUS', () => answers[Math.min(i++, answers.length - 1)])
  mockQortalAction('GET_QDN_RESOURCE_PROPERTIES', {})
}

describe('useResourceReady: a file Core is assembling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setVisibility('visible')
    resetAttachmentCache()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('knows which statuses mean "on the node, nearly ready"', () => {
    expect(isSettlingStatus('DOWNLOADED')).toBe(true)
    expect(isSettlingStatus('BUILDING')).toBe(true)
    expect(isSettlingStatus('DOWNLOADING')).toBe(false)
    expect(isSettlingStatus('MISSING_DATA')).toBe(false)
    expect(isSettlingStatus(undefined)).toBe(false)
    expect(RESOURCE_SETTLING_DELAYS_MS).toEqual([500, 1000])
  })

  it('re-checks after 0.5 s when the first answer is DOWNLOADED, and is ready then', async () => {
    answerInOrder([{ status: 'DOWNLOADED' }, { status: 'READY' }])
    render(<Ready />)
    await tick(0)
    expect(screen.getByTestId('phase').textContent).toBe('waiting')
    expect(statusCalls()).toBe(1)
    await tick(499)
    expect(statusCalls()).toBe(1)
    await tick(1)
    expect(statusCalls()).toBe(2)
    expect(screen.getByTestId('phase').textContent).toBe('ready')
    await tick(30000)
    expect(statusCalls()).toBe(2)
  })

  it('checks at 0.5 s and 1.5 s while BUILDING, then falls back to the 5 s poll', async () => {
    answerInOrder([{ status: 'BUILDING' }])
    const { unmount } = render(<Ready />)
    await tick(0)
    expect(statusCalls()).toBe(1)
    await tick(500)
    expect(statusCalls()).toBe(2)
    await tick(999)
    expect(statusCalls()).toBe(2)
    await tick(1)
    expect(statusCalls()).toBe(3)
    // No more quick checks: the next one is the normal poll, ≥ 5 s later.
    await tick(4900)
    expect(statusCalls()).toBe(3)
    await tick(700)
    expect(statusCalls()).toBe(4)
    unmount()
    await tick(60000)
    expect(statusCalls()).toBe(4)
  })

  it('hands over to the normal poll as soon as Core says DOWNLOADING', async () => {
    answerInOrder([{ status: 'DOWNLOADED' }, { status: 'DOWNLOADING' }, { status: 'READY' }])
    render(<Ready />)
    await tick(0)
    await tick(500)
    expect(statusCalls()).toBe(2)
    expect(screen.getByTestId('status').textContent).toBe('DOWNLOADING')
    await tick(1000)
    expect(statusCalls()).toBe(2)
    await tick(5000)
    expect(statusCalls()).toBe(3)
    expect(screen.getByTestId('phase').textContent).toBe('ready')
  })

  it('makes no quick checks while the tab is hidden', async () => {
    answerInOrder([{ status: 'BUILDING' }])
    render(<Ready />)
    await tick(0)
    setVisibility('hidden')
    await tick(60000)
    expect(statusCalls()).toBe(1)
    setVisibility('visible')
    await tick(6000)
    expect(statusCalls()).toBe(2)
  })

  it('does not speed up a resource that is still downloading from peers', async () => {
    answerInOrder([{ status: 'DOWNLOADING' }])
    render(<Ready />)
    await tick(0)
    await tick(4000)
    expect(statusCalls()).toBe(1)
  })
})
