import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

type Props = {
  title?: string
  message: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
}

/**
 * ErrorState — 加载/操作失败的占位组件。
 * - 居中 AlertCircle 图标 + 标题 + 详情 + 可选 Retry 按钮
 * - role=alert 立刻播报到屏幕阅读器
 */
export function ErrorState({
  title = '出错了',
  message,
  onRetry,
  retryLabel = '重试',
  className,
}: Props) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      <AlertCircle
        aria-hidden
        className="text-cat-research"
        size={36}
        strokeWidth={1.75}
      />
      <div className="space-y-1">
        <h3 className="text-base font-medium text-text">{title}</h3>
        <p className="text-sm text-text-muted">{message}</p>
      </div>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  )
}
