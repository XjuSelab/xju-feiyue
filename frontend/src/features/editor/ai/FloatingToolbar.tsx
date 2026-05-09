import {
  Wand2,
  Scissors,
  Maximize2,
  MessageSquare,
  Languages,
} from 'lucide-react'
import type { AIComposeMode } from '@/api/schemas/ai'
import { cn } from '@/lib/cn'

type Props = {
  /** Position relative to viewport: top-left of the toolbar */
  position: { x: number; y: number } | null
  onPick: (mode: AIComposeMode) => void
  className?: string
}

const QUICK_OPS: { mode: AIComposeMode; label: string; icon: typeof Wand2 }[] =
  [
    { mode: 'polish', label: '润色', icon: Wand2 },
    { mode: 'shorten', label: '精简', icon: Scissors },
    { mode: 'expand', label: '扩写', icon: Maximize2 },
    { mode: 'tone', label: '语气', icon: MessageSquare },
    { mode: 'translate', label: '翻译', icon: Languages },
  ]

/**
 * 选区 ≥ 4 字时由 WritePage 计算 position 后渲染。5 个图标按钮触发对应 mode；
 * 选不动 / 离焦 → position=null → 卸载，下次有新选区再挂回。
 */
export function FloatingToolbar({ position, onPick, className }: Props) {
  if (!position) return null
  return (
    <div
      role="toolbar"
      aria-label="AI 快捷操作"
      style={{ left: position.x, top: position.y }}
      className={cn(
        'fixed z-50 inline-flex h-9 items-center gap-0.5 rounded-md border border-border bg-bg px-1 shadow-card',
        className,
      )}
    >
      {QUICK_OPS.map((op) => {
        const Icon = op.icon
        return (
          <button
            key={op.mode}
            type="button"
            aria-label={op.label}
            onMouseDown={(e) => {
              // mousedown 而非 click，避免选区在 click 前丢失
              e.preventDefault()
              onPick(op.mode)
            }}
            className="inline-flex size-7 items-center justify-center rounded-sm text-text transition hover:bg-bg-subtle"
          >
            <Icon size={14} aria-hidden />
          </button>
        )
      })}
    </div>
  )
}
