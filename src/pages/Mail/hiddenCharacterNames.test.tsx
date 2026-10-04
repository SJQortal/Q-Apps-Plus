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
import { BLANK, IMPOSTOR, REAL, isStruck, nameElement, struckNames } from '../../test/hiddenNames'
import { MailMessageRow } from './MailMessageRow'
import { GroupedMailboxList } from './GroupedMailboxList'
import { ThreadRow } from './ThreadRow'
import { ShowMessageV2 } from './ShowMessageV2'
import { ShowMessageV2Replies } from './ShowMessageV2Replies'
import { ShowMessage } from './ShowMessageWithoutModal'
import { AliasesPage } from './AliasesPage'
import { Rail } from '../../layout/Rail'

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

describe('reader', () => {
  it('strikes an impostor sender, not a real recipient', () => {
    const { container } = wrap(
      <ShowMessageV2 message={{ id: 'x', user: IMPOSTOR, recipient: REAL, subject: 'Hi', createdAt: 1_000 }} />
    )
    expect(isStruck(nameElement(container, IMPOSTOR))).toBe(true)
    expect(struckNames(container)).toEqual([IMPOSTOR])
    expect(screen.getByText(`to ${REAL}`)).toBeTruthy()
  })

  it('strikes the recipient when it is the impostor', () => {
    const { container } = wrap(
      <ShowMessageV2 message={{ id: 'x', user: REAL, recipient: IMPOSTOR, subject: 'Hi', createdAt: 1_000 }} />
    )
    expect(isStruck(nameElement(container, IMPOSTOR))).toBe(true)
    expect(struckNames(container)).toEqual([IMPOSTOR])
  })

  it('strikes the sender of a quoted earlier message and who quoted it', () => {
    const { container } = wrap(
      <ShowMessageV2Replies message={{ id: 'q', user: IMPOSTOR, subject: 'Old', createdAt: 1_000 }} quotedBy={IMPOSTOR} />
    )
    const struck = Array.from(container.querySelectorAll('[data-hidden-characters]'))
    expect(struck).toHaveLength(2)
    expect(struck.every(isStruck)).toBe(true)
    expect(container.querySelector('.MuiAvatar-root')?.textContent).toBe('S')
  })

  it('strikes a group thread post author', () => {
    const { container } = wrap(<ShowMessage message={{ name: IMPOSTOR, created: 1_000, textContentV2: '<p>hi</p>' }} />)
    expect(isStruck(nameElement(container, IMPOSTOR))).toBe(true)
    expect(screen.getByRole('article', { name: `Post by ${IMPOSTOR}` })).toBeTruthy()
  })
})

describe('threads', () => {
  it('strikes the thread owner', () => {
    const thread = { identifier: 't1', threadOwner: IMPOSTOR, threadData: { title: 'Plans', name: IMPOSTOR } } as any
    const { container } = wrap(<ThreadRow thread={thread} onOpen={() => {}} />)
    expect(isStruck(nameElement(container, IMPOSTOR))).toBe(true)
  })
})

describe('rail and aliases', () => {
  it('strikes an impostor own name, alias and reply alias in the rail, never a group', () => {
    const items = [
      { id: 'compose', label: 'Compose' },
      { id: 'alias-compose', label: 'Alias Compose', secondaryLabel: IMPOSTOR },
      { id: 'inbox', label: 'Inbox' },
      { id: 'inbox-instance:x', label: IMPOSTOR },
      { id: 'inbox-instance:y', label: REAL },
      { id: 'aliases', label: 'Aliases' },
      { id: 'aliases-instance:z', label: 'shop', secondaryLabel: IMPOSTOR },
      { id: 'threads', label: 'Q-Mail Threads', badgeText: '-' },
      { id: `threads-group:7`, label: `Devs${BLANK}` },
    ]
    const { container } = wrap(<Rail items={items} activeItemId="inbox" onSelect={() => {}} onOpenSettings={() => {}} version="1.0.0" />)
    expect(struckNames(container)).toEqual([IMPOSTOR, IMPOSTOR, IMPOSTOR])
    // The row's accessible name is the name itself, unchanged.
    expect(screen.getByRole('button', { name: IMPOSTOR })).toBeTruthy()
    expect(screen.getByRole('button', { name: REAL })).toBeTruthy()
  })

  it('strikes an impostor saved alias and its linked reply alias', () => {
    const { container } = wrap(
      <AliasesPage
        aliases={[IMPOSTOR, REAL]}
        aliasesWithMessages={[]}
        replyAliasLinks={{ [REAL.toLowerCase()]: IMPOSTOR }}
        onOpenAlias={() => {}}
        onAddAlias={() => {}}
        onRemoveAlias={() => {}}
        onSetReplyAlias={() => {}}
        onClearReplyAlias={() => {}}
        onRunAliasScan={() => {}}
        onCancelAliasScan={() => {}}
        hasScanCheckpoint={false}
        scanCheckpointTimestamp={0}
        scanState={{ isRunning: false, phase: 'idle', scannedCount: 0, totalCount: 0, discoveredCount: 0, statusMessage: '' } as any}
      />
    )
    expect(struckNames(container)).toEqual([IMPOSTOR, IMPOSTOR])
    expect(screen.getByText(/^Reply alias linked:/)).toBeTruthy()
  })
})
