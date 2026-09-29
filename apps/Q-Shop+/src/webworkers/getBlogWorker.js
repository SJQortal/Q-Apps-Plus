import { checkStructure } from '../utils/checkStructure'

function extractTextFromSlate(nodes) {
  if (!Array.isArray(nodes)) return ''
  let text = ''

  for (const node of nodes) {
    if (node.text) {
      text += node.text
    } else if (node.children) {
      text += extractTextFromSlate(node.children)
    }
  }

  return text
}
// worker.js
self.onmessage = async (event) => {
  const getBlogPost = async () => {
    const { data } = event
    const { user, postId, content } = data
    let obj = {
      remove: true,
      id: postId
    }

    if (!user || !postId) return obj

    try {
      const url = `/arbitrary/BLOG_POST / ${user}/${postId}`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const responseData = await response.json()

      if (checkStructure(responseData)) {
        const findImage = responseData.postContent.find(
          (data) => data?.type === 'image'
        )
        const findText = responseData.postContent.find(
          (data) => data?.type === 'editor'
        )
        obj = {
          content: responseData.postContent,
          ...content,
          user,
          title: responseData.title,
          createdAt: responseData.createdAt,
          id: postId,
          postImage: findImage ? findImage?.content?.image : ''
        }

        if (findText && findText.content) {
          obj.description = extractTextFromSlate(findText?.content)
        }
      }
      return obj
    } catch (error) { }
  }

  const res = await getBlogPost()
  self.postMessage(res)
  // 
  //   const { data } = event;
  //   // Perform your computation using the data
  //   const result = data.map((x) => x * 2);

  //   // Send the result back to the main thread
  // self.postMessage(result);
}
