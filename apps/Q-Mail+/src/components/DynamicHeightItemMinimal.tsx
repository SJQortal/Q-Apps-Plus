import React, { useRef, useState, useEffect } from 'react'
import ReactResizeDetector from 'react-resize-detector'
import { Layouts, Layout } from 'react-grid-layout'

interface DynamicHeightItemProps {
  children: React.ReactNode
  layouts: Layouts
  setLayouts: (layouts: any) => void
  i: string
  breakpoint: keyof Layouts
  rows?: number
  count?: number
  type?: string
  padding?: number
}

export const DynamicHeightItemMinimal: React.FC<DynamicHeightItemProps> = ({
  children,
  layouts,
  setLayouts,
  i,
  breakpoint,
  rows = 1,
  count,
  type,
  padding
}) => {
  return (
    <div style={{ width: '100%', height: 'auto' }}>
      <div
        style={{
          padding: `${padding ? padding : 0}px`
        }}
      >
        {children}
      </div>
    </div>
  )
}
