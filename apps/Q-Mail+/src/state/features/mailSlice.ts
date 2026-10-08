import { createSlice } from '@reduxjs/toolkit'
import { RootState } from '../store'
import {
  withMessagesRead,
  withMessagesUnread,
  withPublishedReadState,
  type ReadStateMap,
} from '../../utils/readState'
import {
  withArchived,
  withPublishedArchived,
  withUnarchived,
  type ArchivedMap,
} from '../../utils/archiveState'
interface SavedSubject {
  timestamp: number;
  subject: string;
  attachments: boolean;
  /** Q-Mail+: the attachments' names, newline-separated, encrypted like the subject. */
  attachmentNames?: string;
}
interface GlobalState {
  posts: BlogPost[]
  filteredPosts: BlogPost[]
  hashMapPosts: Record<string, BlogPost>
  blogListPageNumber: number
  favorites: any[]
  favoritesLocal: any[] | null
  subscriptions: any[]
  subscriptionPosts: any[]
  countNewPosts: number
  isFiltering: boolean
  filterValue: string
  mailMessages: any[]
  hashMapMailMessages: Record<string, BlogPost>
  hashMapSavedSubjects : Record<string, SavedSubject>
  /** Local read/unread state (src/utils/readState.ts), loaded per account address. */
  readState: ReadStateMap
  /** The address `readState` was loaded for ('' until loaded); persistence is gated on it. */
  readStateAddress: string
  /** Locally archived received mail (src/utils/archiveState.ts), loaded per account address. */
  archived: ArchivedMap
  archivedAddress: string
}
const initialState: GlobalState = {
  posts: [],
  filteredPosts: [],
  hashMapPosts: {},
  blogListPageNumber: 0,
  favorites: [],
  favoritesLocal: null,
  subscriptions: [],
  subscriptionPosts: [],
  countNewPosts: 0,
  isFiltering: false,
  filterValue: '',
  mailMessages: [],
  hashMapMailMessages: {},
  hashMapSavedSubjects: {},
  readState: {},
  readStateAddress: '',
  archived: {},
  archivedAddress: ''
}

export interface BlogPost {
  title: string
  description: string
  createdAt: number | string
  user: string
  postImage?: string
  id: string
  category?: string
  categoryName?: string
  tags?: string[]
  updated?: number | string
  isValid?: boolean
  unableToDecrypt?: boolean
  subject?:string
  attachments?: any[]
}

export const mailSlice = createSlice({
  name: 'blog',
  initialState,
  reducers: {
    setBlogListPageNumber: (state, action) => {
      state.blogListPageNumber = action.payload
    },
    setIsFiltering: (state, action) => {
      state.isFiltering = action.payload
    },
    setFilterValue: (state, action) => {
      state.filterValue = action.payload
    },
    setCountNewPosts: (state, action) => {
      state.countNewPosts = action.payload
    },
    addPosts: (state, action) => {
      state.posts = action.payload
    },
    addFilteredPosts: (state, action) => {
      state.filteredPosts = action.payload
    },
    addSubscriptions: (state, action) => {
      state.subscriptions = action.payload
    },
    removeSubscription: (state, action) => {
      state.subscriptions = state.subscriptions.filter(
        (sub) => sub !== action.payload
      )
      state.subscriptionPosts = state.subscriptionPosts.filter(
        (post) => post.user !== action.payload
      )
    },
    addSubscription: (state, action) => {
      state.subscriptions.push(action.payload)
    },
    addFavorites: (state, action) => {
      state.favoritesLocal = action.payload
    },
    addFavorite: (state, action) => {
      state.favorites = action.payload
    },
    removePost: (state, action) => {
      const idToDelete = action.payload
      state.posts = state.posts.filter((item) => item.id !== idToDelete)
      state.filteredPosts = state.filteredPosts.filter(
        (item) => item.id !== idToDelete
      )
    },
    addPostToBeginning: (state, action) => {
      state.posts.unshift(action.payload)
    },
    updatePost: (state, action) => {
      const { id } = action.payload
      const index = state.posts.findIndex((post) => post.id === id)
      if (index !== -1) {
        state.posts[index] = { ...action.payload }
      }
      const index2 = state.filteredPosts.findIndex((post) => post.id === id)
      if (index2 !== -1) {
        state.filteredPosts[index2] = { ...action.payload }
      }
    },
    addToHashMapMail: (state, action) => {
      const message = action.payload
      state.hashMapMailMessages[message.id] = message
    },
    addAllHashMapSubject: (state, action) => {
      const subjects = action.payload
      state.hashMapSavedSubjects = subjects
    },
    addToHashMapSubject: (state, action) => {
      const subject = action.payload
      state.hashMapSavedSubjects[subject.id] = subject
    },
    clearMessages: (state) => {
      state.mailMessages = [];
      state.hashMapMailMessages = {};
    },
    setReadState: (
      state,
      action: { payload: { address: string; entries: ReadStateMap } }
    ) => {
      state.readStateAddress = action.payload.address || ''
      state.readState = action.payload.entries || {}
    },
    markRead: (state, action: { payload: { ids: string[]; at?: number } }) => {
      state.readState = withMessagesRead(
        state.readState,
        action.payload.ids,
        action.payload.at
      )
    },
    markUnread: (state, action: { payload: { ids: string[] } }) => {
      state.readState = withMessagesUnread(state.readState, action.payload.ids)
    },
    applyPublishedReadState: (
      state,
      action: { payload: { ids: string[]; at?: number } }
    ) => {
      state.readState = withPublishedReadState(
        state.readState,
        action.payload.ids,
        action.payload.at
      )
    },
    setArchivedState: (
      state,
      action: { payload: { address: string; entries: ArchivedMap } }
    ) => {
      state.archivedAddress = action.payload.address || ''
      state.archived = action.payload.entries || {}
    },
    archiveIds: (state, action: { payload: { ids: string[]; at?: number } }) => {
      state.archived = withArchived(
        state.archived,
        action.payload.ids,
        action.payload.at
      )
    },
    unarchiveIds: (state, action: { payload: { ids: string[] } }) => {
      state.archived = withUnarchived(state.archived, action.payload.ids)
    },
    applyPublishedArchived: (state, action: { payload: ArchivedMap }) => {
      state.archived = withPublishedArchived(state.archived, action.payload)
    },
    updateInHashMap: (state, action) => {
      const { id } = action.payload
      const post = action.payload
      state.hashMapPosts[id] = { ...post }
    },
    removeFromHashMap: (state, action) => {
      const idToDelete = action.payload
      delete state.hashMapPosts[idToDelete]
    },
    addArrayToHashMap: (state, action) => {
      const posts = action.payload
      posts.forEach((post: BlogPost) => {
        state.hashMapPosts[post.id] = post
      })
    },
    upsertMessages: (state, action) => {
      action.payload.forEach((message: any) => {
        const index = state.mailMessages.findIndex((p) => p.id === message.id)
        if (index !== -1) {
          state.mailMessages[index] = message
        } else {
          state.mailMessages.push(message)
        }
      })
    },
    upsertFilteredPosts: (state, action) => {
      action.payload.forEach((post: BlogPost) => {
        const index = state.filteredPosts.findIndex((p) => p.id === post.id)
        if (index !== -1) {
          state.filteredPosts[index] = post
        } else {
          state.filteredPosts.push(post)
        }
      })
    },
    upsertPostsBeginning: (state, action) => {
      action.payload.reverse().forEach((post: BlogPost) => {
        const index = state.posts.findIndex((p) => p.id === post.id)
        if (index !== -1) {
          state.posts[index] = post
        } else {
          state.posts.unshift(post)
        }
      })
    },
    upsertMessagesBeginning: (state, action) => {
      action.payload.reverse().forEach((message: BlogPost) => {
        const index = state.mailMessages.findIndex((p) => p.id === message.id)
        if (index !== -1) {
          state.mailMessages[index] = message
        } else {
          state.mailMessages.unshift(message)
        }
      })
    },
    upsertSubscriptionPosts: (state, action) => {
      action.payload.forEach((post: BlogPost) => {
        const index = state.subscriptionPosts.findIndex((p) => p.id === post.id)
        if (index !== -1) {
          state.subscriptionPosts[index] = post
        } else {
          state.subscriptionPosts.push(post)
        }
      })
    },
    populateFavorites: (state, action) => {
      action.payload.forEach((favorite: BlogPost) => {
        const index = state.favorites.findIndex((p) => p.id === favorite.id)
        if (index !== -1) {
          state.favorites[index] = favorite
        } else {
          state.favorites.push(favorite)
        }
      })
    },
    blockUser: (state, action) => {
      const username = action.payload
      state.posts = state.posts.filter((item) => item.user !== username)
      state.filteredPosts = state.filteredPosts.filter(
        (item) => item.user !== username
      )
      state.favorites = state.favorites.filter((item) => item.user !== username)
      state.subscriptionPosts = state.subscriptionPosts.filter(
        (item) => item.user !== username
      )

      if (state?.favoritesLocal) {
        state.favoritesLocal = state.favoritesLocal.filter(
          (item) => item.user !== username
        )
      }
    },
    /** Drops deleted messages (a "D" body) from the inbox list; their hash entries keep the `deleted` marker. */
    removeMessages: (state, action: { payload: { ids: string[] } }) => {
      const ids = new Set(action.payload.ids)
      state.mailMessages = state.mailMessages.filter((item) => !ids.has(item?.id))
    }
  }
})

export const {
  removeMessages,
  addPosts,
  updatePost,
  removePost,
  updateInHashMap,
  removeFromHashMap,
  setBlogListPageNumber,
  addFavorites,
  populateFavorites,
  addSubscriptions,
  removeSubscription,
  addSubscription,
  upsertSubscriptionPosts,
  blockUser,
  addPostToBeginning,
  setCountNewPosts,
  upsertPostsBeginning,
  upsertFilteredPosts,
  addFilteredPosts,
  setIsFiltering,
  setFilterValue,
  upsertMessages,
  addToHashMapMail,
  upsertMessagesBeginning,
  addAllHashMapSubject,
  addToHashMapSubject,
  clearMessages,
  setReadState,
  markRead,
  markUnread,
  applyPublishedReadState,
  setArchivedState,
  archiveIds,
  unarchiveIds,
  applyPublishedArchived
} = mailSlice.actions

export const selectReadState = (state: RootState): ReadStateMap =>
  state.mail.readState
export const selectReadStateAddress = (state: RootState): string =>
  state.mail.readStateAddress
export const selectArchived = (state: RootState): ArchivedMap =>
  state.mail.archived

export default mailSlice.reducer
