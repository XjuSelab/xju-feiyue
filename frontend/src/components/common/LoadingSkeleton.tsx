import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/cn'

type Preset = 'list' | 'card' | 'paragraph'

type Props = {
  /** 预设形态：列表行 / 卡片 / 段落 */
  preset?: Preset
  /** 重复次数 */
  count?: number
  className?: string
}

/**
 * LoadingSkeleton — 在 shadcn skeleton 之上提供 3 种业务预设。
 * - list:      笔记列表 row（标题 + 副标题）
 * - card:      封面卡片（图占位 + 两行）
 * - paragraph: prose 段落（4 行错落短）
 */
export function LoadingSkeleton({
  preset = 'list',
  count = 3,
  className,
}: Props) {
  const items = Array.from({ length: count }, (_, i) => i)
  return (
    <div
      role="status"
      aria-label="加载中"
      aria-live="polite"
      className={cn('space-y-3', className)}
    >
      {items.map((i) =>
        preset === 'card' ? (
          <CardSkeleton key={i} />
        ) : preset === 'paragraph' ? (
          <ParagraphSkeleton key={i} />
        ) : (
          <ListSkeleton key={i} />
        ),
      )}
    </div>
  )
}

function ListSkeleton() {
  return (
    <div className="flex items-center gap-3 py-2">
      <Skeleton className="size-8 rounded-md" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <Skeleton className="h-32 w-full rounded-md" />
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  )
}

function ParagraphSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-3 w-11/12" />
      <Skeleton className="h-3 w-10/12" />
      <Skeleton className="h-3 w-9/12" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  )
}
