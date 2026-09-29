// DraggableResizableGrid.tsx
import React from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import GridLayout, { Layout } from 'react-grid-layout'

import './DraggableResizableGrid.css' // Add your custom CSS for the grid layout

interface GridItem {
  id: string
  content: React.ReactNode
}

interface DraggableResizableGridProps {
  items: GridItem[]
  cols?: number
  rowHeight?: number
  onLayoutChange?: (layout: Layout[]) => void
}

const DraggableResizableGrid: React.FC<DraggableResizableGridProps> = ({
  items,
  cols = 12,
  rowHeight = 30,
  onLayoutChange
}) => {
  const layout = items.map((item, index) => ({
    i: item.id,
    x: index % cols,
    y: Math.floor(index / cols),
    w: 4,
    h: 4
  }))

  return (
    <DndProvider backend={HTML5Backend}>
      <GridLayout
        className="layout"
        layout={layout}
        cols={cols}
        rowHeight={rowHeight}
        width={1200}
        onLayoutChange={onLayoutChange}
      >
        {items.map((item) => (
          <div key={item.id} className="grid-item">
            {item.content}
          </div>
        ))}
      </GridLayout>
    </DndProvider>
  )
}

export default DraggableResizableGrid
