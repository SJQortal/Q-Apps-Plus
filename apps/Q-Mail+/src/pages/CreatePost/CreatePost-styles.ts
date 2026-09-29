import { styled } from '@mui/system'

import { Button } from '@mui/material'

export const BuilderButton = styled(Button)(({ theme }) => ({
  backgroundColor: theme.palette.primary.light,
  color: theme.palette.text.primary,
  transition: "all 0.3s ease-in-out",
  "&:hover": {
    cursor: "pointer",
    filter: "brightness(0.9)"
  }
}));
