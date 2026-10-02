import { createSlice } from '@reduxjs/toolkit';
import { isAvatarUrl } from '../../utils/avatarCache';


interface GlobalState {
  isOpenPublishBlogModal: boolean
  isLoadingCurrentBlog: boolean
  isLoadingGlobal: boolean
  isLoadingCustom: null | string;
  isOpenEditBlogModal: boolean
  currentBlog: {
    createdAt: number
    blogId: string
    title: string
    description: string
    blogImage: string
    category?: string
    tags?: string[]
    navbarConfig?: any
  } | null
  visitingBlog: {
    createdAt: number
    blogId: string
    title: string
    description: string
    blogImage: string
    category?: string
    tags?: string[]
    navbarConfig?: any
    name?: string
  } | null
  downloads: any
  userAvatarHash: Record<string, string>
  privateGroups: Record<string, any>
  hasFetchedPrivateGroups: boolean
}
const initialState: GlobalState = {
  isOpenPublishBlogModal: false,
  isLoadingCurrentBlog: true,
  isLoadingGlobal: false,
  isLoadingCustom: null,
  currentBlog: null,
  isOpenEditBlogModal: false,
  visitingBlog: null,
  downloads: {},
  userAvatarHash: {},
  privateGroups: {},
  hasFetchedPrivateGroups: false
}

export const globalSlice = createSlice({
  name: 'global',
  initialState,
  reducers: {
    togglePublishBlogModal: (state, action) => {
      state.isOpenPublishBlogModal = action.payload
    },
    toggleEditBlogModal: (state, action) => {
      state.isOpenEditBlogModal = action.payload
    },
    setCurrentBlog: (state, action) => {
      state.currentBlog = action.payload
      state.isLoadingCurrentBlog = false
    },
    setVisitingBlog: (state, action) => {
      state.visitingBlog = action.payload
      state.isLoadingCurrentBlog = false
    },
    setIsLoadingGlobal: (state, action) => {
      state.isLoadingGlobal = action.payload
    },
    setIsLoadingCustom: (state, action) => {
      state.isLoadingCustom = action.payload
    },
    setAddToDownloads: (state, action) => {
      const download = action.payload
      state.downloads[download.identifier] = download
    },
    updateDownloads: (state, action) => {
      const { identifier } = action.payload
      const download = action.payload
      state.downloads[identifier] = {
        ...state.downloads[identifier],
        ...download
      }
    },
    setUserAvatarHash: (state, action) => {
      const avatar = action.payload
      // Only real URLs: Hub's "Resource does not exist" answer used to be
      // stored here and handed to <Avatar src> (Bugs #7).
      if (avatar?.name && isAvatarUrl(avatar?.url)) {
        if (state.userAvatarHash[avatar.name] !== avatar.url) {
          state.userAvatarHash[avatar.name] = avatar.url
        }
      }
    },
    setPrivateGroups: (state, action) => {
      state.privateGroups = action.payload
      state.hasFetchedPrivateGroups = true
    },
  }
})

export const {
  togglePublishBlogModal,
  setCurrentBlog,
  setIsLoadingGlobal,
  toggleEditBlogModal,
  setVisitingBlog,
  setAddToDownloads,
  updateDownloads,
  setUserAvatarHash,
  setPrivateGroups,
  setIsLoadingCustom
} = globalSlice.actions

export default globalSlice.reducer;