import { checkStructure } from './checkStructure'

export const fetchAndEvaluateCatalogues = async (data: any) => {
  const getCatalogues = async () => {
    const { user, catalogueId } = data
    let obj: any = {
      isValid: false
    }

    if (!user || !catalogueId) return obj

    try {
      const catalogueHashMap = await qortalRequest( {
        action: "FETCH_QDN_RESOURCE",
        name: user,
        service: "DOCUMENT",
        identifier: catalogueId
      })

      if (catalogueHashMap) {
        obj = {
          ...catalogueHashMap,
          user,
          id: catalogueId,
          isValid: true
        }
      }
      return obj
    } catch (error) {
      console.error(error);
    }
  }

  const res = await getCatalogues()
  return res
}
