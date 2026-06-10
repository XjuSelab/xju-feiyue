import { useEffect, useRef, useState } from 'react'

/* /demo Motion Lab 共用动效原语：
   - 所有滚动联动都走「rAF 写 CSS 变量、渲染交给 compositor」这一条路，
     刻意不用 animation-timeline: scroll()（Chrome-only 兼容陷阱）。
   - 所有 hook 在 prefers-reduced-motion 下自行短路。 */

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

/** 解析 tokens.css 变量为实际色值，供 canvas 使用（canvas 不识别 var()）。 */
export function readToken(name: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || '#37352f'
}

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/**
 * 进入视口达 enter 比例置 true；完全离开视口才置 false——
 * 部分可见时保持现状，避免边缘抖动导致动画反复重置。
 */
export function useInView<T extends Element>({ enter = 0.25 }: { enter?: number } = {}) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.intersectionRatio >= enter) setInView(true)
          else if (!e.isIntersecting) setInView(false)
        }
      },
      { threshold: [0, enter] },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [enter])
  return { ref, inView }
}

/**
 * 把元素穿越视口的进度 (0→1) 写成元素上的 CSS 变量。
 * 几何信息在 resize 时缓存，rAF 帧内只读 scrollY，不触发 layout；
 * 元素远离视口（rootMargin 外）时整个循环停摆。
 */
export function useScrollProgressVar<T extends HTMLElement>(varName = '--sp') {
  const ref = useRef<T>(null)
  const reduced = usePrefersReducedMotion()
  useEffect(() => {
    const el = ref.current
    if (!el || reduced) return
    let top = 0
    let height = 1
    let vh = window.innerHeight
    const measure = () => {
      const r = el.getBoundingClientRect()
      top = r.top + window.scrollY
      height = r.height
      vh = window.innerHeight
    }
    let raf = 0
    let running = false
    let last = -1
    const tick = () => {
      if (!running) return
      const p = clamp01((window.scrollY + vh - top) / (vh + height))
      if (Math.abs(p - last) > 0.0005) {
        last = p
        el.style.setProperty(varName, p.toFixed(4))
      }
      raf = requestAnimationFrame(tick)
    }
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0]
        if (!e) return
        if (e.isIntersecting && !running) {
          running = true
          measure()
          raf = requestAnimationFrame(tick)
        } else if (!e.isIntersecting && running) {
          running = false
          cancelAnimationFrame(raf)
        }
      },
      { rootMargin: '160px 0px 160px 0px' },
    )
    io.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      running = false
      cancelAnimationFrame(raf)
      io.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [reduced, varName])
  return ref
}

/** 整页阅读进度 (0→1) 写成 CSS 变量，驱动顶部进度发丝线。 */
export function usePageProgressVar<T extends HTMLElement>(varName = '--pp') {
  const ref = useRef<T>(null)
  const reduced = usePrefersReducedMotion()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduced) {
      el.style.setProperty(varName, '1')
      return
    }
    let raf = 0
    let last = -1
    const tick = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      const p = max > 0 ? clamp01(window.scrollY / max) : 0
      if (Math.abs(p - last) > 0.001) {
        last = p
        el.style.setProperty(varName, p.toFixed(4))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [reduced, varName])
  return ref
}
