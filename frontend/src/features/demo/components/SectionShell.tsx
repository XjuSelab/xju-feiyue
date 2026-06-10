import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { useInView } from '../lib/motion'

type Props = {
  index: number
  /** mono 技术署名，如 "SVG · STROKE-DASHOFFSET" */
  tech: string
  title: string
  desc: string
  tone?: 'default' | 'subtle'
  children: ReactNode
}

/**
 * /demo 各章节外壳：eyebrow(技术署名) + 衬线标题 + 说明，进入视口级联入场。
 * data-on 同时供子内容的 CSS 动画作为触发开关（完全离开视口才复位，可重播）。
 */
export function SectionShell({ index, tech, title, desc, tone = 'default', children }: Props) {
  const { ref, inView } = useInView<HTMLElement>({ enter: 0.18 })
  return (
    <section
      ref={ref}
      data-on={inView || undefined}
      className={cn(tone === 'subtle' && 'bg-bg-subtle/60')}
    >
      <div className="mx-auto max-w-5xl px-6 py-24">
        <header className="max-w-2xl">
          <p className="demo-rev font-mono text-[11px] uppercase tracking-[0.3em] text-text-faint">
            §{index} / {tech}
          </p>
          <h2
            className="demo-rev mt-3 font-serif text-[28px] font-semibold leading-tight text-text"
            style={{ '--d': '90ms' } as CSSProperties}
          >
            {title}
          </h2>
          <p
            className="demo-rev mt-2 text-sm leading-relaxed text-text-muted"
            style={{ '--d': '180ms' } as CSSProperties}
          >
            {desc}
          </p>
        </header>
        <div className="mt-12">{children}</div>
      </div>
    </section>
  )
}
