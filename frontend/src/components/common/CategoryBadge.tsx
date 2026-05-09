import type { CSSProperties } from 'react'
import { cn } from '@/lib/cn'
import { getCategory, type CategoryId } from '@/lib/categories'

type Variant = 'dot' | 'chip' | 'icon-chip' | 'full'

type Props = {
  categoryId: CategoryId
  variant?: Variant
  className?: string
}

/**
 * CategoryBadge — 7 类分类徽章，提供 4 种 variant：
 * - dot: 圆点 + label，列表行级使用
 * - chip: 12% tint 背景 + 文字色，最常用
 * - icon-chip: chip + lucide 图标
 * - full: 图标 + label + desc，megamenu / 选择面板使用
 */
export function CategoryBadge({
  categoryId,
  variant = 'chip',
  className,
}: Props) {
  const c = getCategory(categoryId)
  const Icon = c.icon

  const colorStyle: CSSProperties = { color: `var(${c.colorVar})` }
  const bgStyle: CSSProperties = { backgroundColor: `var(${c.tagBgVar})` }

  if (variant === 'dot') {
    return (
      <span
        aria-label={c.label}
        data-cat={c.id}
        className={cn(
          'inline-flex items-center gap-1.5 text-sm text-text-muted',
          className,
        )}
      >
        <span
          aria-hidden
          className="inline-block size-2 rounded-full"
          style={{ backgroundColor: `var(${c.colorVar})` }}
        />
        <span>{c.label}</span>
      </span>
    )
  }

  if (variant === 'chip') {
    return (
      <span
        data-cat={c.id}
        className={cn(
          'inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium',
          className,
        )}
        style={{ ...colorStyle, ...bgStyle }}
      >
        {c.label}
      </span>
    )
  }

  if (variant === 'icon-chip') {
    return (
      <span
        data-cat={c.id}
        className={cn(
          'inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium',
          className,
        )}
        style={{ ...colorStyle, ...bgStyle }}
      >
        <Icon size={12} strokeWidth={1.75} aria-hidden />
        {c.label}
      </span>
    )
  }

  // full
  return (
    <div
      data-cat={c.id}
      className={cn('flex flex-col gap-1', className)}
    >
      <span
        className="inline-flex items-center gap-1.5 font-medium"
        style={colorStyle}
      >
        <Icon size={16} strokeWidth={1.75} aria-hidden />
        {c.label}
      </span>
      <span className="text-xs text-text-muted">{c.desc}</span>
    </div>
  )
}
