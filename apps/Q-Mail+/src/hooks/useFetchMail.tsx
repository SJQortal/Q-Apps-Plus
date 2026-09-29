import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  addPosts,
  addToHashMap,
  BlogPost,
  populateFavorites,
  setCountNewPosts,
  upsertFilteredPosts,
  upsertPosts,
  upsertPostsBeginning,
  upsertSubscriptionPosts
} from '../state/features/blogSlice'
import {
  setCurrentBlog,
  setIsLoadingGlobal,
  setUserAvatarHash
} from '../state/features/globalSlice'
import { RootState } from '../state/store'
import { fetchAndEvaluatePosts } from '../utils/fetchPosts'
import { fetchAndEvaluateMail } from '../utils/fetchMail'
import {
  addToHashMapMail,
  upsertMessages,
  upsertMessagesBeginning
} from '../state/features/mailSlice'
import { MAIL_SERVICE_TYPE } from '../constants/mail'

export const useFetchMail = () => {
  const dispatch = useDispatch()
  const hashMapPosts = useSelector(
    (state: RootState) => state.blog.hashMapPosts
  )
  const hashMapMailMessages = useSelector(
    (state: RootState) => state.mail.hashMapMailMessages
  )
  const posts = useSelector((state: RootState) => state.blog.posts)
  const mailMessages = useSelector(
    (state: RootState) => state.mail.mailMessages
  )

  const filteredPosts = useSelector(
    (state: RootState) => state.blog.filteredPosts
  )
  const favoritesLocal = useSelector(
    (state: RootState) => state.blog.favoritesLocal
  )
  const favorites = useSelector((state: RootState) => state.blog.favorites)
  const subscriptionPosts = useSelector(
    (state: RootState) => state.blog.subscriptionPosts
  )
  const subscriptions = useSelector(
    (state: RootState) => state.blog.subscriptions
  )

  const checkAndUpdatePost = React.useCallback(
    (post: BlogPost) => {
      // Check if the post exists in hashMapPosts
      const existingPost = hashMapPosts[post.id]
      if (!existingPost) {
        // If the post doesn't exist, add it to hashMapPosts
        return true
      } else if (
        post?.updated &&
        existingPost?.updated &&
        (!existingPost?.updated || post?.updated) > existingPost?.updated
      ) {
        // If the post exists and its updated is more recent than the existing post's updated, update it in hashMapPosts
        return true
      } else {
        return false
      }
    },
    [hashMapPosts]
  )

  const getBlogPost = async (user: string, postId: string, content: any) => {
    const res = await fetchAndEvaluatePosts({
      user,
      postId,
      content
    })

    dispatch(addToHashMap(res))
  }

  const getMailMessage = async (user: string, postId: string, content: any) => {
    const res = await fetchAndEvaluateMail({
      user,
      postId,
      content
    })

    dispatch(addToHashMapMail(res))
  }

  const checkNewMessages = React.useCallback(
    async (recipientName: string, recipientAddress: string) => {
      try {
        const query = `qortal_qmail_${recipientName.slice(
          0,
          20
        )}_${recipientAddress.slice(-6)}_mail_`
        const encodedQuery = encodeURIComponent(query)
        const url = `/arbitrary/resources/search?mode=ALL&service=${MAIL_SERVICE_TYPE}&query=${encodedQuery}&limit=20&includemetadata=true&reverse=true&excludeblocked=true`
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })
        const responseData = await response.json()
        const latestPost = mailMessages[0]
        if (!latestPost) return
        const findPost = responseData?.findIndex(
          (item: any) => item?.identifier === latestPost?.id
        )
        if (findPost === -1) {
          return
        }
        const newArray = responseData.slice(0, findPost)
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
        return
      } catch (error) {}
    },
    [mailMessages]
  )

  const getNewPosts = React.useCallback(async () => {
    try {
      dispatch(setIsLoadingGlobal(true))
      dispatch(setCountNewPosts(0))
      const url = `/arbitrary/resources/search?mode=ALL&service=BLOG_POST&query=q-blog-&limit=20&includemetadata=true&reverse=true&excludeblocked=true`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const responseData = await response.json()
      const latestPost = posts[0]
      if (!latestPost) return
      const findPost = responseData?.findIndex(
        (item: any) => item?.identifier === latestPost?.id
      )
      let fetchAll = responseData
      let willFetchAll = true
      if (findPost !== -1) {
        willFetchAll = false
        fetchAll = responseData.slice(0, findPost)
      }

      const structureData = fetchAll.map((post: any): BlogPost => {
        return {
          title: post?.metadata?.title,
          category: post?.metadata?.category,
          categoryName: post?.metadata?.categoryName,
          tags: post?.metadata?.tags || [],
          description: post?.metadata?.description,
          createdAt: post?.created,
          updated: post?.updated,
          user: post.name,
          postImage: '',
          id: post.identifier
        }
      })
      if (!willFetchAll) {
        dispatch(upsertPostsBeginning(structureData))
      }
      if (willFetchAll) {
        dispatch(addPosts(structureData))
      }

      for (const content of structureData) {
        if (content.user && content.id) {
          const res = checkAndUpdatePost(content)
          if (res) {
            getBlogPost(content.user, content.id, content)
          }
        }
      }
    } catch (error) {
    } finally {
      dispatch(setIsLoadingGlobal(false))
    }
  }, [posts, hashMapPosts])

  const getBlogPosts = React.useCallback(async () => {
    try {
      const offset = posts.length

      dispatch(setIsLoadingGlobal(true))
      const url = `/arbitrary/resources/search?mode=ALL&service=BLOG_POST&query=q-blog-&limit=20&includemetadata=true&offset=${offset}&reverse=true&excludeblocked=true`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const responseData = await response.json()
      const structureData = responseData.map((post: any): BlogPost => {
        return {
          title: post?.metadata?.title,
          category: post?.metadata?.category,
          categoryName: post?.metadata?.categoryName,
          tags: post?.metadata?.tags || [],
          description: post?.metadata?.description,
          createdAt: post?.created,
          updated: post?.updated,
          user: post.name,
          postImage: '',
          id: post.identifier
        }
      })
      dispatch(upsertPosts(structureData))

      for (const content of structureData) {
        if (content.user && content.id) {
          const res = checkAndUpdatePost(content)
          if (res) {
            getBlogPost(content.user, content.id, content)
          }
        }
      }
    } catch (error) {
    } finally {
      dispatch(setIsLoadingGlobal(false))
    }
  }, [posts, hashMapPosts])

  const getAvatar = async (user: string) => {
    try {
      let url = await qortalRequest({
        action: 'GET_QDN_RESOURCE_URL',
        name: user,
        service: 'THUMBNAIL',
        identifier: 'qortal_avatar'
      })
      dispatch(
        setUserAvatarHash({
          name: user,
          url
        })
      )
    } catch (error) {}
  }

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

  const getAllMailMessages = React.useCallback(
    async (recipientName: string, recipientAddress: string) => {
      try {
        const query = `qortal_qmail_${recipientName.slice(
          0,
          20
        )}_${recipientAddress.slice(-6)}_mail_`
        const encodedQuery = encodeURIComponent(query)
        const pageSize = 200
        let offset = 0
        let hasMore = true
        const allMessages: BlogPost[] = []

        while (hasMore) {
          const url = `/arbitrary/resources/search?mode=ALL&service=${MAIL_SERVICE_TYPE}&query=${encodedQuery}&limit=${pageSize}&includemetadata=false&offset=${offset}&reverse=true&excludeblocked=true`
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          })
          const responseData = await response.json()
          if (!Array.isArray(responseData) || responseData.length === 0) {
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

        for (const content of allMessages) {
          if (content.user && content.id) {
            getAvatar(content.user)
          }
        }
      } catch (error) {
      } finally {
      }
    },
    [dispatch]
  )

  const getMailMessages = React.useCallback(
    async (recipientName: string, recipientAddress: string) => {
      try {
        const offset = mailMessages.length

        // dispatch(setIsLoadingGlobal(true))
        const query = `qortal_qmail_${recipientName.slice(
          0,
          20
        )}_${recipientAddress.slice(-6)}_mail_`
        const encodedQuery = encodeURIComponent(query)
        const url = `/arbitrary/resources/search?mode=ALL&service=${MAIL_SERVICE_TYPE}&query=${encodedQuery}&limit=20&includemetadata=true&offset=${offset}&reverse=true&excludeblocked=true`
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })
        const responseData = await response.json()
        const structureData = mapMailResources(responseData)
        dispatch(upsertMessages(structureData))

        for (const content of structureData) {
          if (content.user && content.id) {
            getAvatar(content.user)
          }
        }
      } catch (error) {
      } finally {
        // dispatch(setIsLoadingGlobal(false))
      }
    },
    [mailMessages, hashMapMailMessages]
  )
  const getBlogFilteredPosts = React.useCallback(
    async (filterValue: string) => {
      try {
        const offset = filteredPosts.length

        dispatch(setIsLoadingGlobal(true))
        const encodedFilterValue = encodeURIComponent(filterValue)
        const url = `/arbitrary/resources/search?mode=ALL&service=BLOG_POST&query=q-blog-&limit=20&includemetadata=true&offset=${offset}&reverse=true&excludeblocked=true&name=${encodedFilterValue}`
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })
        const responseData = await response.json()
        const structureData = responseData.map((post: any): BlogPost => {
          return {
            title: post?.metadata?.title,
            category: post?.metadata?.category,
            categoryName: post?.metadata?.categoryName,
            tags: post?.metadata?.tags || [],
            description: post?.metadata?.description,
            createdAt: post?.created,
            updated: post?.updated,
            user: post.name,
            postImage: '',
            id: post.identifier
          }
        })
        dispatch(upsertFilteredPosts(structureData))

        for (const content of structureData) {
          if (content.user && content.id) {
            const res = checkAndUpdatePost(content)
            if (res) {
              getBlogPost(content.user, content.id, content)
            }
          }
        }
      } catch (error) {
      } finally {
        dispatch(setIsLoadingGlobal(false))
      }
    },
    [filteredPosts, hashMapPosts]
  )

  const getBlogPostsSubscriptions = React.useCallback(
    async (username: string) => {
      try {
        const offset = subscriptionPosts.length
        dispatch(setIsLoadingGlobal(true))
        const encodedNameFilter = encodeURIComponent(`q-blog-subscriptions-${username}`)
        const url = `/arbitrary/resources/search?mode=ALL&service=BLOG_POST&query=q-blog-&limit=20&includemetadata=true&offset=${offset}&reverse=true&namefilter=${encodedNameFilter}&excludeblocked=true`
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })
        const responseData = await response.json()
        const structureData = responseData.map((post: any): BlogPost => {
          return {
            title: post?.metadata?.title,
            category: post?.metadata?.category,
            categoryName: post?.metadata?.categoryName,
            tags: post?.metadata?.tags || [],
            description: post?.metadata?.description,
            createdAt: '',
            user: post.name,
            postImage: '',
            id: post.identifier
          }
        })
        dispatch(upsertSubscriptionPosts(structureData))

        for (const content of structureData) {
          if (content.user && content.id) {
            const res = checkAndUpdatePost(content)
            if (res) {
              getBlogPost(content.user, content.id, content)
            }
          }
        }
      } catch (error) {
      } finally {
        dispatch(setIsLoadingGlobal(false))
      }
    },
    [subscriptionPosts, hashMapPosts, subscriptions]
  )

  const getBlogPostsFavorites = React.useCallback(async () => {
    try {
      const offset = favorites.length
      const favSlice = (favoritesLocal || []).slice(offset, 20)
      let favs = []
      for (const item of favSlice) {
        try {
          //   await qortalRequest({
          //     action: "SEARCH_QDN_RESOURCES",
          //     service: "THUMBNAIL",
          //     query: "search query goes here", // Optional - searches both "identifier" and "name" fields
          //     identifier: "search query goes here", // Optional - searches only the "identifier" field
          //     name: "search query goes here", // Optional - searches only the "name" field
          //     prefix: false, // Optional - if true, only the beginning of fields are matched in all of the above filters
          //     default: false, // Optional - if true, only resources without identifiers are returned
          //     includeStatus: false, // Optional - will take time to respond, so only request if necessary
          //     includeMetadata: false, // Optional - will take time to respond, so only request if necessary
          //     limit: 100,
          //     offset: 0,
          //     reverse: true
          // });
          //TODO - NAME SHOULD BE EXACT
          const encodedUserName = encodeURIComponent(item.user)
          const url = `/arbitrary/resources/search?mode=ALL&service=BLOG_POST&identifier=${item.id}&exactmatchnames=true&name=${encodedUserName}&limit=20&includemetadata=true&reverse=true&excludeblocked=true`
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          })
          const data = await response.json()
          //
          if (data.length > 0) {
            favs.push(data[0])
          }
        } catch (error) {}
      }
      const structureData = favs.map((post: any): BlogPost => {
        return {
          title: post?.metadata?.title,
          category: post?.metadata?.category,
          categoryName: post?.metadata?.categoryName,
          tags: post?.metadata?.tags || [],
          description: post?.metadata?.description,
          createdAt: '',
          user: post.name,
          postImage: '',
          id: post.identifier
        }
      })
      dispatch(populateFavorites(structureData))

      for (const content of structureData) {
        if (content.user && content.id) {
          const res = checkAndUpdatePost(content)
          if (res) {
            getBlogPost(content.user, content.id, content)
          }
        }
      }
    } catch (error) {
    } finally {
    }
  }, [hashMapPosts, favoritesLocal])
  return {
    getBlogPosts,
    getBlogPostsFavorites,
    getBlogPostsSubscriptions,
    checkAndUpdatePost,
    getBlogPost,
    hashMapPosts,
    checkNewMessages,
    getNewPosts,
    getBlogFilteredPosts,
    getMailMessages,
    getAllMailMessages
  }
}
