import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Box, CircularProgress } from '@mui/material'
import { RootState } from '../../state/store'
import { MAIL_SERVICE_TYPE } from '../../constants/mail'
import { GroupedMailboxList } from './GroupedMailboxList'
import { useMailboxSearch } from './useMailboxSearch'
import { MailboxSearchBar } from './MailboxSearchBar'
import useConfirmationModal from '../../hooks/useConfirmModal'
import { setNotification } from '../../state/features/notificationsSlice'
import { objectToBase64 } from '../../utils/toBase64'
import {
  isSentMailIdentifier,
  parseSentRecipientFromIdentifier,
} from './mailIdentifier'

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
}

interface ResolvedRecipientInfo {
  name: string
  address: string
  publicKey: string
}

const SENT_DELETED_TITLE = '__qmail_deleted__'
const SENT_DELETED_TAG = 'qmail-deleted'
const LEGACY_SENT_QUERY = 'qortal_qmail_'

type SentQueryConfig = {
  query: string
  identifier?: string
  matchesIdentifier: (identifier: string) => boolean
}

const SENT_QUERY_CONFIGS: SentQueryConfig[] = [
  {
    query: '_mail_qortal_qmail_',
    identifier: '_mail_',
    matchesIdentifier: identifier => {
      return identifier.toLowerCase().startsWith('_mail_qortal_qmail_')
    },
  },
  {
    query: LEGACY_SENT_QUERY,
    matchesIdentifier: identifier => {
      return identifier.toLowerCase().startsWith(LEGACY_SENT_QUERY)
    },
  },
]

const toStringOrEmpty = (value: any): string => {
  return typeof value === 'string' ? value.trim() : ''
}

const toErrorMessage = (error: any, fallback: string): string => {
  if (typeof error === 'string' && error.trim()) return error
  if (typeof error?.error === 'string' && error.error.trim()) return error.error
  if (typeof error?.message === 'string' && error.message.trim()) return error.message
  return fallback
}

const getDeletedSentStorageKey = (username: string): string => {
  return `qmail_deleted_sent_${username}`
}

const readDeletedSentIds = (username: string): Record<string, boolean> => {
  try {
    const raw = localStorage.getItem(getDeletedSentStorageKey(username))
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return {}

    return parsed.reduce<Record<string, boolean>>((accumulator, identifier) => {
      const value = toStringOrEmpty(identifier)
      if (value) {
        accumulator[value] = true
      }
      return accumulator
    }, {})
  } catch {
    return {}
  }
}

const writeDeletedSentIds = (
  username: string,
  deletedIds: Record<string, boolean>
): void => {
  try {
    localStorage.setItem(
      getDeletedSentStorageKey(username),
      JSON.stringify(Object.keys(deletedIds))
    )
  } catch {
    // Ignore storage failures in private browsing or restricted environments.
  }
}

const isDeletedSentResource = (resource: any): boolean => {
  const title = toStringOrEmpty(resource?.metadata?.title).toLowerCase()
  if (title === SENT_DELETED_TITLE.toLowerCase()) {
    return true
  }

  const tags = Array.isArray(resource?.metadata?.tags)
    ? resource.metadata.tags
    : []

  return tags.some((tag: any) => {
    const normalizedTag = toStringOrEmpty(tag).toLowerCase()
    return (
      normalizedTag === SENT_DELETED_TAG ||
      normalizedTag === SENT_DELETED_TITLE.toLowerCase()
    )
  })
}

const shouldHideSentResource = (
  resource: any,
  locallyDeletedIds: Record<string, boolean>
): boolean => {
  const identifier = toStringOrEmpty(resource?.identifier)
  if (identifier && locallyDeletedIds[identifier]) {
    return true
  }

  return isDeletedSentResource(resource)
}

const mapMailResources = (resources: any[]) => {
  return resources.map((post: any) => {
    return {
      title: post?.metadata?.title,
      category: post?.metadata?.category,
      categoryName: post?.metadata?.categoryName,
      tags: post?.metadata?.tags || [],
      description: post?.metadata?.description,
      createdAt: post?.created,
      updated: post?.updated,
      user: post.name,
      id: post.identifier,
    }
  })
}

const sortByCreatedDescending = (a: any, b: any) => {
  return Number(b?.createdAt || 0) - Number(a?.createdAt || 0)
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
  const [searchQuery, setSearchQuery] = useState('')
  const [deletingMessageIds, setDeletingMessageIds] = useState<
    Record<string, boolean>
  >({})
  const [deletedMessageIds, setDeletedMessageIds] = useState<
    Record<string, boolean>
  >({})

  const deletedMessageIdsRef = useRef<Record<string, boolean>>({})
  const deletingMessageIdsRef = useRef<Record<string, boolean>>({})

  const { Modal: DeleteConfirmModal, showModal: showDeleteConfirmModal } =
    useConfirmationModal({
      title: 'Delete sent message?',
      message:
        'This republishes the same message identifier with minimal deleted content. A publish fee applies. Continue?',
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
  })

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
      }

      try {
        const pageSize = 200
        const allResources: any[] = []

        for (const name of activeInstanceNames) {
          for (const queryConfig of SENT_QUERY_CONFIGS) {
            let offset = 0
            let hasMore = true

            while (hasMore) {
              const params = new URLSearchParams({
                mode: 'ALL',
                service: MAIL_SERVICE_TYPE,
                query: queryConfig.query,
                name,
                exactmatchnames: 'true',
                limit: String(pageSize),
                includemetadata: 'true',
                offset: String(offset),
                reverse: 'true',
                excludeblocked: 'true',
              })

              if (queryConfig.identifier) {
                params.set('identifier', queryConfig.identifier)
              }

              const response = await fetch(
                `/arbitrary/resources/search?${params.toString()}`,
                {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                }
              )
              const responseData = await response.json()

              if (!Array.isArray(responseData) || responseData.length === 0) {
                break
              }

              const visibleResources = responseData.filter(resource => {
                const identifier = toStringOrEmpty(resource?.identifier)
                if (!identifier) return false
                if (!queryConfig.matchesIdentifier(identifier)) return false
                if (!isSentMailIdentifier(identifier)) return false
                return !shouldHideSentResource(resource, deletedMessageIdsRef.current)
              })
              allResources.push(...visibleResources)

              if (responseData.length < pageSize) {
                hasMore = false
              } else {
                offset += responseData.length
              }
            }
          }
        }

        const structureData = mapMailResources(allResources)
        const seen = new Set<string>()
        const dedupedMessages = structureData.filter(message => {
          if (!message?.id || seen.has(message.id)) {
            return false
          }
          if (deletedMessageIdsRef.current[message.id]) {
            return false
          }
          seen.add(message.id)
          return true
        })

        dedupedMessages.sort(sortByCreatedDescending)
        setMailMessages(dedupedMessages)
      } catch (error) {
      } finally {
        if (!silent) {
          setIsLoading(false)
        }
      }
    },
    [activeInstanceNames, hasActiveInstances]
  )

  const checkNewMessages = useCallback(async () => {
    if (!hasActiveInstances) return

    try {
      await fetchSentIndexes({ silent: true })
    } catch (error) {
    }
  }, [fetchSentIndexes, hasActiveInstances])

  useEffect(() => {
    if (!hasActiveInstances) {
      setMailMessages([])
      setSearchQuery('')
      return
    }

    setMailMessages([])
    setSearchQuery('')
    void fetchSentIndexes()
  }, [fetchSentIndexes, hasActiveInstances])

  const interval = useRef<any>(null)
  useEffect(() => {
    if (!hasActiveInstances) return

    let isCalling = false
    interval.current = setInterval(async () => {
      if (isCalling) return
      isCalling = true
      await checkNewMessages()
      isCalling = false
    }, 30000)

    return () => {
      if (interval.current) {
        clearInterval(interval.current)
      }
    }
  }, [checkNewMessages, hasActiveInstances])

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
      <MailboxSearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder='Search sent messages...'
        status={searchStatus}
      />
      <GroupedMailboxList
        messages={searchedMessages}
        mailboxType='sent'
        openMessage={openMessage}
        openedMessageId={openedMessageId}
        onDeleteMessage={handleDeleteSentMessage}
        isDeletingMessage={isDeletingMessage}
      />
      {isLoading && (
        <Box
          sx={{
            display: 'flex',
            width: '100%',
            justifyContent: 'center',
            pt: '10px',
          }}
        >
          <CircularProgress />
        </Box>
      )}
      <DeleteConfirmModal />
    </>
  )
}
