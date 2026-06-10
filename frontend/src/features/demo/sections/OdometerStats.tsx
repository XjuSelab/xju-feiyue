import { useEffect, useRef } from 'react'
import { easeOutCubic, useInView, usePrefersReducedMotion } from '../lib/motion'

const STATS = [
  { target: 156, unit: '篇笔记', desc: '从选课指北到上岸经验' },
  { target: 7, unit: '大板块', desc: '科研、课程，到生活' },
  { target: 23, unit: '所院校', desc: '导师招生投递参考' },
  { target: 48, unit: '位贡献者', desc: '把走过的路写给后来人' },
] as const

const ROLL_DISTANCE = 26
const DURATION = 1500
// 0..9 后补一个 0，滚动越过 9 时无缝绕回。
const STRIP_DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0] as const

/**
 * §4 — odometer 数字带。每一位是竖排 0-9 字带，rAF 驱动连续 translateY 滚动
 * （slot-reel 式，各位差速旋转），easeOutCubic 收尾恰好落在整数位。
 * 数值写 transform 不走 React 渲染；tabular-nums 防宽度抖动。
 */
export function OdometerStats() {
  const reduced = usePrefersReducedMotion()
  const { ref, inView } = useInView<HTMLDivElement>({ enter: 0.4 })
  const stripRefs = useRef<(HTMLSpanElement | null)[][]>(STATS.map(() => []))

  useEffect(() => {
    const apply = (si: number, value: number) => {
      const strips = stripRefs.current[si] ?? []
      const places = strips.length
      strips.forEach((el, pi) => {
        if (!el) return
        const pow = Math.pow(10, places - 1 - pi)
        const q = value / pow
        // 个位连续旋转；高位只在低位 9→0 的最后 10% 区间联动进位，
        // 这样任意整数终值都恰好落在整位上（真·odometer 行为）。
        const f = q % 1
        const v = pow === 1 ? q % 10 : (Math.floor(q) % 10) + (f > 0.9 ? (f - 0.9) * 10 : 0)
        el.style.transform = `translateY(${(-v).toFixed(3)}em)`
      })
    }

    if (!inView) {
      STATS.forEach((s, si) => apply(si, Math.max(0, s.target - ROLL_DISTANCE)))
      return
    }
    if (reduced) {
      STATS.forEach((s, si) => apply(si, s.target))
      return
    }

    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / DURATION)
      const e = easeOutCubic(t)
      STATS.forEach((s, si) => {
        const from = Math.max(0, s.target - ROLL_DISTANCE)
        apply(si, from + (s.target - from) * e)
      })
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, reduced])

  return (
    <div ref={ref} data-on={inView || undefined}>
      <p className="demo-odo-eyebrow font-mono text-[11px] uppercase text-text-faint">
        Accumulated · 截至本周
      </p>
      <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
        {STATS.map((s, si) => {
          const digits = String(s.target).length
          return (
            <div key={s.unit} className="border-l border-border pl-5">
              <p className="flex items-baseline gap-2 text-text">
                <span
                  aria-hidden
                  className="inline-flex font-serif text-[44px] font-semibold leading-none tabular-nums"
                >
                  {Array.from({ length: digits }, (_, pi) => (
                    <span key={pi} className="inline-block h-[1em] overflow-hidden">
                      <span
                        ref={(el) => {
                          const row = stripRefs.current[si]
                          if (row) row[pi] = el
                        }}
                        className="block will-change-transform"
                      >
                        {STRIP_DIGITS.map((d, di) => (
                          <span key={di} className="block h-[1em] leading-none">
                            {d}
                          </span>
                        ))}
                      </span>
                    </span>
                  ))}
                </span>
                <span className="sr-only">{s.target}</span>
                <span className="font-serif text-base italic text-text-muted">{s.unit}</span>
              </p>
              <p className="demo-odo-desc mt-3 text-[13px] leading-relaxed text-text-muted">
                {s.desc}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
