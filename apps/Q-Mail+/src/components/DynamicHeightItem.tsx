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

const DynamicHeightItem: React.FC<DynamicHeightItemProps> = ({
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
  const [height, setHeight] = useState<number>(rows * 150)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) {
      setHeight(ref.current.clientHeight)
    }
  }, [ref.current])

  const onResize = () => {
    if (ref.current) {
      setHeight(ref.current.clientHeight)
    }
  }

  const getBreakpoint = (screenWidth: number) => {
    if (screenWidth >= 996) {
      return 'md'
    } else if (screenWidth >= 768) {
      return 'sm'
    } else {
      return 'xs'
    }
  }

  useEffect(() => {
    const widthWin = window.innerWidth
    let newBreakpoint = breakpoint
    // if (!newBreakpoint) {
    //   newBreakpoint = getBreakpoint(widthWin)
    // }

    setLayouts((prev: any) => {
      const newLayouts: any = { ...prev }
      newLayouts[newBreakpoint] = newLayouts[newBreakpoint]?.map(
        (item: Layout) => {
          if (item.i === i) {
            let constantNum = 25

            return {
              ...item,
              h: Math.ceil(height / (rows * constantNum)) // Adjust this value based on your rowHeight and the number of rows the element spans
            }
          }
          return item
        }
      )
      return newLayouts
    })
  }, [height, breakpoint, count, setLayouts])

  

  return (
    <div ref={ref} style={{ width: '100%', height: 'auto' }}>
      <ReactResizeDetector handleHeight onResize={onResize}>
        <div
          style={{
            padding: `${padding ? padding : 0}px`
          }}
        >
          {children}
        </div>
      </ReactResizeDetector>
    </div>
  )
}

export default DynamicHeightItem
