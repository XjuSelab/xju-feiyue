import { cn } from '@/lib/cn'
import type { TraceItem } from '../../types'

interface TraceTabProps {
  trace: TraceItem[]
}

export function TraceTab({ trace }: TraceTabProps) {
  if (trace.length === 0) {
    return (
      <div className="px-3 py-8 text-center font-sans text-[13px] text-text-faint">
        该导师未启动 agent 调研,或调研日志被清理
      </div>
    )
  }

  return (
    <div className="schools-trace-line relative pl-4">
      {trace.map((t, i) => {
        const isFinal = t.kind === 'final'
        const num = isFinal ? 'final' : `iter ${i + 1}`
        return (
          <div
            key={i}
            data-final={isFinal || undefined}
            className={cn(
              'schools-trace-row relative grid items-baseline gap-2.5 py-2 font-sans text-[12.5px] text-text-muted',
            )}
            style={{ gridTemplateColumns: '64px 56px 1fr' }}
          >
            <span className="font-mono text-[11px] text-text-faint">{num}</span>
            <span
              className={cn(
                'w-fit rounded-[3px] px-1.5 py-px text-[11.5px] font-medium',
                isFinal ? 'bg-tag-tools text-cat-tools' : 'bg-bg-subtle text-text',
              )}
            >
              {t.label}
            </span>
            <span className="overflow-hidden text-ellipsis font-mono text-[11.5px] leading-[1.6] text-text">
              {t.detail}
            </span>
          </div>
        )
      })}
    </div>
  )
}
