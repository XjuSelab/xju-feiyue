import { useEffect, useRef, type RefObject } from 'react'

/**
 * useScrollSync — debounce 50ms 双向同步两个滚动容器的 scrollTop 比例。
 * 简化版：editor 滚 → preview 跟随；preview 滚 → editor 跟随。
 * 用 ratio = scrollTop / (scrollHeight - clientHeight)。
 */
export function useScrollSync(
  a: RefObject<HTMLElement | null>,
  b: RefObject<HTMLElement | null>,
  enabled = true,
) {
  const lock = useRef<'a' | 'b' | null>(null)
  const tid = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const aEl = a.current
    const bEl = b.current
    if (!enabled || !aEl || !bEl) return

    const sync = (
      from: HTMLElement,
      to: HTMLElement,
      who: 'a' | 'b',
    ) => {
      if (lock.current && lock.current !== who) return
      lock.current = who
      const denom = from.scrollHeight - from.clientHeight
      if (denom <= 0) {
        lock.current = null
        return
      }
      const ratio = from.scrollTop / denom
      to.scrollTop = ratio * (to.scrollHeight - to.clientHeight)
      if (tid.current) clearTimeout(tid.current)
      tid.current = setTimeout(() => {
        lock.current = null
      }, 50)
    }

    const onA = () => sync(aEl, bEl, 'a')
    const onB = () => sync(bEl, aEl, 'b')
    aEl.addEventListener('scroll', onA, { passive: true })
    bEl.addEventListener('scroll', onB, { passive: true })
    return () => {
      aEl.removeEventListener('scroll', onA)
      bEl.removeEventListener('scroll', onB)
      if (tid.current) clearTimeout(tid.current)
    }
  }, [a, b, enabled])
}
