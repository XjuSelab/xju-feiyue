import type { ReactNode } from 'react'
import { Inbox, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

type Props = {
  icon?: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
  children?: ReactNode
}

/**
 * EmptyState — 空状态占位，居中、aria-live polite。
 * - icon 默认为 lucide Inbox
 * - 可选 action 按钮（primary）
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  children,
}: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      <Icon
        aria-hidden
        className="text-text-faint"
        size={36}
        strokeWidth={1.5}
      />
      <div className="space-y-1">
        <h3 className="text-base font-medium text-text">{title}</h3>
        {description ? (
          <p className="text-sm text-text-muted">{description}</p>
        ) : null}
      </div>
      {action ? (
        <Button onClick={action.onClick} size="sm">
          {action.label}
        </Button>
      ) : null}
      {children}
    </div>
  )
}
