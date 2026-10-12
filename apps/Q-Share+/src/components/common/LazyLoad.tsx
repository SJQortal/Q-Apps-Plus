import React, { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useInView } from 'react-intersection-observer'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'

interface Props {
  onLoadMore: () => Promise<unknown> | void
  isLoading?: boolean
  /**
   * Pass it to keep loading while the end of the list stays in view, e.g.
   * when hidden names drop most of a page on the client: up to
   * MAX_AUTO_PAGES per scroll, then a Load more button. Without it the
   * sentinel loads once each time it scrolls into view. The budget lasts as
   * long as this instance: give it a new `key` for each new list.
   */
  hasMore?: boolean
}

export const MAX_AUTO_PAGES = 5

/**
 * A sentinel at the end of a list: when it scrolls into view it asks for the
 * next page. It never overlaps two requests, and a request that rejects does
 * not leave it stuck.
 */
const LazyLoad: React.FC<Props> = ({ onLoadMore, isLoading, hasMore }) => {
  const [isFetching, setIsFetching] = useState<boolean>(false)
  const [capped, setCapped] = useState(false)
  const pending = useRef(false)
  const latest = useRef({ onLoadMore, isLoading, hasMore })
  const mounted = useRef(true)
  // Loads started by the sentinel since it last left the view.
  const autoLoads = useRef(0)
  const button = useRef<HTMLButtonElement>(null)

  // Always read the newest props from the observer callback. A layout effect,
  // so they are current before the first reading of a sentinel observed in the
  // same commit; a passive one can run after it and drop that reading.
  useLayoutEffect(() => {
    latest.current = { onLoadMore, isLoading, hasMore }
  })

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const load = () => {
    pending.current = true
    setIsFetching(true)
    Promise.resolve()
      .then(() => latest.current.onLoadMore())
      .catch(() => {
        // The list shows its own error state; the sentinel only needs to unlock.
      })
      .finally(() => {
        pending.current = false
        if (mounted.current) setIsFetching(false)
      })
  }

  // Called for every reading, including the first one after the sentinel is
  // observed again (see the key below), so a page that leaves it in view
  // loads the next one without a scroll.
  const onChange = (visible: boolean) => {
    if (!visible) {
      autoLoads.current = 0
      // Rows that Load more brought in push the sentinel out of view: keep the
      // button while it has focus, so the keyboard user isn't sent to the top.
      if (document.activeElement !== button.current) setCapped(false)
      return
    }
    const { isLoading: parentLoading, hasMore: more } = latest.current
    if (pending.current || parentLoading || more === false) return
    const limit = more === undefined ? 1 : MAX_AUTO_PAGES
    if (autoLoads.current >= limit) {
      if (more) setCapped(true)
      return
    }
    autoLoads.current += 1
    load()
  }

  const [ref] = useInView({
    threshold: 0.7,
    onChange
  })

  const busy = isFetching || Boolean(isLoading)

  // The button stays mounted (not disabled, which would drop focus) while the
  // page loads; the sentinel then carries on with a fresh budget.
  const loadMore = () => {
    if (pending.current || latest.current.isLoading) return
    autoLoads.current = 0
    load()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      {/* A new element when loading ends, so the observer takes a fresh reading. */}
      <div
        key={busy ? 'busy' : 'idle'}
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
            visibility: busy ? 'visible' : 'hidden'
          }}
        >
          <CircularProgress size={28} />
        </div>
      </div>
      {capped && hasMore && (
        <Button ref={button} variant="outlined" onClick={loadMore} aria-disabled={busy || undefined} sx={{ minHeight: 44 }}>
          {busy ? 'Loading…' : 'Load more'}
        </Button>
      )}
    </div>
  )
}

export default LazyLoad
