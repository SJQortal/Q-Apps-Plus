import { checkStructure, checkStructureStore } from './checkStructure'

export const fetchAndEvaluateStores = async (data: any) => {
  const getStoreStores = async () => {
    const { owner, storeId, content } = data
    let obj: any = {
      ...content,
      isValid: false
    }

    if (!owner || !storeId) return obj
  // Fetch rawdata from QDN based on resource's location (need name, service type and identifier)
    try {
      const url = `/arbitrary/STORE/${owner}/${storeId}`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const responseData = await response.json()
      if (checkStructureStore(responseData)) {
        obj = {
          ...content,
          ...responseData,
          owner,
          id: storeId,
          isValid: true
        }
      }
      return obj
    } catch (error) {
      console.error(error);
     }
  }

  const res = await getStoreStores()
  return res
}
