import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { addToHashMap } from '../state/features/storeSlice'

import { RootState } from '../state/store'
import { fetchAndEvaluateProducts } from '../utils/fetchPosts'

interface Resource {
  id: string
  updated: number
}
export const useFetchProducts = () => {
  const dispatch = useDispatch()
  const hashMapProducts = useSelector(
    (state: RootState) => state.store.hashMapProducts
  )

  const getProduct = async (user: string, productId: string, content: any) => {
    const res = await fetchAndEvaluateProducts({
      user,
      productId,
      content
    })

    dispatch(addToHashMap(res))
  }

  const checkAndUpdateResource = React.useCallback(
    (resource: Resource) => {
      // Check if the post exists in hashMapPosts
      const existingResource = hashMapProducts[resource.id]
      if (!existingResource) {
        // If the post doesn't exist, add it to hashMapPosts
        return true
      } else if (
        resource?.updated &&
        existingResource?.updated &&
        resource.updated > existingResource.updated
      ) {
        // If the post exists and its updated is more recent than the existing post's updated, update it in hashMapPosts
        return true
      } else {
        return false
      }
    },
    [hashMapProducts]
  )

  return {
    getProduct,
    hashMapProducts,
    checkAndUpdateResource
  }
}
