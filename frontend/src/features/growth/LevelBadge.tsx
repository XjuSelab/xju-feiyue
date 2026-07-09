import { cn } from '@/lib/cn'

// Lv0..Lv5 tier colors (thresholds 0/50/150/300/600/1000, see FR-20).
const TIER_COLORS = ['#94a3b8', '#60a5fa', '#34d399', '#fbbf24', '#fb923c', '#f472b6']

type Props = {
  level: number
  className?: string
}

/** Small pill badge showing the user's level, colored by tier. */
export function LevelBadge({ level, className }: Props) {
  const idx = Math.min(Math.max(level, 0), TIER_COLORS.length - 1)
  const color = TIER_COLORS[idx] ?? TIER_COLORS[0]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold text-white',
        className,
      )}
      style={{ backgroundColor: color }}
      title={`等级 Lv${level}`}
    >
      Lv{level}
    </span>
  )
}
