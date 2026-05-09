import { useEffect, useRef } from 'react'

/**
 * useAutoSave — debounce-trigger save() whenever any of the watched values
 * change. WritePage 把 draft.* 字段作为 deps，draftStore 已经持久化到
 * localStorage，所以 save 即「mark 为 saved 状态」。
 *
 * delay 默认 800ms。
 */
export function useAutoSave(
  deps: ReadonlyArray<unknown>,
  save: () => void,
  delay = 800,
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firstRender = useRef(true)

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => save(), delay)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, delay, save])
}
