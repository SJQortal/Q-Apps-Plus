export function removePrefix(id: string): string {
  if (id.startsWith('q-blog-')) {
    return id.substring(7)
  } else {
    return id
  }
}

export function addPrefix(id: string): string {
  if (id.startsWith('q-blog-')) {
    return id
  } else {
    return `q-blog-${id}`
  }
}


// This function extracts the createTitleId and id portion of the identifier string
export const extractCreateTitleIdAndId = (identifier: string): string => {
    // Split the identifier string by the '-post-' delimiter
    const parts = identifier.split('-post-')
      return parts[1] || ''
  }
  
  // This function combines the createTitleId and id portion with the 'ououeouou-post-' prefix
  export const buildIdentifierFromCreateTitleIdAndId = (blogId:string, createTitleIdAndId: string): string => {
    return `${blogId}-post-${createTitleIdAndId}`
  }
  
