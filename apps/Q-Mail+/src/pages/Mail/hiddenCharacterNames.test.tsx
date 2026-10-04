/**
 * Names hiding invisible characters (impostors, e.g. a dev's name plus
 * U+2800) are struck through wherever Q-Mail+ shows them,
 * exactly as Qortal Hub does (NameText). Ordinary names are left alone.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import { HubThemeProvider } from '../../hub-theme'
import { THEME_STORAGE_KEY, themeConfig } from '../../theme/qplus-theme'
import authReducer, { addUser } from '../../state/features/authSlice'
import globalReducer from '../../state/features/globalSlice'
import mailReducer from '../../state/features/mailSlice'
import notificationsReducer from '../../state/features/notificationsSlice'
import blogReducer from '../../state/features/blogSlice'
import { mockQortalAction } from '../../test/setup'
import { resetAvatarCache } from '../../utils/avatarCache'
import { resetSubjectCache } from '../../utils/subjectCache'
import { BLANK, IMPOSTOR, REAL, isStruck, nameElement } from '../../test/hiddenNames'
import { MailMessageRow } from './MailMessageRow'
import { GroupedMailboxList } from './GroupedMailboxList'
import { ThreadRow } from './ThreadRow'

function makeStore() {
  const store = configureStore({
    reducer: { auth: authReducer, global: globalReducer, mail: mailReducer, notifications: notificationsReducer, blog: blogReducer },
    middleware: (getDefault) => getDefault({ serializableCheck: false }),
  })
  store.dispatch(addUser({ address: 'QAlice', publicKey: 'PK', name: 'alice' }))
  return store
}

function wrap(ui: React.ReactElement) {
  return render(
    <Provider store={makeStore()}>
      <HubThemeProvider storageKey={THEME_STORAGE_KEY} config={themeConfig}>
        {ui}
      </HubThemeProvider>
    </Provider>
  )
}

beforeEach(() => {
  resetAvatarCache()
  resetSubjectCache()
  mockQortalAction('GET_QDN_RESOURCE_URL', 'Resource does not exist')
})

describe('mailbox rows', () => {
  it.each([
    [IMPOSTOR, true],
    [REAL, false],
  ])('a row from %j is struck: %s', (sender, struck) => {
    const { container } = wrap(
      <MailMessageRow messageData={{ id: 'm1', user: sender, createdAt: 1_000 }} openMessage={() => {}} />
    )
    expect(isStruck(nameElement(container, sender))).toBe(struck)
    // The row's own label keeps the name exactly as it is.
    expect(screen.getByRole('button', { name: new RegExp(`^Unread. ${sender},`) })).toBeTruthy()
  })

  it('a search hit keeps its highlight inside the struck name', () => {
    const { container } = wrap(
      <MailMessageRow messageData={{ id: 'm1', user: IMPOSTOR, createdAt: 1_000 }} openMessage={() => {}} highlightTerms={['simon']} />
    )
    const mark = container.querySelector('mark')
    expect(mark?.textContent).toBe('Simon')
    expect(isStruck(mark!.parentElement!)).toBe(true)
  })

  it('a sender group header strikes the sender, and its avatar letter is visible', () => {
    const messages = [
      { id: 'a', user: `${BLANK}${IMPOSTOR}`, createdAt: 2_000 },
      { id: 'b', user: `${BLANK}${IMPOSTOR}`, createdAt: 1_000 },
      { id: 'c', user: REAL, createdAt: 3_000 },
      { id: 'd', user: REAL, createdAt: 500 },
    ]
    const { container } = wrap(<GroupedMailboxList messages={messages} mailboxType="inbox" openMessage={() => {}} />)
    expect(isStruck(nameElement(container, `${BLANK}${IMPOSTOR}`))).toBe(true)
    expect(isStruck(nameElement(container, REAL))).toBe(false)
    const letters = Array.from(container.querySelectorAll('.MuiAvatar-root')).map((el) => el.textContent)
    expect(letters).toEqual(['S', 'S'])
  })
})

describe('threads', () => {
  it('strikes the thread owner', () => {
    const thread = { identifier: 't1', threadOwner: IMPOSTOR, threadData: { title: 'Plans', name: IMPOSTOR } } as any
    const { container } = wrap(<ThreadRow thread={thread} onOpen={() => {}} />)
    expect(isStruck(nameElement(container, IMPOSTOR))).toBe(true)
  })
})
