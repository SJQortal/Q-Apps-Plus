import { checkStructure } from './checkStructure'
import { extractTextFromSlate } from './extractTextFromSlate'

export const fetchAndEvaluatePosts = async (data: any) => {
  const getBlogPost = async () => {
    const { user, postId, content } = data
    let obj: any = {
      ...content,
      isValid: false
    }

    if (!user || !postId) return obj

    try {
      const url = `/arbitrary/BLOG_POST/${user}/${postId}`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const responseData = await response.json()

      if (checkStructure(responseData)) {
        const findImage = responseData.postContent.find(
          (data: any) => data?.type === 'image'
        )
        const findText = responseData.postContent.find(
          (data: any) => data?.type === 'editor'
        )
        obj = {
          content: responseData.postContent,
          ...content,
          user,
          title: responseData.title,
          createdAt: responseData.createdAt,
          id: postId,
          postImage: findImage ? findImage?.content?.image : '',
          isValid: true
        }

        if (findText && findText.content && !content?.description) {
          obj.description = extractTextFromSlate(findText?.content)
        }
      }
      return obj
    } catch (error) {}
  }

  const res = await getBlogPost()
  return res
}
