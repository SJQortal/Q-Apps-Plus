import { AppBar, Button, Typography, Box } from '@mui/material';
import { styled } from '@mui/system';
import { LightModeSVG } from '../../../assets/svgs/LightModeSVG';
import { DarkModeSVG } from '../../../assets/svgs/DarkModeSVG';

export const CustomAppBar = styled(AppBar)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  width: '100%',
  padding: '40px 25px',
  backgroundImage: 'none',
  boxShadow: 'none',
  [theme.breakpoints.only('xs')]: {
    gap: '15px',
  },
  height: '55px',
}));

export const LogoContainer = styled('img')({
  width: '12%',
  minWidth: '52px',
  height: 'auto',
  padding: '2px 0',
  userSelect: 'none',
  objectFit: 'contain',
  cursor: 'pointer',
});

export const CustomTitle = styled(Typography)({
  fontWeight: 600,
  color: '#000000',
});

export const AuthenticateButton = styled(Button)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
  padding: '8px 15px',
  borderRadius: '40px',
  gap: '4px',
  backgroundColor: theme.palette.secondary.main,
  color: '#fff',
  fontFamily: 'Raleway',
  transition: 'all 0.3s ease-in-out',
  boxShadow: 'none',
  '&:hover': {
    cursor: 'pointer',
    boxShadow: 'rgba(0, 0, 0, 0.15) 1.95px 1.95px 2.6px;',
    backgroundColor: theme.palette.secondary.dark,
    filter: 'brightness(1.1)',
  },
}));

export const AvatarContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
});

export const DropdownContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
  backgroundColor: theme.palette.background.paper,
  padding: '10px 15px',
  transition: 'all 0.4s ease-in-out',
  '&:hover': {
    cursor: 'pointer',
    filter:
      theme.palette.mode === 'light' ? 'brightness(0.95)' : 'brightness(1.1)',
  },
}));

export const DropdownText = styled(Typography)(({ theme }) => ({
  fontFamily: 'Raleway',
  fontSize: '16px',
  color: theme.palette.text.primary,
  userSelect: 'none',
}));

export const NavbarName = styled(Typography)(({ theme }) => ({
  fontFamily: 'Raleway',
  fontSize: '18px',
  userSelect: 'none',
}));

export const ThemeSelectRow = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  flexBasis: 0,
  height: '100%',
});

export const LightModeIcon = styled(LightModeSVG)(({ theme }) => ({
  transition: 'all 0.1s ease-in-out',
  '&:hover': {
    cursor: 'pointer',
    filter:
      theme.palette.mode === 'dark'
        ? 'drop-shadow(0px 4px 6px rgba(255, 255, 255, 0.6))'
        : 'drop-shadow(0px 4px 6px rgba(99, 88, 88, 0.1))',
  },
}));

export const DarkModeIcon = styled(DarkModeSVG)(({ theme }) => ({
  transition: 'all 0.1s ease-in-out',
  '&:hover': {
    cursor: 'pointer',
    filter:
      theme.palette.mode === 'dark'
        ? 'drop-shadow(0px 4px 6px rgba(255, 255, 255, 0.6))'
        : 'drop-shadow(0px 4px 6px rgba(99, 88, 88, 0.1))',
  },
}));
