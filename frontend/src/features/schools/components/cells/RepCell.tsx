import type { Reputation } from '../../types'
import { cn } from '@/lib/cn'
import { REP_LABEL } from './rep-meta'

const REP_CLASS: Record<Reputation, string> = {
  positive: 'bg-tag-tools text-cat-tools',
  neutral: 'bg-bg-subtle text-text-muted',
  negative: 'bg-cat-research text-white shadow-[0_0_0_1px_rgba(224,62,62,0.25)]',
  unknown: 'bg-bg-subtle text-text-faint',
}

interface RepCellProps {
  tag: Reputation | null
}

export function RepCell({ tag }: RepCellProps) {
  const t = tag || 'unknown'
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-[5px] rounded-[4px] px-2 py-px font-sans text-[11.5px] font-medium leading-[1.7]',
        REP_CLASS[t],
      )}
    >
      <span
        className={cn(
          'h-[6px] w-[6px] rounded-full bg-current opacity-85',
          t === 'negative' && 'opacity-100',
        )}
      />
      {REP_LABEL[t]}
    </span>
  )
}
