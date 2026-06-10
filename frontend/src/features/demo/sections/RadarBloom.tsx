import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { CATEGORIES } from '@/lib/categories'
import { easeOutCubic, useInView, usePrefersReducedMotion } from '../lib/motion'

const DATA = [38, 31, 17, 20, 11, 28, 11] as const // 七大板块篇数，合计 156 与 §4 对齐
const VB_W = 400
const VB_H = 350
const CX = 200
const CY = 175
const R = 128
const MAX = 40
const GROW_MS = 900

const angleOf = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / CATEGORIES.length
const vertex = (i: number, r: number): [number, number] => [
  CX + Math.cos(angleOf(i)) * r,
  CY + Math.sin(angleOf(i)) * r,
]
const toPoints = (targets: readonly [number, number][], t: number) =>
  targets.map(([x, y]) => `${(CX + (x - CX) * t).toFixed(2)},${(CY + (y - CY) * t).toFixed(2)}`).join(' ')

/**
 * §6 — SVG 雷达生长。同心网格 CSS scale 由内向外弹出；
 * 数据多边形 points 从圆心 rAF 逐帧插值到真实坐标（easeOutCubic）；
 * 顶点入场（g）与 hover 放大（circle）拆成两个元素，避免 transform 通道互踩。
 */
export function RadarBloom() {
  const reduced = usePrefersReducedMotion()
  const { ref, inView } = useInView<HTMLDivElement>({ enter: 0.35 })
  const polyRef = useRef<SVGPolygonElement>(null)
  const [grown, setGrown] = useState(false)
  const [hover, setHover] = useState<number | null>(null)

  const targets = useMemo(
    () => CATEGORIES.map((_, i) => vertex(i, ((DATA[i] ?? 0) / MAX) * R)),
    [],
  )
  const labels = useMemo(() => CATEGORIES.map((_, i) => vertex(i, R + 30)), [])

  useEffect(() => {
    const poly = polyRef.current
    if (!poly) return
    if (!inView) {
      setGrown(false)
      setHover(null)
      poly.setAttribute('points', toPoints(targets, 0))
      return
    }
    if (reduced) {
      poly.setAttribute('points', toPoints(targets, 1))
      setGrown(true)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / GROW_MS)
      poly.setAttribute('points', toPoints(targets, easeOutCubic(t)))
      if (t < 1) raf = requestAnimationFrame(tick)
      else setGrown(true)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, reduced, targets])

  const hovered = hover !== null ? CATEGORIES[hover] : undefined
  const hoveredTarget = hover !== null ? targets[hover] : undefined

  return (
    <div
      ref={ref}
      data-on={inView || undefined}
      data-grown={grown || undefined}
      className="relative mx-auto max-w-[520px]"
    >
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} role="img" aria-label="七大板块笔记数雷达图" className="w-full">
        {/* 同心网格：由内向外 stagger 弹出 */}
        {[1, 2, 3, 4, 5].map((k) => (
          <polygon
            key={k}
            className="demo-radar-grid"
            style={{ '--i': k - 1 } as CSSProperties}
            points={toPoints(
              CATEGORIES.map((_, i) => vertex(i, (R * k) / 5)),
              1,
            )}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="1"
          />
        ))}
        {/* 轴线 */}
        {CATEGORIES.map((c, i) => {
          const [x, y] = vertex(i, R)
          return (
            <line
              key={c.id}
              x1={CX}
              y1={CY}
              x2={x}
              y2={y}
              stroke="var(--color-border)"
              strokeWidth="1"
            />
          )
        })}
        {/* 数据多边形：rAF 从圆心生长 */}
        <polygon
          ref={polyRef}
          points={toPoints(targets, 0)}
          fill="var(--chart-blue)"
          fillOpacity="0.08"
          stroke="var(--chart-blue)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* 顶点：g 负责入场动画，circle 负责 hover 放大 */}
        {targets.map(([x, y], i) => {
          const c = CATEGORIES[i]
          if (!c) return null
          return (
            <g key={c.id} className="demo-radar-dot-in" style={{ '--i': i } as CSSProperties}>
              <circle
                className="demo-radar-dot"
                cx={x}
                cy={y}
                r="4"
                fill={`var(${c.colorVar})`}
                stroke="var(--color-bg)"
                strokeWidth="1.5"
                tabIndex={0}
                aria-label={`${c.label} ${DATA[i] ?? 0} 篇`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
              />
            </g>
          )
        })}
      </svg>

      {/* 轴标签：DOM 定位（viewBox 坐标 → 百分比），生长完成后淡入 */}
      {labels.map(([x, y], i) => {
        const c = CATEGORIES[i]
        if (!c) return null
        return (
          <div
            key={c.id}
            className="demo-radar-label absolute text-center"
            style={
              {
                left: `${((x / VB_W) * 100).toFixed(2)}%`,
                top: `${((y / VB_H) * 100).toFixed(2)}%`,
                '--i': i,
              } as CSSProperties
            }
          >
            <span className="block text-[13px] font-medium text-text">{c.label}</span>
            <span className="block font-mono text-[10px] text-text-faint">{DATA[i] ?? 0} 篇</span>
          </div>
        )
      })}

      {/* 顶点 tooltip */}
      {hovered && hoveredTarget && (
        <div
          className="demo-radar-tip pointer-events-none absolute z-10 whitespace-nowrap rounded-sm border border-border bg-bg px-2.5 py-1 text-xs shadow-card"
          style={{
            left: `${((hoveredTarget[0] / VB_W) * 100).toFixed(2)}%`,
            top: `${((hoveredTarget[1] / VB_H) * 100).toFixed(2)}%`,
          }}
        >
          <span
            aria-hidden
            className="mr-1.5 inline-block size-1.5 rounded-full align-middle"
            style={{ backgroundColor: `var(${hovered.colorVar})` }}
          />
          <span className="align-middle text-text">
            {hovered.label} · {hover !== null ? (DATA[hover] ?? 0) : 0} 篇
          </span>
        </div>
      )}
    </div>
  )
}
