import React from 'react'
import { styled } from '@mui/system'
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Box,
  Button
} from '@mui/material'

import {
  CustomAppBar,
  CustomToolbar,
  CustomTitle,
  StyledAppBar,
  StyledToolbar,
  StyledMenu,
  StyledMenuItem
} from './UserNavbar-styles'

import { useNavigate } from 'react-router-dom'
import { Menu as MenuIcon } from '@mui/icons-material'
import { removePrefix } from '../../../utils/blogIdformats'
import { QblogLogoContainer } from '../../layout/Navbar/Navbar-styles'
import QblogLogo from '../../../assets/img/qBlogLogo.png'

interface Props {
  title: string
  menuItems: any[]
  name: string
  blogId: string
}

export const UserNavbar: React.FC<Props> = ({
  title,
  menuItems,
  name,
  blogId
}) => {
  const navigate = useNavigate()
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null)

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const goToPost = (item: any) => {
    if (!name) return
    const { postId } = item

    const str = postId
    const arr = str.split('-post-')
    const str1 = arr[0]
    const str2 = arr[1]
    const blogId = removePrefix(str1)
    navigate(`/${name}/${blogId}/${str2}`)
  }

  const handleAction = (action: () => void) => {
    handleClose()
    setTimeout(() => {
      action()
    }, 100)
  }

  return (
    <CustomAppBar position="sticky">
      <CustomToolbar variant="dense">
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <IconButton
            edge="start"
            color="inherit"
            aria-label="menu"
            onClick={handleClick}
          >
            <MenuIcon />
          </IconButton>
          <CustomTitle
            variant="h6"
            sx={{
              cursor: 'pointer',
              marginLeft: '10px'
            }}
            onClick={() => {
              navigate(`/${name}/${blogId}`)
            }}
          >
            {title}
          </CustomTitle>
        </Box>
        <StyledMenu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleClose}
          PaperProps={{ style: { width: '250px' } }}
        >
          {menuItems.map((item, index) => (
            <StyledMenuItem
              key={index}
              onClick={() => handleAction(() => goToPost(item))}
            >
              {item.name}
            </StyledMenuItem>
          ))}
        </StyledMenu>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <QblogLogoContainer
            src={QblogLogo}
            alt="Qblog Logo"
            onClick={() => {
              navigate(`/`)
            }}
          />
        </Box>
      </CustomToolbar>
    </CustomAppBar>
  )
}
