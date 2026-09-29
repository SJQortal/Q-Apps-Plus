import React from 'react';
import { styled } from '@mui/system';
import { SVGProps } from './interfaces';

// Create a styled container with hover effects
const HoverContainer = styled('div')({
  display: 'inline-block',
  transition: 'transform 0.3s ease, opacity 0.3s ease',
  opacity: 1, // Default opacity

  '&:hover': {
    transform: 'scale(1.5)',
    opacity: 1, // Increased opacity on hover
  },
});

export const CloseSVG:React.FC<SVGProps>  = ({ color, opacity }) => {
  return (
    <HoverContainer>
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M2 0L0 2L4 6L0 10L2 12L6 8L10 12L12 10L8 6L12 2L10 0L6 4L2 0Z"
          fill={color}
          fillOpacity={opacity}
        />
      </svg>
    </HoverContainer>
  );
};
