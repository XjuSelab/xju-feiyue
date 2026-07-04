import { cn } from '@/lib/cn'
import { committeeTone } from '@/lib/committee'

/**
 * 班委职务徽标 —— 按职务着色（走系统 cat-* / tag-* token，非裸色）：
 * - 班长 / 团支书 → 红（cat-research #e03e3e + tag-research 12% 底）
 * - 其他职务（学习委员 / 体育委员 / …，含未命名的通用「班委」）
 *   → 橙（cat-course #d9730d + tag-course 12% 底）
 */

type Props = {
  /** 职务名称；空/未设置回退为通用「班委」。 */
  title?: string | null | undefined
  className?: string | undefined
}

export function CommitteeBadge({ title, className }: Props) {
  const label = title?.trim() || '班委'
  const tone = committeeTone(title)
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md border px-1.5 py-px text-[10px] font-medium leading-4',
        tone === 'red'
          ? 'border-cat-research/30 bg-tag-research text-cat-research'
          : 'border-cat-course/30 bg-tag-course text-cat-course',
        className,
      )}
    >
      {label}
    </span>
  )
}
