import { useEffect, useState } from 'react'

export type CommentViewMode = 'inline' | 'drawer' | 'off'

const STORAGE_KEY = 'labnotes.comment-view-mode'
const VALID: readonly CommentViewMode[] = ['inline', 'drawer', 'off']

function readStored(): CommentViewMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v && (VALID as readonly string[]).includes(v)) {
      return v as CommentViewMode
    }
  } catch {
    /* localStorage unavailable — fall through */
  }
  return 'inline'
}

/**
 * Persist comment-display preference (inline / drawer / off) in localStorage.
 * Auto-collapses to 'inline' when viewport ≤ 768px so the drawer doesn't
 * crowd the mobile reading width.
 */
export function useCommentViewMode(): [CommentViewMode, (m: CommentViewMode) => void] {
  const [mode, setMode] = useState<CommentViewMode>(readStored)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(max-width: 768px)')
    const apply = () => {
      if (mql.matches && mode === 'drawer') {
        setMode('inline')
      }
    }
    apply()
    mql.addEventListener('change', apply)
    return () => mql.removeEventListener('change', apply)
  }, [mode])

  const persist = (m: CommentViewMode) => {
    setMode(m)
    try {
      localStorage.setItem(STORAGE_KEY, m)
    } catch {
      /* ignore quota / disabled */
    }
  }

  return [mode, persist]
}
