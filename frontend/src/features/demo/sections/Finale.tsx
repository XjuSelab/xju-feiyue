import { useEffect, useRef, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePrefersReducedMotion, useScrollProgressVar } from '../lib/motion'

const MAGNET_R = 120
const PULL = 0.28

/**
 * §7 终幕 — 三层技术叠加：
 * 1) 词层景深视差：标题分词消费 --sp，按 --depth 差速位移；
 * 2) ghost 描边巨字：opacity 由 --sp 计算，滚到终点时「刻」入纸面；
 * 3) 磁吸 CTA + 双色 glow 跟随：单 rAF 循环做临界阻尼 lerp，settle 后自动停摆。
 */
export function Finale() {
  const reduced = usePrefersReducedMotion()
  const secRef = useScrollProgressVar<HTMLElement>('--sp')
  const btnRef = useRef<HTMLSpanElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (reduced) return
    const sec = secRef.current
    const btn = btnRef.current
    const glow = glowRef.current
    if (!sec || !btn || !glow) return

    let raf = 0
    let tx = 0
    let ty = 0
    let cx = 0
    let cy = 0
    let gtx = 30
    let gty = 30
    let gx = 30
    let gy = 30

    const loop = () => {
      cx += (tx - cx) * 0.14
      cy += (ty - cy) * 0.14
      gx += (gtx - gx) * 0.05
      gy += (gty - gy) * 0.05
      btn.style.setProperty('--mx', `${cx.toFixed(2)}px`)
      btn.style.setProperty('--my', `${cy.toFixed(2)}px`)
      glow.style.setProperty('--gx', `${gx.toFixed(2)}%`)
      glow.style.setProperty('--gy', `${gy.toFixed(2)}%`)
      const settled =
        Math.abs(tx - cx) < 0.05 &&
        Math.abs(ty - cy) < 0.05 &&
        Math.abs(gtx - gx) < 0.1 &&
        Math.abs(gty - gy) < 0.1
      if (settled) {
        raf = 0
        return
      }
      raf = requestAnimationFrame(loop)
    }
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(loop)
    }

    const onMove = (e: PointerEvent) => {
      const r = sec.getBoundingClientRect()
      gtx = ((e.clientX - r.left) / r.width) * 100
      gty = ((e.clientY - r.top) / r.height) * 100
      const b = btn.getBoundingClientRect()
      const dx = e.clientX - (b.left + b.width / 2)
      const dy = e.clientY - (b.top + b.height / 2)
      if (Math.hypot(dx, dy) < MAGNET_R) {
        tx = dx * PULL
        ty = dy * PULL
      } else {
        tx = 0
        ty = 0
      }
      kick()
    }
    const onLeave = () => {
      tx = 0
      ty = 0
      kick()
    }

    sec.addEventListener('pointermove', onMove)
    sec.addEventListener('pointerleave', onLeave)
    return () => {
      sec.removeEventListener('pointermove', onMove)
      sec.removeEventListener('pointerleave', onLeave)
      cancelAnimationFrame(raf)
    }
  }, [reduced, secRef])

  return (
    <section ref={secRef} className="relative overflow-hidden px-6 py-40 text-center">
      <div ref={glowRef} aria-hidden className="demo-finale-glow pointer-events-none absolute inset-0" />
      <div
        aria-hidden
        className="demo-finale-ghost pointer-events-none absolute inset-0 flex select-none items-center justify-center text-[clamp(180px,30vw,360px)]"
      >
        飞跃
      </div>

      <h2 className="relative font-serif text-[clamp(34px,5vw,56px)] font-semibold leading-[1.3] text-text">
        <span className="demo-depth inline-block" style={{ '--depth': -56 } as CSSProperties}>
          飞跃，
        </span>
        <span className="demo-depth inline-block" style={{ '--depth': -30 } as CSSProperties}>
          不只是一步跳远，
        </span>
        <br />
        <span className="demo-depth inline-block" style={{ '--depth': -12 } as CSSProperties}>
          而是迈向更远的未来。
        </span>
      </h2>
      <p className="relative mx-auto mt-6 max-w-md text-sm leading-relaxed text-text-muted">
        八种技术，皆出自同一套纸墨体系。现在，轮到你把故事写进来。
      </p>

      <span ref={btnRef} className="demo-magnet relative mt-12 inline-block">
        <Button asChild size="lg">
          <Link to="/browse">
            开始飞跃
            <ArrowRight size={16} strokeWidth={1.75} aria-hidden className="ml-1.5" />
          </Link>
        </Button>
      </span>
    </section>
  )
}
