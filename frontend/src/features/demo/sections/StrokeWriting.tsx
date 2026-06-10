import { useState, type CSSProperties } from 'react'
import { RotateCcw } from 'lucide-react'

const TEXT = '先描边，后填色'
const STROKE_VARS = [
  '--cat-research',
  '--cat-course',
  '--cat-recommend',
  '--cat-competition',
  '--cat-kaggle',
  '--cat-tools',
  '--cat-life',
] as const

/**
 * §1 — SVG <text> 描边书写：stroke-dasharray/dashoffset 扫出字形轮廓，
 * fill 在时间轴 55% 处接力淡入；每字一个 tspan 按 --i 级联，
 * 颜色循环七大板块强调色。key 重挂载即重播。
 */
export function StrokeWriting() {
  const [run, setRun] = useState(0)

  return (
    <div className="flex flex-col items-center gap-4">
      <svg key={run} viewBox="0 0 760 150" role="img" aria-label={TEXT} className="w-full max-w-[760px]">
        <text x="380" y="84" textAnchor="middle" dominantBaseline="middle" className="demo-stroke-text">
          {Array.from(TEXT).map((ch, i) => (
            <tspan
              key={i}
              className="demo-stroke-ch"
              style={
                {
                  '--i': i,
                  '--sc': `var(${STROKE_VARS[i % STROKE_VARS.length] ?? '--cat-kaggle'})`,
                } as CSSProperties
              }
            >
              {ch}
            </tspan>
          ))}
        </text>
      </svg>
      <button
        type="button"
        onClick={() => setRun((n) => n + 1)}
        className="inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-text-faint transition hover:bg-bg-subtle hover:text-text-muted"
      >
        <RotateCcw size={11} strokeWidth={1.75} aria-hidden />
        Replay
      </button>
    </div>
  )
}
