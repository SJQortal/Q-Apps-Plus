import React, { useState, useEffect, useRef } from 'react'
import { useInView } from 'react-intersection-observer'
import CircularProgress from '@mui/material/CircularProgress'

interface Props {
  onLoadMore: () => Promise<unknown> | void
  isLoading?: boolean
}

/**
 * A sentinel at the end of a list: when it scrolls into view it asks for the
 * next page. It never overlaps two requests, and a request that rejects does
 * not leave it stuck.
 */
const LazyLoad: React.FC<Props> = ({ onLoadMore, isLoading }) => {
  const [isFetching, setIsFetching] = useState<boolean>(false)
  const pending = useRef(false)
  const latest = useRef(onLoadMore)
  const mounted = useRef(true)

  const [ref, inView] = useInView({
    threshold: 0.7
  })

  // Always call the newest onLoadMore, without re-running the inView effect on every render.
  useEffect(() => {
    latest.current = onLoadMore
  })

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (!inView || pending.current) return
    pending.current = true
    setIsFetching(true)
    Promise.resolve()
      .then(() => latest.current())
      .catch(() => {
        // The list shows its own error state; the sentinel only needs to unlock.
      })
      .finally(() => {
        pending.current = false
        if (mounted.current) setIsFetching(false)
      })
  }, [inView])

  return (
    <div
      ref={ref}
      aria-hidden
      style={{
        display: 'flex',
        justifyContent: 'center',
        minHeight: '25px'
      }}
    >
      <div
        style={{
          visibility: (isFetching || isLoading) ? 'visible' : 'hidden'
        }}
      >
        <CircularProgress size={28} />
      </div>
    </div>
  )
}

export default LazyLoad
