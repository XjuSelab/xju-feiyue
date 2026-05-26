import { cn } from '@/lib/cn'
import type { Tier } from '../../types'

const TIER_CLS: Record<Tier, string> = {
  A: 'bg-text text-white',
  B: 'border border-border-strong bg-bg-hover text-text',
  C: 'bg-bg-subtle text-text-muted',
}

/** CCF 级别徽章——页面最显眼的视觉锚点。 */
export function TierBadge({ tier }: { tier: Tier }) {
  return (
    <span
      className={cn(
        'inline-flex min-w-[44px] items-center justify-center rounded-[4px] px-3 py-1 font-serif text-[14px] font-bold leading-[1.3] tracking-[0.02em]',
        TIER_CLS[tier],
      )}
    >
      <span className="mr-0.5 align-[1px] font-sans text-[10px] font-medium opacity-60">CCF-</span>
      {tier}
    </span>
  )
}
