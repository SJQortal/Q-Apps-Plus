import React, { useRef, useState } from 'react'
import * as FlexLayoutReact from 'flexlayout-react'
import './FlexLayout.css'
import 'flexlayout-react/style/dark.css' // or dark.css for a dark theme
import { Box } from '@mui/material'
import { Thread } from './Thread'
import { Chat } from './Chat'
let json: any = {
  global: { tabEnableClose: false },
  layout: {
    type: 'row',
    weight: 100,
    children: [
      {
        type: 'tabset',
        weight: 50,
        selected: 0,
        children: [
          {
            type: 'tab',
            name: 'Thread',
            component: 'thread'
          }
        ]
      },
      {
        type: 'tabset',
        weight: 50,
        selected: 0,
        children: [
          {
            type: 'tab',
            name: 'Chat',
            component: 'chat'
          }
        ]
      }
    ]
  }
}

export const FlexLayout = ({ currentThread, groupInfo, closeThread }: any) => {
  const [model, setModel] = useState(FlexLayoutReact.Model.fromJson(json))
  const layoutRef = useRef<any>()
  const factory = (node: any) => {
    var component = node.getComponent()
    if (component === 'thread') {
      return (
        <Thread
          currentThread={currentThread}
          groupInfo={groupInfo}
          closeThread={closeThread}
        />
      )
    } else if (component === 'chat') {
      return (
        <Chat
          currentThread={currentThread}
          groupInfo={groupInfo}
          closeThread={closeThread}
        />
      )
    }
  }

  return (
    <div className="container">
      <FlexLayoutReact.Layout ref={layoutRef} model={model} factory={factory} />
    </div>
  )
}
