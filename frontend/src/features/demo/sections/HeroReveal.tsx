import { useEffect, useRef, type CSSProperties } from 'react'
import { ArrowDown } from 'lucide-react'
import { usePrefersReducedMotion } from '../lib/motion'

const SLICES = 8
const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)'

function HeadingInner() {
  return (
    <div className="whitespace-nowrap font-serif text-[clamp(48px,9vw,108px)] font-semibold leading-[1.08] tracking-[-0.02em] text-text">
      纸与墨，
      <br />
      亦能<span className="text-link">飞跃</span>。
    </div>
  )
}

const sliceBand = (i: number) => ({
  t: ((i * 100) / SLICES).toFixed(2),
  b: (((SLICES - 1 - i) * 100) / SLICES).toFixed(2),
  fromLeft: i % 2 === 0,
})

/**
 * §0 Hero — 标题复制为 8 层水平条带（clip-path inset 切割），
 * WAAPI 奇偶反向 stagger 展开成「撕裂拼合」开场。真实标题走 sr-only。
 */
export function HeroReveal() {
  const reduced = usePrefersReducedMotion()
  const layersRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (reduced) return
    const root = layersRef.current
    if (!root) return
    const anims = Array.from(root.children).map((node, i) => {
      const { t, b, fromLeft } = sliceBand(i)
      return (node as HTMLElement).animate(
        [
          {
            clipPath: fromLeft ? `inset(${t}% 100% ${b}% 0%)` : `inset(${t}% 0% ${b}% 100%)`,
            transform: fromLeft ? 'translateX(-14px)' : 'translateX(14px)',
          },
          { clipPath: `inset(${t}% 0% ${b}% 0%)`, transform: 'translateX(0px)' },
        ],
        { duration: 600, delay: 200 + i * 80, easing: EASE, fill: 'both' },
      )
    })
    return () => anims.forEach((a) => a.cancel())
  }, [reduced])

  return (
    <section className="relative flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div aria-hidden className="demo-hero-bg absolute inset-0" />

      <p className="demo-hero-eyebrow relative z-10 font-mono text-[11px] uppercase tracking-[0.35em] text-text-faint">
        Motion Lab · 飞跃手册 · Feiyue
      </p>

      <div className="relative z-10 mt-8">
        {reduced ? (
          <h1>
            <HeadingInner />
          </h1>
        ) : (
          <>
            <h1 className="sr-only">纸与墨，亦能飞跃。</h1>
            <div aria-hidden className="invisible">
              <HeadingInner />
            </div>
            <div ref={layersRef} aria-hidden className="absolute inset-0">
              {Array.from({ length: SLICES }, (_, i) => {
                const { t, b, fromLeft } = sliceBand(i)
                const style: CSSProperties = {
                  clipPath: fromLeft ? `inset(${t}% 100% ${b}% 0%)` : `inset(${t}% 0% ${b}% 100%)`,
                  willChange: 'clip-path, transform',
                }
                return (
                  <div key={i} className="absolute inset-0" style={style}>
                    <HeadingInner />
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      <p className="demo-hero-sub relative z-10 mt-7 max-w-md text-[15px] leading-relaxed text-text-muted">
        八个章节，八种动效技术 —— 炫在编排与质感，不在艳俗渐变。
      </p>

      <div className="demo-hero-hint absolute bottom-10 left-1/2 z-10 -translate-x-1/2 text-text-faint">
        <span className="demo-hero-hint-bob block">
          <ArrowDown size={18} strokeWidth={1.75} aria-hidden />
        </span>
      </div>
    </section>
  )
}
