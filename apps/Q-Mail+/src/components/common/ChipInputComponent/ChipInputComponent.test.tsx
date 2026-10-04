import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { mockQortalAction, qortalCalls } from '../../../test/setup'
import { resetNameCache } from '../../../utils/nameCache'
import { ChipInputComponent, type NameChip } from './ChipInputComponent'

function Harness({ onPending, exclude = [] }: { onPending?: (v: string) => void; exclude?: string[] }) {
  const [chips, setChips] = useState<NameChip[]>([])
  return (
    <>
      <ChipInputComponent chips={chips} setChips={setChips} inputLabel="Cc name" excludeNames={exclude} onPendingChange={onPending} />
      <output data-testid="chips">{JSON.stringify(chips)}</output>
    </>
  )
}

const add = (name: string) => {
  const input = screen.getByRole('textbox', { name: 'Cc name' })
  fireEvent.change(input, { target: { value: name } })
  fireEvent.keyDown(input, { key: 'Enter' })
  return input
}

describe('ChipInputComponent (Cc / Bcc names)', () => {
  beforeEach(() => {
    resetNameCache()
    mockQortalAction('GET_NAME_DATA', (request: any) => {
      if (request.name === 'carl') return { name: 'Carl', owner: 'QCARL' }
      if (request.name === 'nokey') return { name: 'NoKey', owner: 'QNOKEY' }
      throw new Error('Name not found')
    })
    mockQortalAction('GET_ACCOUNT_DATA', (request: any) => ({ publicKey: request.address === 'QCARL' ? 'pkCarl' : null }))
  })

  it('adds a registered name with its key, under its registered spelling', async () => {
    const onPending = vi.fn()
    render(<Harness onPending={onPending} />)
    const input = add('carl')
    expect(onPending).toHaveBeenLastCalledWith('carl')
    await waitFor(() =>
      expect(JSON.parse(screen.getByTestId('chips').textContent || '[]')).toEqual([
        { name: 'Carl', publicKey: 'pkCarl', address: 'QCARL' },
      ])
    )
    expect((input as HTMLInputElement).value).toBe('')
    expect(onPending).toHaveBeenLastCalledWith('')
    // Typing the same name again costs nothing and adds nothing.
    add('CARL')
    await waitFor(() => expect((input as HTMLInputElement).value).toBe(''))
    expect(qortalCalls('GET_NAME_DATA')).toHaveLength(1)
  })

  it('shows an unknown name or a missing key inline, next to the field', async () => {
    render(<Harness />)
    const input = add('ghost')
    expect((await screen.findByRole('alert')).textContent).toContain('"ghost" is not a registered name')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    add('nokey')
    expect((await screen.findByRole('alert')).textContent).toContain('NoKey has no public key yet')
    expect(screen.getByTestId('chips').textContent).toBe('[]')
    // Typing clears the message.
    fireEvent.change(input, { target: { value: 'c' } })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('refuses a name that is already a recipient elsewhere, without a lookup', async () => {
    render(<Harness exclude={['Bob']} />)
    add('bob')
    expect((await screen.findByRole('alert')).textContent).toContain('bob is already a recipient')
    expect(qortalCalls('GET_NAME_DATA')).toHaveLength(0)
  })
})
