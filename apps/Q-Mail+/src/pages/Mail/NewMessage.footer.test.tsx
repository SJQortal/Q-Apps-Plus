import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import Quill from 'quill'
import { HubThemeProvider } from '../../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme'
import { store } from '../../state/store'
import { addUser } from '../../state/features/authSlice'
import { mockQortalAction } from '../../test/setup'
import { resetNameCache } from '../../utils/nameCache'
import { writeMailFooter, type MailFooterSettings } from '../../utils/mailFooter'
import { toPublishedMailHtml } from '../../components/common/TextEditor/quillHtml'
import { NewMessage } from './NewMessage'
import { getComposeDraftsStorageKey, saveComposeDraft } from './composeDrafts'

const address = 'QmeAddress'
const original = {
  id: 'msg1',
  user: 'alice',
  subject: 'Lunch',
  createdAt: Date.now() - 60_000,
  textContentV2: '<p>See you at noon</p>',
  attachments: [],
  generalData: { thread: [], threadV2: [] },
}
const FOOTER: MailFooterSettings = {
  default: 'Simon & co\nqortal://APP/Q-Mail+',
  byName: { work: 'Simon at work' },
  inReplies: true,
}
const DEFAULT_HTML = '<p>Simon &amp; co</p><p>qortal://APP/Q-Mail+</p>'
const WORK_HTML = '<p>Simon at work</p>'

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const wait = (ms: number) => act(() => new Promise(resolve => setTimeout(resolve, ms)))
const storedDrafts = () => JSON.parse(localStorage.getItem(getComposeDraftsStorageKey(address)) || '{}')

function renderComposer(props: { replyTo?: any; forwardInfo?: any; composePrefill?: any } = {}) {
  const utils = render(
    <Provider store={store}>
      <MemoryRouter>
        <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
          <NewMessage
            inlineMode
            hideButton
            replyTo={props.replyTo ?? null}
            setReplyTo={vi.fn()}
            setForwardInfo={vi.fn()}
            forwardInfo={props.forwardInfo ?? null}
            ownedNames={['me', 'work']}
            composePrefill={props.composePrefill ?? null}
          />
        </HubThemeProvider>
      </MemoryRouter>
    </Provider>
  )
  const quill = () => Quill.find(utils.container.querySelector('.ql-container') as HTMLElement) as Quill
  const body = () => quill().root.innerHTML
  return { ...utils, quill, body }
}

async function pickFrom(name: string) {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: /From/ }))
  fireEvent.click(await screen.findByRole('option', { name }))
}

describe('NewMessage footer', () => {
  beforeEach(() => {
    localStorage.clear()
    resetNameCache()
    store.dispatch(addUser({ name: 'me', address } as any))
    mockQortalAction('GET_NAME_DATA', (request: any) => ({ name: request.name, owner: `Q${request.name}owner` }))
    mockQortalAction('GET_ACCOUNT_DATA', (request: any) => ({ publicKey: `pk-${request.address}` }))
    mockQortalAction('SEARCH_NAMES', [])
  })

  it('starts a new message with a line to type on and the footer, and saves no draft for it', async () => {
    writeMailFooter(address, FOOTER)
    const { body } = renderComposer()
    await waitFor(() => expect(body()).toBe(`<p><br></p>${DEFAULT_HTML}`))
    expect(toPublishedMailHtml(body())).toBe(`<p><br></p>${DEFAULT_HTML}`)
    await wait(500)
    expect(storedDrafts()).toEqual({})
  })

  it('adds nothing to a new message when there is no footer', async () => {
    const { body } = renderComposer()
    await wait(50)
    expect(body()).toBe('<p><br></p>')
  })

  it('ends a reply with the footer and no quote, and leaves it out when switched off', async () => {
    writeMailFooter(address, FOOTER)
    const first = renderComposer({ replyTo: original })
    await waitFor(() => expect(first.body()).toBe(`<p><br></p>${DEFAULT_HTML}`))
    expect(toPublishedMailHtml(first.body())).toBe(`<p><br></p>${DEFAULT_HTML}`)
    expect(first.body()).not.toContain('See you at noon')
    await wait(500)
    expect(storedDrafts()).toEqual({})
    first.unmount()

    writeMailFooter(address, { ...FOOTER, inReplies: false })
    const second = renderComposer({ replyTo: original })
    await screen.findByRole('region', { name: 'Original message' })
    await wait(50)
    expect(second.quill().getText().trim()).toBe('')
    expect(second.body()).not.toContain('See you at noon')
  })

  it('puts the footer above the header of a forward', async () => {
    writeMailFooter(address, FOOTER)
    const { quill, body } = renderComposer({ forwardInfo: { message: original, to: 'me' } })
    await waitFor(() => expect(quill().getText()).toContain('Forwarded message'))
    expect(toPublishedMailHtml(body())).toMatch(
      new RegExp(`^<p><br></p>${escapeRegExp(DEFAULT_HTML)}<p><br></p><p>---------- Forwarded message ---------</p>`)
    )
  })

  it("swaps to the From name's footer while it is untouched, and keeps an edited one", async () => {
    writeMailFooter(address, FOOTER)
    const { quill, body } = renderComposer()
    await waitFor(() => expect(body()).toBe(`<p><br></p>${DEFAULT_HTML}`))

    await pickFrom('work')
    await waitFor(() => expect(body()).toBe(`<p><br></p>${WORK_HTML}`))

    // The user writes above the footer: it is still swapped.
    act(() => {
      quill().insertText(0, 'Hello', 'user')
    })
    await pickFrom('me')
    await waitFor(() => expect(body()).toBe(`<p>Hello</p>${DEFAULT_HTML}`))

    // The user edits the footer itself: From no longer touches it.
    act(() => {
      quill().insertText(quill().getLength() - 1, '!', 'user')
    })
    const edited = body()
    expect(edited).toContain('qortal://APP/Q-Mail+!')
    await pickFrom('work')
    await wait(50)
    expect(body()).toBe(edited)
  })

  it('a stored draft keeps its own body: no footer added, none swapped', async () => {
    writeMailFooter(address, FOOTER)
    saveComposeDraft(address, 'me::bob', {
      draftId: 1,
      fromName: 'me',
      toName: 'bob',
      subject: 'Plans',
      value: '<p>My draft</p>',
      updatedAt: 1,
      kind: 'mail',
    } as any)
    const { body } = renderComposer({
      composePrefill: { draftId: 1, draftKey: 'me::bob', fromName: 'me', toValue: 'bob', toType: 'name' },
    })
    await waitFor(() => expect(body()).toBe('<p>My draft</p>'))
    await pickFrom('work')
    await wait(50)
    expect(body()).toBe('<p>My draft</p>')
  })

  it('a reply swaps its footer when From changes', async () => {
    writeMailFooter(address, FOOTER)
    const { body } = renderComposer({ replyTo: original })
    await waitFor(() => expect(body()).toBe(`<p><br></p>${DEFAULT_HTML}`))
    await pickFrom('work')
    await waitFor(() => expect(body()).toBe(`<p><br></p>${WORK_HTML}`))
  })
})
