import type { DiffSegment } from '@/api/schemas/ai'
import { cn } from '@/lib/cn'

type Props = {
  segments: DiffSegment[]
  /** 'inline'：单列，add 段紧挨 del 段；'sidebyside'：左 before 右 after */
  view: 'inline' | 'sidebyside'
  className?: string
}

/**
 * spec 颜色严守:
 *   add: bg rgba(15,123,108,0.12) + fg #0F5E54 + underline （--ai-add-bg/-fg）
 *   del: bg rgba(224,62,62,0.12)  + fg #B91C1C + line-through（--ai-del-bg/-fg）
 */
const SEG_CLS: Record<DiffSegment['type'], string> = {
  equal: 'text-text',
  add: 'bg-ai-add-bg text-ai-add-fg underline decoration-ai-add-fg/40',
  del: 'bg-ai-del-bg text-ai-del-fg line-through',
}

export function DiffView({ segments, view, className }: Props) {
  if (view === 'inline') {
    return (
      <pre
        className={cn(
          'whitespace-pre-wrap break-words rounded-md border border-border bg-bg p-4 font-serif text-sm leading-relaxed',
          className,
        )}
      >
        {segments.map((seg, i) => (
          <span key={i} className={SEG_CLS[seg.type]}>
            {seg.text}
          </span>
        ))}
      </pre>
    )
  }

  // sidebyside
  return (
    <div className={cn('grid grid-cols-2 gap-2', className)}>
      <pre className="whitespace-pre-wrap break-words rounded-md border border-border bg-bg p-3 font-serif text-sm leading-relaxed">
        <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-text-faint">
          Before
        </span>
        {segments.map((seg, i) => {
          if (seg.type === 'add') return null
          return (
            <span key={i} className={SEG_CLS[seg.type]}>
              {seg.text}
            </span>
          )
        })}
      </pre>
      <pre className="whitespace-pre-wrap break-words rounded-md border border-border bg-bg p-3 font-serif text-sm leading-relaxed">
        <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-text-faint">
          After
        </span>
        {segments.map((seg, i) => {
          if (seg.type === 'del') return null
          return (
            <span key={i} className={SEG_CLS[seg.type]}>
              {seg.text}
            </span>
          )
        })}
      </pre>
    </div>
  )
}
