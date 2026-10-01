import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Button } from '@mui/material'
import SendOutlinedIcon from '@mui/icons-material/SendOutlined'
import { RootState } from '../../state/store'
import { MAIL_SERVICE_TYPE } from '../../constants/mail'
import { GroupedMailboxList } from './GroupedMailboxList'
import { useMailboxSearch, type MailboxSearchStatus } from './useMailboxSearch'
import { useConfirmSheet } from './ConfirmSheet'
import { usePolling } from '../../hooks/usePolling'
import { setNotification } from '../../state/features/notificationsSlice'
import { objectToBase64 } from '../../utils/toBase64'
import { parseSentRecipientFromIdentifier } from './mailIdentifier'
import {
  SENT_DELETED_TAG,
  SENT_DELETED_TITLE,
  fetchSentDelta,
  fetchSentIndex,
  readDeletedSentIds,
  writeDeletedSentIds,
} from '../../utils/sentIndex'
import { SENT_INDEX_KEY, publishMailIndex } from './mailIndexStore'

interface SentMailProps {
  instanceName?: string | null
  instanceNames?: string[] | null
  onOpen: (
    user: string,
    identifier: string,
    content: any,
    to?: string
  ) => Promise<void>
  openedMessageId?: string | number | null
  /** The empty state's next action. */
  onCompose?: () => void
  /** The list pane's search box (Mail.tsx owns the query and the body limit). */
  searchQuery?: string
  bodySearchLimit?: number
  onSearchStatus?: (status: MailboxSearchStatus) => void
}

interface ResolvedRecipientInfo {
  name: string
  address: string
  publicKey: string
}

export const SENT_POLL_INTERVAL_MS = 30_000

const toStringOrEmpty = (value: any): string => {
  return typeof value === 'string' ? value.trim() : ''
}

const toErrorMessage = (error: any, fallback: string): string => {
  if (typeof error === 'string' && error.trim()) return error
  if (typeof error?.error === 'string' && error.error.trim()) return error.error
  if (typeof error?.message === 'string' && error.message.trim()) return error.message
  return fallback
}

const getAccountPublicKey = async (address: string): Promise<string | null> => {
  if (!address) return null
  const accountData = await qortalRequest({
    action: 'GET_ACCOUNT_DATA',
    address,
  })
  const publicKey = toStringOrEmpty(accountData?.publicKey)
  return publicKey || null
}

const resolveRecipientByName = async (
  recipientName: string
): Promise<ResolvedRecipientInfo | null> => {
  const normalizedName = toStringOrEmpty(recipientName)
  if (!normalizedName) return null

  const nameData = await qortalRequest({
    action: 'GET_NAME_DATA',
    name: normalizedName,
  })
  const owner = toStringOrEmpty(nameData?.owner)
  if (!owner) return null

  const publicKey = await getAccountPublicKey(owner)
  if (!publicKey) return null

  return {
    name: normalizedName,
    address: owner,
    publicKey,
  }
}

const resolveRecipientFromIdentifier = async (
  messageIdentifier: string
): Promise<ResolvedRecipientInfo | null> => {
  const { recipientName, recipientAddress } =
    parseSentRecipientFromIdentifier(messageIdentifier)

  const normalizedRecipientName = toStringOrEmpty(recipientName)
  const normalizedAddressSuffix = toStringOrEmpty(recipientAddress).toLowerCase()

  if (!normalizedRecipientName) {
    return null
  }

  // Alias-format identifiers only include the recipient name.
  if (!normalizedAddressSuffix) {
    return resolveRecipientByName(normalizedRecipientName)
  }

  const searchResults = await qortalRequest({
    action: 'SEARCH_NAMES',
    query: normalizedRecipientName,
    prefix: true,
    limit: 200,
    reverse: false,
  })

  if (!Array.isArray(searchResults) || !searchResults.length) {
    return null
  }

  const normalizedNamePrefix = normalizedRecipientName.toLowerCase()
  const match = searchResults.find((item: any) => {
    const candidateName = toStringOrEmpty(item?.name).toLowerCase()
    const candidateOwner = toStringOrEmpty(item?.owner).toLowerCase()

    return (
      Boolean(candidateName) &&
      candidateName.startsWith(normalizedNamePrefix) &&
      candidateOwner.endsWith(normalizedAddressSuffix)
    )
  })

  const matchedName = toStringOrEmpty(match?.name)
  const matchedOwner = toStringOrEmpty(match?.owner)
  if (!matchedName || !matchedOwner) {
    return null
  }

  const publicKey = await getAccountPublicKey(matchedOwner)
  if (!publicKey) {
    return null
  }

  return {
    name: matchedName,
    address: matchedOwner,
    publicKey,
  }
}

const resolveRecipientFromCachedMessage = async (
  messageIdentifier: string,
  hashMapMailMessages: Record<string, any>
): Promise<ResolvedRecipientInfo | null> => {
  const cachedMessage = hashMapMailMessages?.[messageIdentifier]
  if (!cachedMessage) return null

  const recipientName =
    toStringOrEmpty(cachedMessage?.recipient) ||
    toStringOrEmpty(cachedMessage?.to)

  if (!recipientName) return null

  return resolveRecipientByName(recipientName)
}

export const SentMail = ({
  instanceName,
  instanceNames,
  onOpen,
  openedMessageId,
  onCompose,
  searchQuery = '',
  bodySearchLimit = 0,
  onSearchStatus,
}: SentMailProps) => {
  const dispatch = useDispatch()
  const { user } = useSelector((state: RootState) => state.auth)
  const hashMapMailMessages = useSelector(
    (state: RootState) => state.mail.hashMapMailMessages
  )
  const activeInstanceNames = useMemo(() => {
    const values = Array.isArray(instanceNames) ? instanceNames : [];
    const fallback = values.length ? values : [instanceName || user?.name || ""];
    const deduped = new Map<string, string>();

    fallback.forEach(value => {
      const normalized = toStringOrEmpty(value);
      if (!normalized) return;
      const lower = normalized.toLowerCase();
      if (!deduped.has(lower)) {
        deduped.set(lower, normalized);
      }
    });

    return Array.from(deduped.values());
  }, [instanceName, instanceNames, user?.name]);
  const hasActiveInstances = activeInstanceNames.length > 0;

  const [mailMessages, setMailMessages] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [deletingMessageIds, setDeletingMessageIds] = useState<
    Record<string, boolean>
  >({})
  const [deletedMessageIds, setDeletedMessageIds] = useState<
    Record<string, boolean>
  >({})

  const deletedMessageIdsRef = useRef<Record<string, boolean>>({})
  const deletingMessageIdsRef = useRef<Record<string, boolean>>({})

  const { Sheet: DeleteConfirmSheet, confirm: showDeleteConfirmModal } =
    useConfirmSheet({
      title: 'Delete this sent message?',
      message:
        'It is replaced on QDN by an empty placeholder, so the recipient can no longer open it. Publishing the placeholder costs the usual fee.',
      confirmLabel: 'Delete',
      cancelLabel: 'Keep',
      destructive: true,
    })

  useEffect(() => {
    deletedMessageIdsRef.current = deletedMessageIds
  }, [deletedMessageIds])

  useEffect(() => {
    deletingMessageIdsRef.current = deletingMessageIds
  }, [deletingMessageIds])

  useEffect(() => {
    if (!hasActiveInstances) {
      setDeletedMessageIds({})
      deletedMessageIdsRef.current = {}
      return
    }

    const mergedDeletedIds: Record<string, boolean> = {}
    activeInstanceNames.forEach(name => {
      const deletedIdsForName = readDeletedSentIds(name)
      Object.keys(deletedIdsForName).forEach(identifier => {
        mergedDeletedIds[identifier] = true
      })
    })

    setDeletedMessageIds(mergedDeletedIds)
    deletedMessageIdsRef.current = mergedDeletedIds
  }, [activeInstanceNames, hasActiveInstances])

  const { results: searchedMessages, status: searchStatus } = useMailboxSearch({
    messages: mailMessages,
    query: searchQuery,
    mailboxType: 'sent',
    username: activeInstanceNames[0] || user?.name,
    hashMapMailMessages,
    enabled: hasActiveInstances,
    bodyLimit: bodySearchLimit,
  })

  useEffect(() => {
    onSearchStatus?.(searchStatus)
  }, [onSearchStatus, searchStatus])

  // Share the index with the cross-mailbox search.
  useEffect(() => {
    if (hasActiveInstances) publishMailIndex(SENT_INDEX_KEY, mailMessages)
  }, [hasActiveInstances, mailMessages])

  const markDeletedLocally = useCallback(
    (messageIdentifier: string, senderName?: string | null) => {
      const normalizedIdentifier = toStringOrEmpty(messageIdentifier)
      if (!normalizedIdentifier) return
      const normalizedSenderName = toStringOrEmpty(senderName)

      setDeletedMessageIds(previous => {
        if (previous[normalizedIdentifier]) {
          return previous
        }

        const next = {
          ...previous,
          [normalizedIdentifier]: true,
        }
        deletedMessageIdsRef.current = next
        if (normalizedSenderName) {
          const senderDeletedIds = readDeletedSentIds(normalizedSenderName)
          senderDeletedIds[normalizedIdentifier] = true
          writeDeletedSentIds(normalizedSenderName, senderDeletedIds)
        }
        return next
      })

      setMailMessages(previousMessages => {
        return previousMessages.filter(
          message => toStringOrEmpty(message?.id) !== normalizedIdentifier
        )
      })
    },
    []
  )

  const isDeletingMessage = useCallback(
    (messageIdentifier: string) => {
      return Boolean(deletingMessageIds[messageIdentifier])
    },
    [deletingMessageIds]
  )

  const fetchSentIndexes = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!hasActiveInstances) return

      const silent = Boolean(options?.silent)
      if (!silent) {
        setIsLoading(true)
        setLoadError(null)
      }

      try {
        const dedupedMessages = await fetchSentIndex(
          activeInstanceNames,
          deletedMessageIdsRef.current,
          silent ? { ttlMs: 0 } : undefined
        )
        setMailMessages(dedupedMessages)
      } catch (error) {
        if (!silent) {
          setLoadError(toErrorMessage(error, "Couldn't reach the node."))
        }
      } finally {
        if (!silent) {
          setIsLoading(false)
        }
      }
    },
    [activeInstanceNames, hasActiveInstances]
  )

  useEffect(() => {
    if (!hasActiveInstances) {
      setMailMessages([])
      return
    }

    setMailMessages([])
    void fetchSentIndexes()
  }, [fetchSentIndexes, hasActiveInstances])

  const mailMessagesRef = useRef<any[]>([])
  useEffect(() => {
    mailMessagesRef.current = mailMessages
  }, [mailMessages])

  // Polite delta poll (docs/QORTAL.md rule 7): newest 20 per name and query,
  // cut at the first known id, merged in front; `false` backs off.
  usePolling(
    async () => {
      if (!hasActiveInstances) return
      const known = new Set(mailMessagesRef.current.map(message => toStringOrEmpty(message?.id)))
      const fresh = await fetchSentDelta(activeInstanceNames, known, deletedMessageIdsRef.current)
      if (!fresh.length) return false
      setMailMessages(previous => {
        const knownNow = new Set(previous.map(message => toStringOrEmpty(message?.id)))
        const additions = fresh.filter(row => !knownNow.has(row.id))
        return additions.length ? [...additions, ...previous] : previous
      })
      return true
    },
    { intervalMs: SENT_POLL_INTERVAL_MS, enabled: hasActiveInstances }
  )

  const openMessage = useCallback(
    async (messageUser: string, messageIdentifier: string, content: any, to?: string) => {
      await onOpen(messageUser, messageIdentifier, content, to)
    },
    [onOpen]
  )

  const handleDeleteSentMessage = useCallback(
    async (message: any) => {
      if (!hasActiveInstances) return false

      const messageIdentifier = toStringOrEmpty(message?.id || message?.identifier)
      if (!messageIdentifier) {
        return false
      }

      if (deletingMessageIdsRef.current[messageIdentifier]) {
        return false
      }

      const userConfirmed = await showDeleteConfirmModal()
      if (!userConfirmed) {
        return false
      }

      setDeletingMessageIds(previous => ({
        ...previous,
        [messageIdentifier]: true,
      }))

      try {
        const recipientFromIdentifier = await resolveRecipientFromIdentifier(
          messageIdentifier
        )
        const resolvedRecipient =
          recipientFromIdentifier ||
          (await resolveRecipientFromCachedMessage(
            messageIdentifier,
            hashMapMailMessages
          ))

        if (!resolvedRecipient) {
          throw new Error(
            'Unable to resolve recipient for this message. Open it once, then try deleting again.'
          )
        }

        const deletedAt = Date.now()
        const tombstonePayload = {
          subject: SENT_DELETED_TITLE,
          createdAt: deletedAt,
          version: 1,
          attachments: [],
          textContentV2: '',
          generalData: {
            deleted: true,
            deletedAt,
            thread: [],
            threadV2: [],
          },
          recipient: resolvedRecipient.name,
        }

        const tombstoneData64 = await objectToBase64(tombstonePayload)
        const senderName =
          toStringOrEmpty(message?.user) || activeInstanceNames[0] || user?.name || ''
        if (!senderName) {
          throw new Error('Unable to resolve sender name for this message.')
        }
        const tombstoneResource = {
          action: 'PUBLISH_QDN_RESOURCE',
          name: senderName,
          service: MAIL_SERVICE_TYPE,
          identifier: messageIdentifier,
          data64: tombstoneData64,
          title: SENT_DELETED_TITLE,
          description: 'Q-Mail sent message deleted by sender',
          tags: [SENT_DELETED_TAG],
        }

        await qortalRequest({
          action: 'PUBLISH_MULTIPLE_QDN_RESOURCES',
          resources: [tombstoneResource],
          encrypt: true,
          publicKeys: [resolvedRecipient.publicKey],
        } as any)

        markDeletedLocally(messageIdentifier, senderName)
        dispatch(
          setNotification({
            msg: 'Sent message deleted.',
            alertType: 'success',
          })
        )

        return true
      } catch (error: any) {
        dispatch(
          setNotification({
            msg: toErrorMessage(error, 'Failed to delete sent message'),
            alertType: 'error',
          })
        )
        return false
      } finally {
        setDeletingMessageIds(previous => {
          if (!previous[messageIdentifier]) {
            return previous
          }

          const next = { ...previous }
          delete next[messageIdentifier]
          return next
        })
      }
    },
    [
      dispatch,
      hashMapMailMessages,
      markDeletedLocally,
      showDeleteConfirmModal,
      activeInstanceNames,
      hasActiveInstances,
      user?.name,
    ]
  )

  return (
    <>
      <GroupedMailboxList
        messages={searchedMessages}
        mailboxType='sent'
        openMessage={openMessage}
        openedMessageId={openedMessageId}
        onDeleteMessage={handleDeleteSentMessage}
        isDeletingMessage={isDeletingMessage}
        status={isLoading ? 'loading' : loadError ? 'error' : 'ready'}
        errorMessage={loadError || undefined}
        onRetry={() => void fetchSentIndexes()}
        highlightTerms={searchStatus.terms}
        emptyIcon={<SendOutlinedIcon />}
        emptyTitle={searchQuery.trim() ? 'No matches' : 'No sent mail yet'}
        emptyHint={
          searchQuery.trim()
            ? 'Try fewer words, or search message bodies.'
            : 'Mail you send shows up here once it is published.'
        }
        emptyAction={
          !searchQuery.trim() && onCompose ? (
            <Button variant='contained' onClick={onCompose} sx={{ minHeight: 44 }}>
              Compose
            </Button>
          ) : undefined
        }
      />
      <DeleteConfirmSheet />
    </>
  )
}
