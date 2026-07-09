import { useState } from 'react'
import { toast } from 'sonner'
import { ApiError, reasonLabel, useReports, useResolveReport, type Report } from '@/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

const STATUS_LABEL: Record<string, string> = {
  pending: '待处理',
  ai_flagged: 'AI 标记',
  resolved: '已处理',
  dismissed: '已驳回',
}

type Action = 'hide' | 'delete' | 'dismiss'

export function ReportsTab() {
  const [showResolved, setShowResolved] = useState(false)
  const q = useReports()
  const resolveMut = useResolveReport()
  const all = q.data ?? []
  const open = all.filter((r) => r.status === 'pending' || r.status === 'ai_flagged')
  const closed = all.filter((r) => r.status === 'resolved' || r.status === 'dismissed')
  const rows = showResolved ? all : open

  const resolve = (r: Report, action: Action) => {
    resolveMut.mutate(
      { id: r.id, body: { action } },
      {
        onSuccess: () =>
          toast.success(
            action === 'delete' ? '已删除内容' : action === 'hide' ? '已下架内容' : '已驳回举报',
          ),
        onError: (e) => toast.error(e instanceof ApiError ? e.message : '操作失败'),
      },
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-text-muted">
          待处理 {open.length} · 已处理 {closed.length}
        </p>
        <label className="flex items-center gap-2 text-xs text-text-muted">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
          />
          显示已处理
        </label>
      </div>

      {q.isLoading && <p className="text-sm text-text-muted">加载工单…</p>}
      {!q.isLoading && rows.length === 0 && (
        <p className="text-sm text-text-faint">没有需要处理的举报。</p>
      )}

      <ul className="space-y-3">
        {rows.map((r) => (
          <ReportCard key={r.id} r={r} onResolve={resolve} pending={resolveMut.isPending} />
        ))}
      </ul>
    </div>
  )
}

function ReportCard({
  r,
  onResolve,
  pending,
}: {
  r: Report
  onResolve: (r: Report, a: Action) => void
  pending: boolean
}) {
  const isOpen = r.status === 'pending' || r.status === 'ai_flagged'
  return (
    <li className="rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className={cn(
            'rounded-full px-2 py-0.5',
            r.status === 'ai_flagged'
              ? 'bg-amber-100 text-amber-700'
              : r.status === 'pending'
                ? 'bg-bg-subtle text-text-muted'
                : 'bg-bg-subtle text-text-faint',
          )}
        >
          {STATUS_LABEL[r.status] ?? r.status}
        </span>
        <span className="text-text-muted">
          {r.targetType === 'note' ? '笔记' : '评论'} · {reasonLabel(r.reason)}
        </span>
        <span className="ml-auto text-text-faint">
          {r.reporter?.nickname ?? r.reporter?.sid ?? '匿名'} 举报
        </span>
      </div>

      <p className="mt-2 line-clamp-3 whitespace-pre-wrap rounded bg-bg-subtle/50 p-2 text-sm text-text">
        {r.targetSnapshot || '（内容已删除）'}
      </p>
      {r.description && <p className="mt-1 text-xs text-text-muted">补充：{r.description}</p>}

      {r.aiLabel && r.aiLabel !== 'unknown' && (
        <p className="mt-2 text-xs text-text-faint">
          AI 预审：<span className="font-medium text-text-muted">{reasonLabel(r.aiLabel)}</span>
          {typeof r.aiConfidence === 'number' && <> · 置信 {Math.round(r.aiConfidence * 100)}%</>}
          {r.aiReason && <> · {r.aiReason}</>}
        </p>
      )}

      {isOpen ? (
        <div className="mt-3 flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onResolve(r, 'hide')}
            disabled={pending}
          >
            下架
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => onResolve(r, 'delete')}
            disabled={pending}
            className="bg-red-500 text-white hover:bg-red-600"
          >
            删除
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onResolve(r, 'dismiss')}
            disabled={pending}
          >
            驳回
          </Button>
        </div>
      ) : (
        <p className="mt-2 text-xs text-text-faint">
          已
          {r.resolutionAction === 'delete'
            ? '删除'
            : r.resolutionAction === 'hide'
              ? '下架'
              : '驳回'}
          {r.resolvedBySid ? ` · by ${r.resolvedBySid}` : ''}
        </p>
      )}
    </li>
  )
}
