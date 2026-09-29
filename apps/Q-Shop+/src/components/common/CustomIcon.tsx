import React from 'react'
import SvgIcon, { SvgIconProps } from '@mui/material/SvgIcon'
import { styled } from '@mui/system'

const CustomSvgIcon: React.FC<any> = styled(SvgIcon)(({ theme }) => ({
  cursor: 'pointer',
  color: '#5f6368',
  transition: 'all 0.2s',
  '&:hover': {
    transform: 'scale(1.1)'
  }
})) as unknown as React.FC<any>

export const CustomIcon: React.FC<any> = (props) => {
  return <CustomSvgIcon {...props} />
}
