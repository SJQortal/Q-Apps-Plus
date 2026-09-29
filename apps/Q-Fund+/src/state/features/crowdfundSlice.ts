import { createSlice } from '@reduxjs/toolkit';
import { RootState } from '../store'
interface GlobalState {
  hashMapCrowdfunds: Record<string, Crowdfund>
  crowdfunds: Crowdfund[]
}

const initialState: GlobalState = {
  hashMapCrowdfunds: {},
  crowdfunds: []
}

export interface Crowdfund {
  title: string
  description: string
  created: number 
  user: string
  attachments?: any[]
  id: string
  category?: string
  categoryName?: string
  tags?: string[]
  inlineContent?: string
  updated?: number | string
  isValid?: boolean
  coverImage?: string
  deployedAT?: any
}
// export interface Crowdfund {
//   title: string
//   description: string
//   created: number
//   user: string
//   attachments?: any[]
//   id: string
//   category?: string
//   categoryName?: string
//   tags?: string[]
//   updated?: number | string
//   isValid?: boolean
//   inlineContent?: string
//   coverImage?: string
// }

export const crowdfundSlice = createSlice({
  name: 'crowdfund',
  initialState,
  reducers: {
    addCrowdfundToBeginning: (state, action) => {
      state.crowdfunds.unshift(action.payload)
    },
    addToHashMap: (state, action) => {
      const crowdfund = action.payload
      state.hashMapCrowdfunds[crowdfund.id] = crowdfund
    },
    updateInHashMap: (state, action) => {
      const { id } = action.payload
      const crowdfund = action.payload
      state.hashMapCrowdfunds[id] = { ...crowdfund }
    },
    removeFromHashMap: (state, action) => {
      const idToDelete = action.payload
      delete state.hashMapCrowdfunds[idToDelete]
    },
    addArrayToHashMap: (state, action) => {
      const crowdfunds = action.payload
      crowdfunds.forEach((video: Crowdfund) => {
        state.hashMapCrowdfunds[video.id] = video
      })
    },
    upsertCrowdfunds: (state, action) => {
      action.payload.forEach((crowdfund: Crowdfund) => {
        const index = state.crowdfunds.findIndex((p) => p.id === crowdfund.id)
        if (index !== -1) {
          state.crowdfunds[index] = crowdfund
        } else {
          state.crowdfunds.push(crowdfund)
        }
      })
    },
  }
})

export const {
  addCrowdfundToBeginning,
  addToHashMap,
  updateInHashMap,
  removeFromHashMap,
  addArrayToHashMap,
  upsertCrowdfunds
} = crowdfundSlice.actions

export default crowdfundSlice.reducer

