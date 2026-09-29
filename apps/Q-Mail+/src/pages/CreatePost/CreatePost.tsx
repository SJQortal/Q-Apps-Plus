import { Box, Button, Typography } from '@mui/material'
import React, { useMemo, useState } from 'react'
import { ReusableModal } from '../../components/modals/ReusableModal'
import { CreatePostBuilder } from './CreatePostBuilder'
import { CreatePostMinimal } from './CreatePostMinimal'
import HandymanRoundedIcon from '@mui/icons-material/HandymanRounded'
import HourglassFullRoundedIcon from '@mui/icons-material/HourglassFullRounded'
import { display } from '@mui/system'
import { useDispatch, useSelector } from 'react-redux'
import { setIsLoadingGlobal } from '../../state/features/globalSlice'
import { useParams } from 'react-router-dom'
import { checkStructure } from '../../utils/checkStructure'
import { RootState } from '../../state/store'
import {
  addPrefix,
  buildIdentifierFromCreateTitleIdAndId
} from '../../utils/blogIdformats'
import { Tipping } from '../../components/common/Tipping/Tipping'
type EditorType = 'minimal' | 'builder'
interface CreatePostProps {
  mode?: string
}
export const CreatePost = ({ mode }: CreatePostProps) => {
  const { user: username, postId, blog } = useParams()
  const fullPostId = useMemo(() => {
    if (!blog || !postId || mode !== 'edit') return ''
    const formBlogId = addPrefix(blog)
    const formPostId = buildIdentifierFromCreateTitleIdAndId(formBlogId, postId)
    return formPostId
  }, [blog, postId, mode])
  const { user } = useSelector((state: RootState) => state.auth)

  const [toggleEditorType, setToggleEditorType] = useState<EditorType | null>(
    null
  )
  const [blogContentForEdit, setBlogContentForEdit] = useState<any>(null)
  const [blogMetadataForEdit, setBlogMetadataForEdit] = useState<any>(null)
  const [editType, setEditType] = useState<EditorType | null>(null)
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const dispatch = useDispatch()
  React.useEffect(() => {
    if (!toggleEditorType && mode !== 'edit') {
      setIsOpen(true)
    }
  }, [setIsOpen, toggleEditorType])

  const switchType = () => {
    setIsOpen(true)
  }

  const getBlogPost = React.useCallback(async () => {
    try {
      dispatch(setIsLoadingGlobal(true))
      const url = `/arbitrary/BLOG_POST/${username}/${fullPostId}`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const responseData = await response.json()
      if (checkStructure(responseData)) {
        // setNewPostContent(responseData.postContent)
        // setTitle(responseData?.title || '')
        // setBlogInfo(responseData)
        const blogType = responseData?.layoutGeneralSettings?.blogPostType

        if (blogType) {
          setEditType(blogType)
          setBlogContentForEdit(responseData)
        }
        //TODO - NAME SHOULD BE EXACT
        // const url2 = `/arbitrary/resources/search?mode=ALL&service=BLOG_POST&identifier=${fullPostId}&exactMatchNames=${username}&limit=1&includemetadata=true`
        const url2 = `/arbitrary/resources?service=BLOG_POST&identifier=${fullPostId}&name=${username}&limit=1&includemetadata=true`

        const responseBlogs = await fetch(url2, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })

        const dataMetadata = await responseBlogs.json()
        if (dataMetadata && dataMetadata.length > 0) {
          setBlogMetadataForEdit(dataMetadata[0])
        }
      }
    } catch (error) {
    } finally {
      dispatch(setIsLoadingGlobal(false))
    }
  }, [username, fullPostId])
  React.useEffect(() => {
    if (mode === 'edit') {
      getBlogPost()
    }
  }, [mode])

  return (
    <>
      {/* {toggleEditorType === 'minimal' && (
        <Button onClick={() => switchType()}>Switch to Builder</Button>
      )}
      {toggleEditorType === 'builder' && (
        <Button onClick={() => switchType()}>Switch to Minimal</Button>
      )} */}
      {isOpen && (
        <ReusableModal
          open={isOpen}
          customStyles={{
            maxWidth: '500px'
          }}
        >
          {toggleEditorType && (
            <Typography>
              Switching editor type will delete your current progress
            </Typography>
          )}

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 2
            }}
          >
            <Box
              onClick={() => {
                setToggleEditorType('minimal')
                setIsOpen(false)
              }}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '20px',
                borderRadius: '6px',
                border: '1px solid',
                cursor: 'pointer'
              }}
            >
              <Typography>Minimal Editor</Typography>
              <HourglassFullRoundedIcon />
            </Box>
            <Box
              onClick={() => {
                setToggleEditorType('builder')
                setIsOpen(false)
              }}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '20px',
                borderRadius: '6px',
                border: '1px solid',
                cursor: 'pointer'
              }}
            >
              <Typography>Builder Editor</Typography>
              <HandymanRoundedIcon />
            </Box>
          </Box>
          <Button onClick={() => setIsOpen(false)}>Close</Button>
        </ReusableModal>
      )}

      {toggleEditorType === 'minimal' && (
        <CreatePostMinimal switchType={switchType} />
      )}
      {toggleEditorType === 'builder' && (
        <CreatePostBuilder switchType={switchType} />
      )}
      {mode === 'edit' && editType === 'minimal' && (
        <CreatePostMinimal
          blogContentForEdit={blogContentForEdit}
          postIdForEdit={fullPostId}
          blogMetadataForEdit={blogMetadataForEdit}
        />
      )}
      {mode === 'edit' && editType === 'builder' && (
        <CreatePostBuilder
          blogContentForEdit={blogContentForEdit}
          postIdForEdit={fullPostId}
          blogMetadataForEdit={blogMetadataForEdit}
        />
      )}
    </>
  )
}
