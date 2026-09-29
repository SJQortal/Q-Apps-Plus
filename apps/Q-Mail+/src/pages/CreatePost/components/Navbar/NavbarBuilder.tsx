import React, { useCallback, useEffect } from 'react'

import {
  Button,
  Box,
  Typography,
  Toolbar,
  AppBar,
  Select,
  InputLabel,
  FormControl,
  MenuItem,
  TextField,
  SelectChangeEvent,
  OutlinedInput,
  List,
  ListItem,
  useTheme
} from '@mui/material'
import { styled } from '@mui/system'
import { useSelector } from 'react-redux'
import { RootState } from '../../../../state/store'
import ShortUniqueId from 'short-unique-id'
import DeleteIcon from '@mui/icons-material/Delete'
import { CustomIcon } from '../../../../components/common/CustomIcon'

const uid = new ShortUniqueId()
interface INavbar {
  saveNav: (navMenu: any, navbarConfig: any) => void
  removeNav: () => void
  close: () => void
}

export const Navbar = ({ saveNav, removeNav, close }: INavbar) => {
  const { user } = useSelector((state: RootState) => state.auth)
  const { currentBlog } = useSelector((state: RootState) => state.global)
  const theme = useTheme()
  const [navTitle, setNavTitle] = React.useState<string>('')
  const [blogPostOption, setBlogPostOption] = React.useState<any | null>(null)
  const [options, setOptions] = React.useState<any>([])
  const [navItems, setNavItems] = React.useState<any>([])
  const handleOptionChange = (event: SelectChangeEvent<string>) => {
    const optionId = event.target.value
    const selectedOption = options.find((option: any) => option.id === optionId)
    setBlogPostOption(selectedOption || null)
  }

  useEffect(() => {
    if (currentBlog && currentBlog?.navbarConfig) {
      const { navItems } = currentBlog.navbarConfig
      if (!navItems || !Array.isArray(navItems)) return

      setNavItems(navItems)
    }
  }, [currentBlog])

  const getOptions = useCallback(async () => {
    if (!user || !currentBlog) return
    const name = user?.name
    const blog = currentBlog?.blogId

    try {
      //TODO - NAME SHOULD BE EXACT
      const url = `/arbitrary/resources/search?mode=ALL&service=BLOG_POST&query=${blog}-post-&exactmatchnames=true&name=${name}&includemetadata=true&reverse=true&limit=0`
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const responseData = await response.json()
      const formatOptions = responseData.map((option: any) => {
        return {
          id: option.identifier,
          name: option?.metadata.title
        }
      })

      setOptions(formatOptions)
    } catch (error) {}
  }, [])
  useEffect(() => {
    getOptions()
  }, [getOptions])
  const addToNav = () => {
    if (!navTitle || !blogPostOption) return
    setNavItems((prev: any) => [
      ...prev,
      {
        id: uid(),
        name: navTitle,
        postId: blogPostOption.id,
        postName: blogPostOption.name
      }
    ])
  }

  const handleSaveNav = () => {
    if (!currentBlog) return
    saveNav(navItems, currentBlog?.navbarConfig || {})
  }

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap'
          }}
        >
          <Box>
            <TextField
              label="Nav Item name"
              variant="outlined"
              fullWidth
              value={navTitle}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNavTitle(e.target.value)
              }
              inputProps={{ maxLength: 40 }}
              sx={{
                marginBottom: 2,
                backgroundColor: theme.palette.primary.light,
                color: theme.palette.text.primary,
                border: `1px solid ${theme.palette.text.primary}`
              }}
            />
          </Box>
          <Box>
            <FormControl
              fullWidth
              sx={{
                marginBottom: 2,
                width: '150px',
                backgroundColor: theme.palette.primary.light,
                color: theme.palette.text.primary,
                border: `1px solid ${theme.palette.text.primary}`
              }}
            >
              <InputLabel sx={{ color: theme.palette.text.primary }} id="Post">
                Select a Post
              </InputLabel>
              <Select
                labelId="Post"
                input={<OutlinedInput label="Select a Post" />}
                value={blogPostOption?.id || ''}
                onChange={handleOptionChange}
                MenuProps={{
                  sx: {
                    maxHeight: '300px' // Adjust this value to set the max height,
                  }
                }}
              >
                {options.map((option: any) => (
                  <MenuItem
                    sx={{ color: theme.palette.text.primary }}
                    key={option.id}
                    value={option.id}
                  >
                    {option.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Box>
        <Box>
          <Button
            sx={{
              backgroundColor: theme.palette.primary.light,
              color: theme.palette.text.primary,
              border: `1px solid ${theme.palette.text.primary}`
            }}
            onClick={addToNav}
          >
            Add
          </Button>
        </Box>
      </Box>

      <Box>
        <List
          sx={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            flex: '1',
            overflow: 'auto'
          }}
        >
          {navItems.map((navItem: any) => (
            <ListItem
              key={navItem.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <Typography
                sx={{
                  fontWeight: 'bold'
                }}
              >
                {navItem.name}
              </Typography>{' '}
              <Typography>{navItem.postName}</Typography>{' '}
              <CustomIcon
                component={DeleteIcon}
                onClick={() =>
                  setNavItems((prev: any) =>
                    prev.filter((item: any) => item.id !== navItem.id)
                  )
                }
              />
            </ListItem>
          ))}
        </List>
      </Box>
      <Button
        sx={{
          backgroundColor: theme.palette.primary.dark,
          color: theme.palette.text.primary,
          fontFamily: 'Arial'
        }}
        onClick={handleSaveNav}
      >
        Save Navbar
      </Button>
      <Button
        sx={{
          backgroundColor: theme.palette.primary.dark,
          color: theme.palette.text.primary,
          fontFamily: 'Arial'
        }}
        onClick={removeNav}
      >
        Remove Navbar
      </Button>
      <Button
        sx={{
          backgroundColor: theme.palette.primary.dark,
          color: theme.palette.text.primary,
          fontFamily: 'Arial'
        }}
        onClick={close}
      >
        Close
      </Button>
    </>
  )
}
