import { styled } from '@mui/system'
import {
  AppBar,
  Toolbar,
  Typography,
  Menu,
  MenuItem
} from '@mui/material'

export const CustomAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: "var(--qmail-shell-top-bg)",
  borderBottom: "1px solid var(--qmail-shell-border)",
  color: theme.palette.text.primary
}))

export const CustomToolbar = styled(Toolbar)({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center'
})

export const CustomTitle = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.primary,
  fontFamily: "var(--qapp-font-sans, 'Lexend', sans-serif)",
  fontSize: '1.125rem'
}))

export const StyledAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: theme.palette.primary.main
}))

export const StyledToolbar = styled(Toolbar)(({ theme }) => ({
  justifyContent: 'space-between'
}))

export const StyledMenu = styled(Menu)(({ theme }) => ({
  marginTop: theme.spacing(2),
  overflow: 'hidden',
  padding: 0,
}))

export const StyledMenuItem = styled(MenuItem)(({ theme }) => ({
  width: '100%',
  whiteSpace: 'nowrap',
  maxWidth: '300px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  fontSize: "1rem",
  fontFamily: "var(--qapp-font-sans, 'Lexend', sans-serif)",
  padding: "12px 10px",
  transition: "all 0.3s ease-in-out",
  "&:hover": {
    cursor: "pointer",
    filter: "brightness(1.1)"
  }
}))
