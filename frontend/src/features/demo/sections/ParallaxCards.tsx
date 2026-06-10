import type { CSSProperties } from 'react'
import { CATEGORIES } from '@/lib/categories'
import { cn } from '@/lib/cn'
import { useScrollProgressVar } from '../lib/motion'

const SPEEDS = [-64, 48, -36, 56, -48, 40, -58] as const
const ROTS = [-1.2, 0.8, -0.6, 1.1, -0.9, 0.7, -1] as const
const COUNTS = [38, 31, 17, 20, 11, 28, 11] as const

/**
 * §2 — rAF 视差 + 3D 斜切卡。transform 三层分工：
 * .demo-par 消费 --sp 做差速视差，.demo-fly 负责入场，.demo-card 负责 hover，
 * 互不抢插值通道。卡片 mono 脚注直接亮出自己的 --speed —— 自述式炫技。
 */
export function ParallaxCards() {
  const stageRef = useScrollProgressVar<HTMLDivElement>('--sp')

  return (
    <div ref={stageRef} style={{ perspective: '1000px' }}>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((c, i) => {
          const Icon = c.icon
          return (
            <div
              key={c.id}
              className={cn('demo-par', i % 3 === 1 && 'lg:mt-12', i % 3 === 2 && 'lg:mt-24')}
              style={
                {
                  '--speed': SPEEDS[i] ?? 0,
                  '--i': i,
                  '--rot': `${ROTS[i] ?? 0}deg`,
                } as CSSProperties
              }
            >
              <div className="demo-fly">
                <article className="demo-card rounded-lg border border-border bg-bg p-5 shadow-card">
                  <span
                    aria-hidden
                    className="flex size-10 items-center justify-center rounded-md"
                    style={{
                      backgroundColor: `var(${c.tagBgVar})`,
                      color: `var(${c.colorVar})`,
                    }}
                  >
                    <Icon size={18} strokeWidth={1.75} />
                  </span>
                  <h3 className="mt-4 font-serif text-lg font-semibold text-text">{c.label}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-text-muted">{c.desc}</p>
                  <p className="mt-4 font-mono text-[11px] uppercase tracking-wider text-text-faint">
                    {String(COUNTS[i] ?? 0).padStart(2, '0')} 篇 · --speed: {SPEEDS[i] ?? 0}
                  </p>
                </article>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
