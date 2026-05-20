import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface ToggleProps {
  on: boolean
  onClick: () => void
  children: ReactNode
}

export function Toggle({ on, onClick, children }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex select-none items-center gap-1.5 font-sans text-[12.5px] transition-colors',
        on ? 'text-text' : 'text-text-muted',
      )}
    >
      <span
        className={cn(
          'relative inline-block h-[14px] w-[26px] rounded-[8px] transition-colors',
          on ? 'bg-text' : 'bg-border-strong',
        )}
      >
        <span
          className={cn(
            'absolute left-px top-px h-3 w-3 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition-transform',
            on && 'translate-x-3',
          )}
        />
      </span>
      {children}
    </button>
  )
}
