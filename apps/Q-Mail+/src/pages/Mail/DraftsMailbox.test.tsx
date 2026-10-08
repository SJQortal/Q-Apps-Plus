import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HubThemeProvider } from '../../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme'
import { DraftsMailbox, describeDraftTarget } from './DraftsMailbox'
import { IMPOSTOR, isStruck, nameElement } from '../../test/hiddenNames'
import { HIDDEN_CHARACTERS_SR } from '../../components/common/NameText'
import { listComposeDrafts, saveComposeDraft, type StoredComposeDraft } from './composeDrafts'

const address = 'QADDR'

const draft = (overrides: Partial<StoredComposeDraft>): StoredComposeDraft => ({
  draftId: 'id',
  fromName: 'Me',
  toName: 'You',
  subject: 'Hello',
  value: '<p>body text</p>',
  aliasValue: '',
  showAlias: false,
  showBCC: false,
  bccNames: [],
  updatedAt: Date.now(),
  ...overrides,
})

function renderDrafts(onOpenDraft = vi.fn(), hideThreadDrafts = false) {
  render(
    <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
      <DraftsMailbox address={address} onOpenDraft={onOpenDraft} hideThreadDrafts={hideThreadDrafts} />
    </HubThemeProvider>
  )
  return onOpenDraft
}

describe('describeDraftTarget', () => {
  it('names mail, reply and thread drafts', () => {
    expect(describeDraftTarget(draft({}))).toBe('To You')
    expect(describeDraftTarget(draft({ replyTo: { id: 'm', user: 'You' } }))).toBe('Reply to You')
    expect(describeDraftTarget(draft({ kind: 'thread', groupName: 'G' }))).toBe('New thread in G')
    expect(describeDraftTarget(draft({ kind: 'thread', groupName: 'G', threadId: 't' }))).toBe('Post in G')
  })
})

describe('DraftsMailbox', () => {
  it('keeps thread drafts out of the list while group threads are hidden, without deleting them', () => {
    saveComposeDraft(address, 'me::you', draft({ toName: 'You' }))
    saveComposeDraft(address, 'thread::7', draft({ kind: 'thread', groupName: 'Builders', toName: 'Builders' }))
    renderDrafts(vi.fn(), true)
    expect(screen.getAllByRole('button', { name: /^Open draft/ }).map((el) => el.getAttribute('aria-label'))).toEqual([
      'Open draft: Hello, To You',
    ])
    expect(listComposeDrafts(address)).toHaveLength(2)
  })

  it('shows an empty state when there is nothing saved', () => {
    renderDrafts()
    expect(screen.getByText('No drafts')).toBeTruthy()
  })

  it('lists drafts newest first, opens one, refreshes when the composer saves', async () => {
    saveComposeDraft(address, 'me::old', draft({ toName: 'Old', updatedAt: 1 }))
    saveComposeDraft(address, 'me::new', draft({ toName: 'New', updatedAt: 2, attachments: [{ name: 'a', size: 1, type: null }] }))
    const onOpen = renderDrafts()
    const items = screen.getAllByRole('button', { name: /^Open draft/ })
    expect(items.map(el => el.getAttribute('aria-label'))).toEqual([
      'Open draft: Hello, To New',
      'Open draft: Hello, To Old',
    ])
    fireEvent.click(items[0])
    expect(onOpen).toHaveBeenCalledWith('me::new', expect.objectContaining({ toName: 'New' }))

    saveComposeDraft(address, 'me::third', draft({ toName: 'Third', updatedAt: 3 }))
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /^Open draft/ })).toHaveLength(3)
    })
  })

  it('deletes a draft after confirmation', async () => {
    saveComposeDraft(address, 'me::you', draft({}))
    renderDrafts()
    fireEvent.click(screen.getByRole('button', { name: 'Delete draft: Hello' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    await waitFor(() => {
      expect(listComposeDrafts(address)).toHaveLength(0)
    })
    expect(await screen.findByText('No drafts')).toBeTruthy()
  })

  it('strikes an impostor recipient in the row and in the delete dialog', async () => {
    saveComposeDraft(address, 'me::imp', draft({ toName: IMPOSTOR }))
    renderDrafts()
    const row = screen.getByRole('button', { name: /^Open draft/ })
    expect(isStruck(nameElement(row, IMPOSTOR))).toBe(true)
    expect(row.getAttribute('aria-label')).toBe(`Open draft: Hello, To ${IMPOSTOR}${HIDDEN_CHARACTERS_SR}`)
    fireEvent.click(screen.getByRole('button', { name: 'Delete draft: Hello' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toMatch(/"Hello" \(To Simon.James.*\)\s*will be removed from this device\./)
    expect(isStruck(nameElement(dialog, IMPOSTOR))).toBe(true)
  })
})
