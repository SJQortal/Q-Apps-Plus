import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { mockQortalAction, qortalCalls } from '../../../test/setup'
import { BlockedNamesModal, PUBLIC_NODE_TEXT } from './BlockedNamesModal'

const PUBLIC_NODE = {
  error: 'This action cannot be done through a public node',
  message: 'This action cannot be done through a public node',
}

describe('BlockedNamesModal', () => {
  it('lists the names and unblocks one through DELETE_LIST_ITEM', async () => {
    mockQortalAction('GET_LIST_ITEMS', ['bob', 'eve'])
    mockQortalAction('DELETE_LIST_ITEM', true)
    render(<BlockedNamesModal open onClose={() => {}} />)
    expect(await screen.findByText('bob')).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unblock bob' }))
    })
    await waitFor(() => expect(screen.queryByText('bob')).toBeNull())
    expect(qortalCalls('DELETE_LIST_ITEM')[0]).toMatchObject({ list_name: 'blockedNames', item: 'bob' })
    expect(screen.getByText('eve')).toBeTruthy()
  })

  it("shows a quiet 'Not available on a public node' line when Hub refuses the list", async () => {
    mockQortalAction('GET_LIST_ITEMS', () => {
      throw PUBLIC_NODE
    })
    render(<BlockedNamesModal open onClose={() => {}} />)
    expect(await screen.findByRole('status')).toBeTruthy()
    expect(screen.getByText(new RegExp(PUBLIC_NODE_TEXT))).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull()
  })

  it('treats a declined access dialog as a cancel with a Try again, not an error', async () => {
    let calls = 0
    mockQortalAction('GET_LIST_ITEMS', () => {
      calls += 1
      if (calls === 1) throw 'user declined to share list'
      return ['bob']
    })
    render(<BlockedNamesModal open onClose={() => {}} />)
    expect(await screen.findByText('Access not granted')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    })
    expect(await screen.findByText('bob')).toBeTruthy()
  })

  it('keeps the name when the user declines the unblock dialog, and says so quietly on a public node', async () => {
    mockQortalAction('GET_LIST_ITEMS', ['bob'])
    mockQortalAction('DELETE_LIST_ITEM', () => {
      throw 'user declined delete from list'
    })
    render(<BlockedNamesModal open onClose={() => {}} />)
    expect(await screen.findByText('bob')).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unblock bob' }))
    })
    expect(screen.getByText('bob')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()

    mockQortalAction('DELETE_LIST_ITEM', () => {
      throw PUBLIC_NODE
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Unblock bob' }))
    })
    expect(await screen.findByRole('status')).toBeTruthy()
  })

  it('shows a real failure with Retry', async () => {
    const onClose = vi.fn()
    mockQortalAction('GET_LIST_ITEMS', () => {
      throw new Error('failed to fetch the list')
    })
    render(<BlockedNamesModal open onClose={onClose} />)
    expect(await screen.findByText('Could not load the list')).toBeTruthy()
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy()
  })
})
