import { useEffect, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { readToken, useInView, usePrefersReducedMotion } from '../lib/motion'

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  tx: number
  ty: number
  k: number
  size: number
  color: string
}

const GLYPH = '飞跃'
const CANVAS_H = 380
const DAMPING = 0.86
const REPEL_R = 90
const PALETTE_VARS = [
  '--cat-research',
  '--cat-course',
  '--cat-recommend',
  '--cat-competition',
  '--cat-kaggle',
  '--cat-tools',
  '--cat-life',
]

/**
 * §3 SIGNATURE — Canvas 粒子字形。
 * 离屏 canvas fillText「飞跃」→ getImageData 按 alpha 降采样出目标点；
 * 每帧弹簧积分 (k≈0.04–0.07, damping 0.86) 把散落粒子拉聚成字，
 * 鼠标 90px 半径斥力推开、移开回流。仅入视口时运行 rAF；
 * reduced-motion 直接静态落位。
 */
export function ParticleSculpture() {
  const reduced = usePrefersReducedMotion()
  const { ref: wrapRef, inView } = useInView<HTMLDivElement>({ enter: 0.3 })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const scatterRef = useRef<() => void>(() => {})
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!inView) return
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let alive = true
    let raf = 0
    const mouse = { x: -9999, y: -9999 }
    const palette = PALETTE_VARS.map(readToken)

    const setup = () => {
      const w = Math.max(320, Math.floor(wrap.getBoundingClientRect().width))
      const h = CANVAS_H
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const off = document.createElement('canvas')
      off.width = w
      off.height = h
      const octx = off.getContext('2d')
      if (!octx) return
      const fs = Math.min(w / 2.6, h * 0.78)
      octx.fillStyle = '#000'
      octx.font = `600 ${fs}px "Noto Serif SC", "Source Serif 4", serif`
      octx.textAlign = 'center'
      octx.textBaseline = 'middle'
      octx.fillText(GLYPH, w / 2, h / 2)
      const img = octx.getImageData(0, 0, w, h).data
      const step = Math.max(4, Math.round(fs / 96))
      const pts: Particle[] = []
      for (let y = 0; y < h; y += step) {
        for (let x = 0; x < w; x += step) {
          if ((img[(y * w + x) * 4 + 3] ?? 0) > 128) {
            pts.push({
              x: Math.random() * w,
              y: Math.random() * h,
              vx: 0,
              vy: 0,
              tx: x,
              ty: y,
              k: 0.04 + Math.random() * 0.03,
              size: 1.4 + Math.random() * 1.2,
              color: palette[Math.floor(Math.random() * palette.length)] ?? '#37352f',
            })
          }
        }
      }
      particlesRef.current = pts
      setCount(pts.length)
    }

    scatterRef.current = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      for (const p of particlesRef.current) {
        const a = Math.random() * Math.PI * 2
        const speed = 6 + Math.random() * 12
        p.x = Math.random() * w
        p.y = Math.random() * h
        p.vx = Math.cos(a) * speed
        p.vy = Math.sin(a) * speed
      }
    }

    const drawStatic = () => {
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight)
      for (const p of particlesRef.current) {
        ctx.fillStyle = p.color
        ctx.fillRect(p.tx, p.ty, p.size, p.size)
      }
    }

    const tick = () => {
      if (!alive) return
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight)
      for (const p of particlesRef.current) {
        p.vx += (p.tx - p.x) * p.k
        p.vy += (p.ty - p.y) * p.k
        p.vx *= DAMPING
        p.vy *= DAMPING
        const dx = p.x - mouse.x
        const dy = p.y - mouse.y
        const d2 = dx * dx + dy * dy
        if (d2 < REPEL_R * REPEL_R) {
          const d = Math.sqrt(d2) || 1
          const f = ((REPEL_R - d) / REPEL_R) * 2.2
          p.vx += (dx / d) * f
          p.vy += (dy / d) * f
        }
        p.x += p.vx
        p.y += p.vy
        ctx.fillStyle = p.color
        ctx.fillRect(p.x, p.y, p.size, p.size)
      }
      raf = requestAnimationFrame(tick)
    }

    const begin = () => {
      if (!alive) return
      setup()
      if (reduced) drawStatic()
      else raf = requestAnimationFrame(tick)
    }

    // CJK 字体子集化加载有延迟：等字体就绪再采样，900ms 兜底防卡死。
    const fontReady = document.fonts.load(`600 120px "Noto Serif SC"`).catch(() => undefined)
    const timeout = new Promise((resolve) => setTimeout(resolve, 900))
    void Promise.race([fontReady, timeout]).then(begin)

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      mouse.x = e.clientX - r.left
      mouse.y = e.clientY - r.top
    }
    const onLeave = () => {
      mouse.x = -9999
      mouse.y = -9999
    }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)

    let firstRo = true
    const ro = new ResizeObserver(() => {
      if (firstRo) {
        firstRo = false
        return
      }
      if (!alive) return
      setup()
      if (reduced) drawStatic()
    })
    ro.observe(wrap)

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      ro.disconnect()
    }
  }, [inView, reduced, wrapRef])

  return (
    <div ref={wrapRef} className="flex flex-col items-center">
      <p className="sr-only">飞跃 —— 由约三千颗类别色粒子聚合而成的字形</p>
      <canvas ref={canvasRef} aria-hidden className="block w-full cursor-crosshair" />
      <div className="mt-3 flex w-full flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-wider text-text-faint">
          canvas 2d · {count > 0 ? count : '~3000'} particles · spring k .04–.07 · damping .86 ·
          repel r{REPEL_R}
        </p>
        <button
          type="button"
          onClick={() => scatterRef.current()}
          className="inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-text-faint transition hover:bg-bg hover:text-text-muted"
        >
          <RotateCcw size={11} strokeWidth={1.75} aria-hidden />
          重新聚合
        </button>
      </div>
      <p className="mt-8 font-serif text-base italic text-text-muted">
        每一颗墨点，都是一篇笔记。
      </p>
    </div>
  )
}
