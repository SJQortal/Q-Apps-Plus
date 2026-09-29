import React from 'react'
import { useParams } from 'react-router-dom'
import BlogEditor from '../../components/editor/BlogEditor'
import ShortUniqueId from 'short-unique-id'
import { Button, TextField } from '@mui/material'
import ReadOnlySlate from '../../components/editor/ReadOnlySlate'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '../../state/store'
import { Box } from '@mui/material'
import ImageUploader from '../../components/common/ImageUploader'
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate'
import { checkStructure } from '../../utils/checkStructure'
import { BlogContent } from '../../interfaces/interfaces'
import PostAddIcon from '@mui/icons-material/PostAdd'
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle'
import EditIcon from '@mui/icons-material/Edit'
import { createEditor, Descendant, Editor, Transforms } from 'slate'
import { styled } from '@mui/system'
import { setIsLoadingGlobal } from '../../state/features/globalSlice'
import { extractTextFromSlate } from '../../utils/extractTextFromSlate'
import { VideoContent } from '../../components/common/VideoContent'
import { VideoPanel } from '../../components/common/VideoPanel'

const initialValue: Descendant[] = [
  {
    type: 'paragraph',
    children: [
      { text: "Start writing your blog post... Don't forget to add a title :)" }
    ]
  }
]

const BlogTitleInput = styled(TextField)(({ theme }) => ({
  '& .MuiInputBase-input': {
    fontSize: '28px',
    height: '28px',
    '&::placeholder': {
      fontSize: '28px',
      color: theme.palette.text.secondary
    }
  },
  '& .MuiInputLabel-root': {
    fontSize: '28px'
  }
}))

interface IaddVideo {
  name: string
  identifier: string
  service: string
  title: string
  description: string
}

const uid = new ShortUniqueId()
export const EditPost = () => {
  const { user: username, postId } = useParams()

  const { user } = useSelector((state: RootState) => state.auth)

  const [newPostContent, setNewPostContent] = React.useState<any[]>([])
  const [blogInfo, setBlogInfo] = React.useState<BlogContent | null>(null)
  const [editingSection, setEditingSection] = React.useState<any>(null)
  const [value, setValue] = React.useState(initialValue)
  const [value2, setValue2] = React.useState(initialValue)
  const [title, setTitle] = React.useState('')
  const dispatch = useDispatch()
  const addPostSection = React.useCallback((content: any) => {
    const section = {
      type: 'editor',
      version: 1,
      content,
      id: uid()
    }

    setNewPostContent((prev) => [...prev, section])
  }, [])
  const editPostSection = React.useCallback(
    (content: any, section: any) => {
      const findSectionIndex = newPostContent.findIndex(
        (s) => s.id === section.id
      )

      if (findSectionIndex !== -1) {
        const copyNewPostContent = [...newPostContent]
        copyNewPostContent[findSectionIndex] = {
          ...section,
          content
        }

        setNewPostContent(copyNewPostContent)
      }

      setEditingSection(null)
    },
    [newPostContent]
  )

  function objectToBase64(obj: any) {
    // Step 1: Convert the object to a JSON string
    const jsonString = JSON.stringify(obj)

    // Step 2: Create a Blob from the JSON string
    const blob = new Blob([jsonString], { type: 'application/json' })

    // Step 3: Create a FileReader to read the Blob as a base64-encoded string
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          // Remove 'data:application/json;base64,' prefix
          const base64 = reader.result.replace(
            'data:application/json;base64,',
            ''
          )
          resolve(base64)
        } else {
          reject(
            new Error('Failed to read the Blob as a base64-encoded string')
          )
        }
      }
      reader.onerror = () => {
        reject(reader.error)
      }
      reader.readAsDataURL(blob)
    })
  }

  const addImage = (base64: string) => {
    const section = {
      type: 'image',
      version: 1,
      content: {
        image: base64,
        caption: ''
      },
      id: uid()
    }

    setNewPostContent((prev) => [...prev, section])
  }

  async function getNameInfo(address: string) {
    const response = await fetch('/names/address/' + address)
    const nameData = await response.json()

    if (nameData?.length > 0) {
      return nameData[0].name
    } else {
      return ''
    }
  }

  async function publishQDNResource() {
    let address
    let name

    try {
      if (!user || !user.address) return
      address = user.address
    } catch (error) {}
    if (!address) return
    try {
      name = await getNameInfo(address)
    } catch (error) {}
    if (!name) return
    if (!blogInfo) return
    try {
      const postObject = {
        ...blogInfo,
        title,
        postContent: newPostContent
      }
      const blogPostToBase64 = await objectToBase64(postObject)
      let description = ''
      const findText = newPostContent.find((data) => data?.type === 'editor')
      if (findText && findText.content) {
        description = extractTextFromSlate(findText?.content)
        description = description.slice(0, 180)
      }
      const resourceResponse = await qortalRequest({
        action: 'PUBLISH_QDN_RESOURCE',
        name: name,
        service: 'BLOG_POST',
        data64: blogPostToBase64,
        title: title,
        description: description,
        category: 'TECHNOLOGY',
        tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'],
        metaData: 'description=destriptontest&category=catTest',
        identifier: postId
      })
    } catch (error) {
      console.error(error)
    }
  }

  const addSection = () => {
    addPostSection(value2)
  }

  const getBlogPost = React.useCallback(async () => {
    try {
      dispatch(setIsLoadingGlobal(true))
      const url = `/arbitrary/BLOG_POST/${username}/${postId}`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const responseData = await response.json()
      if (checkStructure(responseData)) {
        setNewPostContent(responseData.postContent)
        setTitle(responseData?.title || '')
        setBlogInfo(responseData)
      }
    } catch (error) {
    } finally {
      dispatch(setIsLoadingGlobal(false))
    }
  }, [user, postId])
  React.useEffect(() => {
    getBlogPost()
  }, [])

  const editSection = (section: any) => {
    setEditingSection(section)
    setValue(section.content)
  }

  const removeSection = (section: any) => {
    const newContent = newPostContent.filter((s) => s.id !== section.id)
    setNewPostContent(newContent)
  }
  const editImage = (base64: string, section: any) => {
    const newSection = {
      ...section,
      content: {
        image: base64,
        caption: section.content.caption
      }
    }
    const findSectionIndex = newPostContent.findIndex(
      (s) => s.id === section.id
    )
    if (findSectionIndex !== -1) {
      const copyNewPostContent = [...newPostContent]
      copyNewPostContent[findSectionIndex] = newSection

      setNewPostContent(copyNewPostContent)
    }
  }

  const editVideo = (
    { name, identifier, service, description, title }: IaddVideo,
    section: any
  ) => {
    const newSection = {
      ...section,
      content: {
        name: name,
        identifier: identifier,
        service: service,
        description,
        title
      }
    }
    const findSectionIndex = newPostContent.findIndex(
      (s) => s.id === section.id
    )
    if (findSectionIndex !== -1) {
      const copyNewPostContent = [...newPostContent]
      copyNewPostContent[findSectionIndex] = newSection

      setNewPostContent(copyNewPostContent)
    }
  }
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        flexDirection: 'column'
      }}
    >
      <Box
        sx={{
          maxWidth: '700px',
          margin: '15px',
          width: '100%'
        }}
      >
        <BlogTitleInput
          id="modal-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          fullWidth
          placeholder="Title"
          variant="filled"
          multiline
          maxRows={2}
          InputLabelProps={{ shrink: false }}
        />
        {newPostContent.map((section: any) => {
          if (section.type === 'editor') {
            return (
              <Box key={section.id}>
                {editingSection && editingSection.id === section.id ? (
                  <BlogEditor
                    editPostSection={editPostSection}
                    defaultValue={section.content}
                    section={section}
                    value={value}
                    setValue={setValue}
                  />
                ) : (
                  <Box
                    sx={{
                      position: 'relative'
                    }}
                  >
                    <ReadOnlySlate key={section.id} content={section.content} />
                    <Box
                      sx={{
                        position: 'absolute',
                        right: '5px',
                        zIndex: 5,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        display: 'flex',
                        // flexDirection: 'column',
                        gap: 2,
                        background: 'white',
                        padding: '5px',
                        borderRadius: '5px'
                      }}
                    >
                      <RemoveCircleIcon
                        onClick={() => removeSection(section)}
                        sx={{
                          cursor: 'pointer'
                        }}
                      />
                      <EditIcon
                        onClick={() => editSection(section)}
                        sx={{
                          cursor: 'pointer'
                        }}
                      />
                    </Box>
                  </Box>
                )}
                {editingSection && editingSection.id === section.id ? (
                  <Box
                    sx={{
                      display: 'flex',
                      width: '100%',
                      justifyContent: 'flex-end'
                    }}
                  >
                    <Button onClick={() => setEditingSection(null)}>
                      Close
                    </Button>
                  </Box>
                ) : (
                  <></>
                )}
              </Box>
            )
          }
          if (section.type === 'image') {
            return (
              <Box key={section.id}>
                {editingSection && editingSection.id === section.id ? (
                  <ImageUploader
                    onPick={(base64) => editImage(base64, section)}
                  >
                    Add Image
                    <AddPhotoAlternateIcon />
                  </ImageUploader>
                ) : (
                  <Box
                    sx={{
                      position: 'relative'
                    }}
                  >
                    <img
                      src={section.content.image}
                      className="post-image"
                      style={{
                        marginTop: '20px'
                      }}
                    />
                    <Box
                      sx={{
                        position: 'absolute',
                        right: '5px',
                        zIndex: 5,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        background: 'white',
                        padding: '5px',
                        borderRadius: '5px'
                      }}
                    >
                      <RemoveCircleIcon
                        onClick={() => removeSection(section)}
                        sx={{
                          cursor: 'pointer'
                        }}
                      />
                      <ImageUploader
                        onPick={(base64) => editImage(base64, section)}
                      >
                        <EditIcon
                          sx={{
                            cursor: 'pointer'
                          }}
                        />
                      </ImageUploader>
                    </Box>
                  </Box>
                )}
                {editingSection && editingSection.id === section.id ? (
                  <Button onClick={() => setEditingSection(null)}>Close</Button>
                ) : (
                  <></>
                )}
              </Box>
            )
          }
          if (section.type === 'video') {
            return (
              <Box key={section.id}>
                {editingSection && editingSection.id === section.id ? (
                  <VideoPanel
                    width="24px"
                    height="24px"
                    onSelect={(video) =>
                      editVideo(
                        {
                          name: video.name,
                          identifier: video.identifier,
                          service: video.service,
                          title: video?.metadata?.title,
                          description: video?.metadata?.description
                        },
                        section
                      )
                    }
                  />
                ) : (
                  <Box
                    sx={{
                      position: 'relative'
                    }}
                  >
                    <VideoContent
                      title={section.content?.title}
                      description={section.content?.description}
                    />
                    <Box
                      sx={{
                        position: 'absolute',
                        right: '5px',
                        zIndex: 5,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        background: 'white',
                        padding: '5px',
                        borderRadius: '5px'
                      }}
                    >
                      <RemoveCircleIcon
                        onClick={() => removeSection(section)}
                        sx={{
                          cursor: 'pointer'
                        }}
                      />
                      <VideoPanel
                        width="24px"
                        height="24px"
                        onSelect={(video) =>
                          editVideo(
                            {
                              name: video.name,
                              identifier: video.identifier,
                              service: video.service,
                              title: video?.metadata?.title,
                              description: video?.metadata?.description
                            },
                            section
                          )
                        }
                      />
                    </Box>
                  </Box>
                )}
                {editingSection && editingSection.id === section.id ? (
                  <Button onClick={() => setEditingSection(null)}>Close</Button>
                ) : (
                  <></>
                )}
              </Box>
            )
          }
        })}

        <BlogEditor
          addPostSection={addPostSection}
          value={value2}
          setValue={setValue2}
        />
        <Box
          sx={{
            display: 'flex'
          }}
        >
          <PostAddIcon
            onClick={addSection}
            sx={{
              cursor: 'pointer',
              width: '50px',
              height: '50px'
            }}
          />
          <ImageUploader onPick={addImage}>
            <AddPhotoAlternateIcon
              sx={{
                cursor: 'pointer',
                width: '50px',
                height: '50px'
              }}
            />
          </ImageUploader>
        </Box>
      </Box>
      <Box
        sx={{
          position: 'fixed',
          bottom: '30px',
          right: '30px',
          zIndex: 15,
          background: 'deepskyblue',
          padding: '10px',
          borderRadius: '5px'
        }}
      >
        <Button onClick={publishQDNResource}>PUBLISH UPDATE</Button>
      </Box>
    </Box>
  )
}
