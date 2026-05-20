import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type ChipTone = 'pos' | 'neg' | 'neu' | 'unk' | undefined

interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  on?: boolean
  tone?: ChipTone
  dot?: string
  children: ReactNode
}

const toneActive: Record<NonNullable<ChipTone>, string> = {
  pos: 'bg-cat-tools border-cat-tools text-white',
  neg: 'bg-cat-research border-cat-research text-white',
  neu: 'bg-text-muted border-text-muted text-white',
  unk: 'bg-text-muted border-text-muted text-white',
}

export function Chip({ on, tone, dot, className, children, ...rest }: ChipProps) {
  const activeCls = on
    ? tone
      ? toneActive[tone]
      : 'bg-text border-text text-white'
    : 'bg-bg border-border text-text-muted hover:text-text hover:border-border-strong'

  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[4px] border px-[9px] py-[3px] font-sans text-[12px] leading-[1.5] transition-colors',
        activeCls,
        className,
      )}
      {...rest}
    >
      {dot ? (
        <span className="h-[7px] w-[7px] rounded-full opacity-70" style={{ background: dot }} />
      ) : null}
      {children}
    </button>
  )
}
