// check the structure of blog posts
export const checkStructure = (content: any) => {
  let isValid = true
  if (!content?.title) isValid = false
  if (!content?.createdAt) isValid = false
  if (!Array.isArray(content?.postContent)) isValid = false
  content?.postContent?.forEach((c: any) => {
    if (!c.type) {
      isValid = false;
    }
    if (!c.version) {
      isValid = false;
    }
    if (!c.id) {
      isValid = false;
    }
    if (!c.content) {
      isValid = false;
    }
    if (
      c.version === 1 &&
      c.type !== 'editor' &&
      c.type !== 'image' &&
      c.type !== 'video' &&
      c.type !== 'audio' &&
      c.type !== 'file'
    ) {
      isValid = false
    }
  });

  return isValid
}

export const checkStructureMailMessages = (content: any) => {
  let isValid = true

  // if (!content?.title) isValid = false
  // if (!content?.description) isValid = false
  if (!content?.createdAt) isValid = false
  if (!content?.version) isValid = false
  if (!Array.isArray(content?.attachments)) isValid = false
  if (typeof content?.generalData !== 'object') isValid = false

  return isValid
}

