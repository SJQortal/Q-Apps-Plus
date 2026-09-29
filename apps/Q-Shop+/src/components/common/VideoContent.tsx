import React from 'react'
import { Box, Typography } from '@mui/material'
import { styled } from '@mui/system'
import { Description, Movie } from '@mui/icons-material'

interface VideoProps {
  title: string
  description: string
}

const StyledBox = styled(Box)`
  margin: 20px 0px;
  display: flex;
  align-items: center;
`

const Title = styled(Typography)``

const DescriptionIcon = styled(Description)`
  color: #666;
  margin-right: 0.5rem;
`

const MovieIcon = styled(Movie)`
  color: #666;
  margin-right: 0.5rem;
`

export const VideoContent: React.FC<VideoProps> = ({ title, description }) => {
  return (
    <StyledBox>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start'
        }}
      >
        <Box display="flex" alignItems="center">
          <MovieIcon />
          <Title variant="h4">{title}</Title>
        </Box>

        <Box display="flex" alignItems="center">
          <DescriptionIcon />
          <Typography variant="body1">{description}</Typography>
        </Box>
      </Box>
    </StyledBox>
  )
}
