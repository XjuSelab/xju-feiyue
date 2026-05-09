import { useState } from 'react'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'

export function StatesSection() {
  const [retryCount, setRetryCount] = useState(0)

  return (
    <section
      data-section="states"
      className="space-y-6 rounded-md border border-border p-5"
    >
      <h2 className="text-lg font-semibold">8 · Empty / Error / Loading</h2>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-md border border-border bg-bg-subtle">
          <EmptyState
            title="还没有笔记"
            description="点击下方按钮创建第一篇笔记。"
            action={{ label: '新建笔记', onClick: () => {} }}
          />
        </div>

        <div className="rounded-md border border-border bg-bg-subtle">
          <ErrorState
            title="加载失败"
            message={`网络抖动了 (retry=${retryCount})`}
            onRetry={() => setRetryCount((n) => n + 1)}
          />
        </div>

        <div className="space-y-4 rounded-md border border-border bg-bg-subtle p-4">
          <p className="text-xs text-text-muted">list preset</p>
          <LoadingSkeleton preset="list" count={2} />
          <p className="text-xs text-text-muted">paragraph preset</p>
          <LoadingSkeleton preset="paragraph" count={1} />
        </div>
      </div>
    </section>
  )
}
