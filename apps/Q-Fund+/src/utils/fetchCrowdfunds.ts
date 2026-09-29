import { checkStructure } from './checkStructure'

export const fetchAndEvaluateCrowdfunds = async (data: any) => {
  const getCrowdfund = async () => {
    const { user, identifier, content } = data
    let obj: any = {
      ...content,
      isValid: false
    }

    if (!user || !identifier) return obj

    try {

      const responseData = await qortalRequest({
        action: 'FETCH_QDN_RESOURCE',
        name: user,
        service: 'DOCUMENT',
        identifier: identifier
      })
      if (checkStructure(responseData)) {
        obj = {
          ...content,
          ...responseData,
          isValid: true
        }
      }
      return obj
    } catch (error) {
      console.error(error)
     }
  }

  const res = await getCrowdfund()
  return res
}
