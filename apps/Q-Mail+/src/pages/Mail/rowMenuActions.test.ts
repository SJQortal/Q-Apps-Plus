import { describe, expect, it, vi } from 'vitest'
import { groupRowActions, messageRowActions } from './rowMenuActions'

const labels = (actions: Array<{ label: string }>) => actions.map((action) => action.label)
const fn = () => vi.fn()

describe('messageRowActions', () => {
  it('received and unread: open, reply, forward, mark read, archive, select', () => {
    const reply = vi.fn()
    const actions = messageRowActions({
      isFromSent: false,
      isUnread: true,
      open: fn(),
      reply,
      forward: fn(),
      markRead: fn(),
      markUnread: fn(),
      archive: fn(),
      toggleSelected: fn(),
    })
    expect(labels(actions)).toEqual(['Open', 'Reply', 'Reply all', 'Forward', 'Mark as read', 'Archive', 'Select'])
    actions.find((action) => action.id === 'replyAll')!.onSelect()
    expect(reply).toHaveBeenCalledWith(true)
  })

  it('read, archived and selected: mark unread, move to inbox, deselect', () => {
    const actions = messageRowActions({ isFromSent: false, isUnread: false, selected: true, open: fn(), markRead: fn(), markUnread: fn(), unarchive: fn(), toggleSelected: fn() })
    expect(labels(actions)).toEqual(['Open', 'Mark as unread', 'Move to inbox', 'Deselect'])
  })

  it('sent: no reply or read marks, and delete', () => {
    const actions = messageRowActions({ isFromSent: true, isUnread: false, open: fn(), reply: fn(), forward: fn(), markUnread: fn(), remove: fn() })
    expect(labels(actions)).toEqual(['Open', 'Forward', 'Delete sent message'])
  })

  it('only what the list offers', () => {
    expect(labels(messageRowActions({ isFromSent: false, isUnread: true, open: fn() }))).toEqual(['Open'])
  })
})

describe('groupRowActions', () => {
  it('a group with unread mail', () => {
    const actions = groupRowActions({ count: 3, unreadCount: 1, expanded: false, allSelected: false, toggleExpanded: fn(), markRead: fn(), markUnread: fn(), archive: fn(), toggleSelected: fn() })
    expect(labels(actions)).toEqual(['Show the 3 messages', 'Mark all as read', 'Mark all as unread', 'Archive all', 'Select all 3'])
  })

  it('an open, all-read, all-selected group in the archive', () => {
    const actions = groupRowActions({ count: 2, unreadCount: 0, expanded: true, allSelected: true, toggleExpanded: fn(), markRead: fn(), markUnread: fn(), unarchive: fn(), toggleSelected: fn() })
    expect(labels(actions)).toEqual(['Hide the messages', 'Mark all as unread', 'Move all to inbox', 'Deselect all'])
  })
})
