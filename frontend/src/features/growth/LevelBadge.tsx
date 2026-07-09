import { cn } from '@/lib/cn'

/**
 * 等级徽标 —— 按 tier 着色（走系统 cat-* / tag-* token，非裸色，
 * 同 CommitteeBadge 的染色模式）。阈值 0/50/150/300/600/1000（FR-20），
 * 色阶冷→暖递进：Lv0 中性 → 蓝 → 绿松 → 橙 → 玫红 → 红。
 */
const TIER_CLASSES = [
  'border-border bg-bg-subtle text-text-muted',
  'border-cat-kaggle/30 bg-tag-kaggle text-cat-kaggle',
  'border-cat-tools/30 bg-tag-tools text-cat-tools',
  'border-cat-course/30 bg-tag-course text-cat-course',
  'border-cat-competition/30 bg-tag-competition text-cat-competition',
  'border-cat-research/30 bg-tag-research text-cat-research',
]

type Props = {
  level: number
  className?: string
}

/** Small pill badge showing the user's level, colored by tier. */
export function LevelBadge({ level, className }: Props) {
  const idx = Math.min(Math.max(level, 0), TIER_CLASSES.length - 1)
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold',
        TIER_CLASSES[idx],
        className,
      )}
      title={`等级 Lv${level}`}
    >
      Lv{level}
    </span>
  )
}
