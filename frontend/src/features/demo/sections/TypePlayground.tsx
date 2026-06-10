import { useEffect, useRef, type RefObject } from 'react'
import { clamp01, lerp, useInView, usePrefersReducedMotion } from '../lib/motion'

const FW = { min: 300, max: 800, init: 560 }
const LS = { min: -0.04, max: 0.3, init: 0.02 } // em
const LH = { min: 0.95, max: 1.6, init: 1.15 }

/**
 * §5 — 排版乐器。指针 X 映射字距、Y 同时映射可变字重与行高，
 * rAF 节流后全部写成 CSS 变量（标题/读数条/十字线共用，零 React 重渲染）。
 * 离开时加 .demo-pg-settle，靠 @property 注册的 typed custom properties
 * 平滑回弹到初始值（不支持的浏览器优雅降级为直接复位）。
 */
export function TypePlayground() {
  const reduced = usePrefersReducedMotion()
  const { ref: ioRef, inView } = useInView<HTMLDivElement>({ enter: 0.2 })
  const areaRef = useRef<HTMLDivElement>(null)
  const fwRef = useRef<HTMLSpanElement>(null)
  const lsRef = useRef<HTMLSpanElement>(null)
  const lhRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!inView || reduced) return
    const area = areaRef.current
    if (!area) return

    let raf = 0
    let queued = false
    let px = 0.5
    let py = (FW.init - FW.min) / (FW.max - FW.min)

    const apply = () => {
      queued = false
      const fw = Math.round(lerp(FW.min, FW.max, py))
      const ls = lerp(LS.min, LS.max, px)
      const lh = lerp(LH.min, LH.max, py)
      area.style.setProperty('--pg-fw', String(fw))
      // @property 把 --pg-ls 注册为 <length>，须用绝对单位才可插值；
      // 系数 56 ≈ 标题 clamp(40px,6vw,72px) 的中值，等效 em 手感。
      area.style.setProperty('--pg-ls', `${(ls * 56).toFixed(2)}px`)
      area.style.setProperty('--pg-lh', lh.toFixed(3))
      area.style.setProperty('--pg-x', `${(px * 100).toFixed(2)}%`)
      area.style.setProperty('--pg-y', `${(py * 100).toFixed(2)}%`)
      area.style.setProperty('--pg-fwr', ((fw - FW.min) / (FW.max - FW.min)).toFixed(3))
      area.style.setProperty('--pg-lsr', ((ls - LS.min) / (LS.max - LS.min)).toFixed(3))
      area.style.setProperty('--pg-lhr', ((lh - LH.min) / (LH.max - LH.min)).toFixed(3))
      if (fwRef.current) fwRef.current.textContent = String(fw)
      if (lsRef.current) lsRef.current.textContent = `${ls.toFixed(2)}em`
      if (lhRef.current) lhRef.current.textContent = lh.toFixed(2)
    }

    const onMove = (e: PointerEvent) => {
      const r = area.getBoundingClientRect()
      px = clamp01((e.clientX - r.left) / r.width)
      py = clamp01((e.clientY - r.top) / r.height)
      area.classList.remove('demo-pg-settle')
      if (!queued) {
        queued = true
        raf = requestAnimationFrame(apply)
      }
    }
    const onLeave = () => {
      area.classList.add('demo-pg-settle')
      px = 0.5
      py = (FW.init - FW.min) / (FW.max - FW.min)
      if (!queued) {
        queued = true
        raf = requestAnimationFrame(apply)
      }
    }

    area.addEventListener('pointermove', onMove)
    area.addEventListener('pointerleave', onLeave)
    apply()
    return () => {
      area.removeEventListener('pointermove', onMove)
      area.removeEventListener('pointerleave', onLeave)
      cancelAnimationFrame(raf)
    }
  }, [inView, reduced])

  return (
    <div ref={ioRef}>
      <div
        ref={areaRef}
        className="relative cursor-crosshair overflow-hidden rounded-lg border border-border bg-bg p-10 shadow-card lg:p-16"
      >
        {/* 十字线随指针游走，给出「测量仪器」的反馈 */}
        <div
          aria-hidden
          className="demo-pg-cross pointer-events-none absolute inset-y-0 w-px bg-border-strong opacity-60"
          style={{ left: 'var(--pg-x, 50%)' }}
        />
        <div
          aria-hidden
          className="demo-pg-cross pointer-events-none absolute inset-x-0 h-px bg-border-strong opacity-60"
          style={{ top: 'var(--pg-y, 50%)' }}
        />

        <h3 className="demo-pg-title relative font-serif text-[clamp(40px,6vw,72px)] text-text">
          不只跨越，
          <br />
          而是飞跃。
        </h3>

        <div className="relative mt-12 grid max-w-sm gap-2 font-mono text-[11px] uppercase tracking-wider text-text-faint">
          <Readout
            label="wght"
            barVar="--pg-fwr"
            color="--cat-kaggle"
            valueRef={fwRef}
            initial={String(FW.init)}
          />
          <Readout
            label="trak"
            barVar="--pg-lsr"
            color="--cat-course"
            valueRef={lsRef}
            initial={`${LS.init.toFixed(2)}em`}
          />
          <Readout
            label="lead"
            barVar="--pg-lhr"
            color="--cat-tools"
            valueRef={lhRef}
            initial={LH.init.toFixed(2)}
          />
        </div>
      </div>
      <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-text-faint">
        移动指针 — X 轴控制字距 · Y 轴同时驱动可变字重与行高
      </p>
    </div>
  )
}

function Readout({
  label,
  barVar,
  color,
  valueRef,
  initial,
}: {
  label: string
  barVar: string
  color: string
  valueRef: RefObject<HTMLSpanElement>
  initial: string
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-9">{label}</span>
      <span className="h-1 w-24 overflow-hidden rounded-full bg-bg-subtle">
        <span
          className="block h-full rounded-full"
          style={{
            width: `calc(var(${barVar}, 0.5) * 100%)`,
            backgroundColor: `var(${color})`,
          }}
        />
      </span>
      <span ref={valueRef} className="tabular-nums text-text-muted">
        {initial}
      </span>
    </div>
  )
}
