import { styled } from "@mui/system";
import { Card, Box, Typography } from "@mui/material";

export const StyledCard = styled(Card)(({ theme }) => ({ 
  backgroundColor: theme.palette.mode === "light" ? theme.palette.primary.main : theme.palette.primary.dark,
  maxWidth: "600px",
  width: "100%",
  margin: "10px 0px",
  cursor: "pointer",
  "@media (max-width: 450px)": {
    width: "100%;"
  }
}));

export const CardContentContainer = styled(Box)(({ theme }) => ({ 
  backgroundColor: theme.palette.mode === "light" ? theme.palette.primary.dark : theme.palette.primary.light,
  margin: "5px 10px",
  borderRadius: "15px",
}));
export const CardContentContainerComment = styled(Box)(({ theme }) => ({
  backgroundColor:
    theme.palette.mode === 'light'
      ? theme.palette.primary.dark
      : theme.palette.primary.light,
  margin: '0px',
  borderRadius: '15px',
  width: '100%',

  display: 'flex',
  flexDirection: 'column'
}))

export const StyledCardHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: '5px',
  padding: '7px'
})
export const StyledCardHeaderComment = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: '5px',
  padding: '7px'
})
export const StyledCardCol = styled(Box)({
  display: 'flex',
  overflow: 'hidden',
  flexDirection: 'column',
  gap: '2px',
  alignItems: 'flex-start',
  width: '100%'
})
export const StyledCardColComment = styled(Box)({
  display: 'flex',
  overflow: 'hidden',
  flexDirection: 'column',
  gap: '2px',
  alignItems: 'flex-start',
  width: '100%'
})
export const StyledCardContent = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-start',
  padding: '5px 10px',
  gap: '10px'
})
export const StyledCardContentComment = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  justifyContent: 'flex-start',
  padding: '5px 10px',
  gap: '10px'
})
export const TitleText = styled(Typography)({
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  width: '100%',
  fontFamily: "var(--qapp-font-sans, 'Lexend', sans-serif)",
  fontSize: '1.375rem',
  lineHeight: '1.2'
})

export const AuthorText = styled(Typography)({
  fontFamily: "var(--qapp-font-sans, 'Lexend', sans-serif)",
  fontSize: '1rem',
  lineHeight: '1.2'
})
export const AuthorTextComment = styled(Typography)({
  fontFamily: "var(--qapp-font-sans, 'Lexend', sans-serif)",
  fontSize: '1rem',
  lineHeight: '1.2'
})
export const IconsBox = styled(Box)({
  display: 'flex',
  gap: "3px",
  position: 'absolute',
  top: '12px',
  right: '5px',
  transition: 'all 0.3s ease-in-out',
});

export const BookmarkIconContainer = styled(Box)({
  display: 'flex',
  boxShadow: "rgba(99, 99, 99, 0.2) 0px 2px 8px 0px;",
  backgroundColor: '#fbfbfb',
  color: "#50e3c2",
  padding: '5px',
  borderRadius: '3px',
  transition: 'all 0.3s ease-in-out',
  "&:hover": {
    cursor: 'pointer',
    transform: "scale(1.1)",
  }
})

export const BlockIconContainer = styled(Box)({
  display: 'flex',
  boxShadow: "rgba(99, 99, 99, 0.2) 0px 2px 8px 0px;",
  backgroundColor: '#fbfbfb',
  color: "#c25252",
  padding: '5px',
  borderRadius: '3px',
  transition: 'all 0.3s ease-in-out',
  "&:hover": {
    cursor: 'pointer',
    transform: "scale(1.1)",
  }
})
