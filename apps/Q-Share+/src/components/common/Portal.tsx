import React, { useState } from 'react'
import { createPortal } from 'react-dom'

interface PortalProps {
  children: React.ReactNode
}

/**
 * Renders children into `#modal-root` (a sibling of the app root, see
 * main.tsx), or into <body> if that node is not there yet.
 */
const Portal: React.FC<PortalProps> = ({ children }) => {
  const [container] = useState<HTMLElement | null>(() => {
    if (typeof document === 'undefined') return null
    return (document.querySelector('#modal-root') as HTMLElement | null) ?? document.body
  })

  return container ? createPortal(children, container) : null
}

export default Portal
