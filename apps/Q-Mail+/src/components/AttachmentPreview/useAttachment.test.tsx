import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { mockQortalAction, qortalCalls } from '../../test/setup'
import { resetAttachmentCache } from '../../utils/attachmentCache'
import { useAttachment } from './useAttachment'
import { useResourceReady } from './useResourceReady'

const ref = { name: 'alice', service: 'ATTACHMENT_PRIVATE', identifier: 'att1', originalFilename: 'cat.png', type: null }

function Ready({ enabled = true }: { enabled?: boolean }) {
  const r = useResourceReady(ref, { enabled })
  return (
    <div>
      <span data-testid="phase">{r.phase}</span>
      <span data-testid="status">{r.status?.status || ''}</span>
      <span data-testid="percent">{r.status?.percentLoaded ?? ''}</span>
      <span data-testid="error">{r.error || ''}</span>
      <button onClick={r.retry}>retry</button>
    </div>
  )
}

function Attachment({ auto = true }: { auto?: boolean }) {
  const a = useAttachment(ref, { auto })
  return (
    <div>
      <span data-testid="phase">{a.phase}</span>
      <span data-testid="mime">{a.entry?.mimeType || ''}</span>
      <span data-testid="error">{a.error || ''}</span>
      <button onClick={a.start}>start</button>
      <button onClick={a.retry}>retry</button>
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

describe('useResourceReady', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setVisibility('visible')
    resetAttachmentCache()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('is ready at once when Core already has the resource, with one status call', async () => {
    mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'READY' })
    render(<Ready />)
    await tick(0)
    expect(screen.getByTestId('phase').textContent).toBe('ready')
    expect(qortalCalls('GET_QDN_RESOURCE_STATUS')).toHaveLength(1)
    expect(qortalCalls('GET_QDN_RESOURCE_PROPERTIES')).toHaveLength(0)
    await tick(20000)
    expect(qortalCalls('GET_QDN_RESOURCE_STATUS')).toHaveLength(1)
  })

  it('asks Core to fetch, polls every 5 s, shows progress and stops when READY', async () => {
    const answers = [
      { status: 'DOWNLOADING', percentLoaded: 20 },
      { status: 'DOWNLOADING', percentLoaded: 60 },
      { status: 'READY' },
    ]
    let i = 0
    mockQortalAction('GET_QDN_RESOURCE_STATUS', () => answers[Math.min(i++, answers.length - 1)])
    mockQortalAction('GET_QDN_RESOURCE_PROPERTIES', { mimeType: 'image/png' })
    const { unmount } = render(<Ready />)
    await tick(0)
    expect(screen.getByTestId('phase').textContent).toBe('waiting')
    expect(screen.getByTestId('percent').textContent).toBe('20')
    expect(qortalCalls('GET_QDN_RESOURCE_PROPERTIES')).toHaveLength(1)
    await tick(5600)
    expect(screen.getByTestId('percent').textContent).toBe('60')
    await tick(5600)
    expect(screen.getByTestId('phase').textContent).toBe('ready')
    const calls = qortalCalls('GET_QDN_RESOURCE_STATUS').length
    await tick(30000)
    expect(qortalCalls('GET_QDN_RESOURCE_STATUS')).toHaveLength(calls)
    unmount()
  })

  it('survives a thrown status call (Bugs #4), backs off while hidden, and stops on unmount (Bugs #6)', async () => {
    let n = 0
    mockQortalAction('GET_QDN_RESOURCE_STATUS', () => {
      n += 1
      if (n === 2) throw new Error('boom')
      return { status: 'DOWNLOADING', percentLoaded: 10 }
    })
    mockQortalAction('GET_QDN_RESOURCE_PROPERTIES', {})
    const { unmount } = render(<Ready />)
    await tick(0)
    await tick(5600) // throws
    expect(screen.getByTestId('phase').textContent).toBe('waiting')
    await tick(11200) // backed off to 10 s, then polls again
    expect(n).toBeGreaterThanOrEqual(3)
    setVisibility('hidden')
    const before = n
    await tick(60000)
    expect(n).toBe(before)
    setVisibility('visible')
    await tick(0)
    expect(n).toBe(before + 1)
    unmount()
    const afterUnmount = n
    await tick(60000)
    expect(n).toBe(afterUnmount)
  })

  it('backs off on MISSING_DATA and retry asks Core again', async () => {
    mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'MISSING_DATA' })
    mockQortalAction('GET_QDN_RESOURCE_PROPERTIES', {})
    render(<Ready />)
    await tick(0)
    expect(screen.getByTestId('status').textContent).toBe('MISSING_DATA')
    await tick(5600)
    const afterFirstPoll = qortalCalls('GET_QDN_RESOURCE_STATUS').length
    await tick(5600) // the second poll is now 10 s away, so no new call yet
    expect(qortalCalls('GET_QDN_RESOURCE_STATUS')).toHaveLength(afterFirstPoll)
    await act(async () => {
      screen.getByText('retry').click()
    })
    await tick(0)
    expect(qortalCalls('GET_QDN_RESOURCE_PROPERTIES')).toHaveLength(2)
  })
})

describe('useAttachment', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setVisibility('visible')
    resetAttachmentCache()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('does nothing until started, then fetches, decrypts and caches', async () => {
    mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'READY' })
    mockQortalAction('FETCH_QDN_RESOURCE', 'ENC')
    mockQortalAction('DECRYPT_DATA', btoa('png-bytes'))
    const first = render(<Attachment auto={false} />)
    await tick(0)
    expect(screen.getByTestId('phase').textContent).toBe('idle')
    expect(qortalCalls()).toHaveLength(0)
    await act(async () => {
      screen.getByText('start').click()
    })
    await tick(0)
    expect(screen.getByTestId('phase').textContent).toBe('ready')
    expect(screen.getByTestId('mime').textContent).toBe('image/png')
    expect(qortalCalls('FETCH_QDN_RESOURCE')).toHaveLength(1)
    first.unmount()
    // A second consumer of the same identifier costs nothing.
    render(<Attachment auto />)
    await tick(0)
    expect(screen.getByTestId('phase').textContent).toBe('ready')
    expect(qortalCalls()).toHaveLength(3)
  })

  it('reports a decrypt failure and can retry', async () => {
    mockQortalAction('GET_QDN_RESOURCE_STATUS', { status: 'READY' })
    mockQortalAction('FETCH_QDN_RESOURCE', 'ENC')
    let fail = true
    mockQortalAction('DECRYPT_DATA', () => (fail ? null : btoa('ok')))
    render(<Attachment auto />)
    await tick(0)
    expect(screen.getByTestId('phase').textContent).toBe('error')
    expect(screen.getByTestId('error').textContent).toMatch(/decrypted/)
    fail = false
    await act(async () => {
      screen.getByText('retry').click()
    })
    await tick(0)
    expect(screen.getByTestId('phase').textContent).toBe('ready')
  })
})
