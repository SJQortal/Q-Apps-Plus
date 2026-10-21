/**
 * The primary inbox: the full index on load and the limit-20 poll. The Q-Blog
 * functions that shared this hook (getBlogPosts, getNewPosts, favourites,
 * subscriptions: docs/apps/Q-Mail+.md → Data contract §14) were never called
 * at runtime and are gone; the two mail functions below are unchanged.
 */
import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { BlogPost } from '../state/features/blogSlice'
import { RootState } from '../state/store'
import { upsertMessages, upsertMessagesBeginning } from '../state/features/mailSlice'
import { MAIL_SERVICE_TYPE } from '../constants/mail'
import { searchResources } from '../utils/qdnSearch'

export const useFetchMail = () => {
  const dispatch = useDispatch()
  const mailMessages = useSelector(
    (state: RootState) => state.mail.mailMessages
  )

  /**
   * The new-mail poll for the primary name: one limit-20 search (always to the
   * node, TTL 0). Resolves to the number of messages added. Unlike the original,
   * it does not give up when the newest known message is not among the 20 (or
   * the inbox is empty): every unknown row is added instead (Bugs #20).
   */
  const checkNewMessages = React.useCallback(
    async (recipientName: string, recipientAddress: string): Promise<number> => {
      try {
        const query = `qortal_qmail_${recipientName.slice(
          0,
          20
        )}_${recipientAddress.slice(-6)}_mail_`
        const responseData = await searchResources(
          {
            mode: 'ALL',
            service: MAIL_SERVICE_TYPE,
            query,
            limit: 20,
            includemetadata: true,
            reverse: true,
            excludeblocked: true
          },
          { ttlMs: 0 }
        )
        const latestPost = mailMessages[0]
        const findPost = latestPost
          ? responseData.findIndex(
              (item: any) => item?.identifier === latestPost?.id
            )
          : -1
        const knownIds = new Set(mailMessages.map((item: any) => item?.id))
        const newArray = (findPost === -1
          ? responseData
          : responseData.slice(0, findPost)
        ).filter((item: any) => item?.identifier && !knownIds.has(item.identifier))
        if (!newArray.length) return 0
        const structureData = newArray.map((post: any): BlogPost => {
          return {
            title: post?.metadata?.title,
            category: post?.metadata?.category,
            categoryName: post?.metadata?.categoryName,
            tags: post?.metadata?.tags || [],
            description: post?.metadata?.description,
            createdAt: post?.created,
            updated: post?.updated,
            user: post.name,
            id: post.identifier
          }
        })
        dispatch(upsertMessagesBeginning(structureData))
        return structureData.length
      } catch (error) {
        return 0
      }
    },
    [dispatch, mailMessages]
  )


  const mapMailResources = (resources: any[]): BlogPost[] => {
    return resources.map((post: any): BlogPost => {
      return {
        title: post?.metadata?.title,
        category: post?.metadata?.category,
        categoryName: post?.metadata?.categoryName,
        tags: post?.metadata?.tags || [],
        description: post?.metadata?.description,
        createdAt: post?.created,
        updated: post?.updated,
        user: post.name,
        id: post.identifier
      }
    })
  }

  /** The whole inbox index of the primary name, 200 per page, through the session cache. */
  const getAllMailMessages = React.useCallback(
    async (recipientName: string, recipientAddress: string) => {
      // Errors reach the caller (Mail.getMessages), which shows an error state with Retry.
      const query = `qortal_qmail_${recipientName.slice(
        0,
        20
      )}_${recipientAddress.slice(-6)}_mail_`
      const pageSize = 200
      let offset = 0
      let hasMore = true
      const allMessages: BlogPost[] = []

      while (hasMore) {
        const responseData = await searchResources({
          mode: 'ALL',
          service: MAIL_SERVICE_TYPE,
          query,
          limit: pageSize,
          includemetadata: false,
          offset,
          reverse: true,
          excludeblocked: true
        })
        if (responseData.length === 0) {
          break
        }

        const structureData = mapMailResources(responseData)
        allMessages.push(...structureData)

        if (responseData.length < pageSize) {
          hasMore = false
        } else {
          offset += responseData.length
        }
      }

      dispatch(upsertMessages(allMessages))
      // Avatars are resolved lazily per visible row (src/utils/avatarCache.ts).
    },
    [dispatch]
  )

  return {
    checkNewMessages,
    getAllMailMessages
  }
}
