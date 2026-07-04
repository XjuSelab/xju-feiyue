import { useState } from 'react'
import { ArrowLeft, CheckCheck } from 'lucide-react'

import { resolveAssetUrl } from '@/api/client'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/cn'

import { useCloseRollcall, useRollcall, useSetRollcallRecord } from '../../hooks/useRollcalls'

type Props = {
  id: string
  isCommittee: boolean
  onExit: () => void
}

/**
 * 点名勾选视图 —— 花名册 checkbox 网格 + 实时出勤计数。
 *
 * 每个勾选是一条独立 PUT（乐观翻转，hook 层防并发踩踏）；只禁用**自己
 * 在途**的那格 checkbox（in-flight sid 集合），其余可继续点。
 */
export function RollcallSession({ id, isCommittee, onExit }: Props) {
  const { data, isLoading, isError, refetch } = useRollcall(id)
  const setRecord = useSetRollcallRecord(id)
  const close = useCloseRollcall()
  const [inflight, setInflight] = useState<ReadonlySet<string>>(new Set())

  if (isLoading) return <LoadingSkeleton preset="paragraph" count={3} />
  if (isError || !data) {
    return <ErrorState title="点名加载失败" message="请稍后重试。" onRetry={() => void refetch()} />
  }

  const toggle = (sid: string, present: boolean) => {
    setInflight((prev) => new Set(prev).add(sid))
    setRecord.mutate(
      { sid, present },
      {
        onSettled: () =>
          setInflight((prev) => {
            const next = new Set(prev)
            next.delete(sid)
            return next
          }),
      },
    )
  }

  const closed = data.closedAt != null

  return (
    <section aria-label="点名中">
      <div className="sticky top-14 z-10 mb-4 flex flex-wrap items-center gap-3 border-b border-border bg-bg/95 py-3 backdrop-blur">
        <Button variant="ghost" size="sm" onClick={onExit}>
          <ArrowLeft size={15} aria-hidden className="mr-1" />
          返回
        </Button>
        <span className="text-sm font-medium text-text">
          {closed ? '编辑点名' : '点名中'}
          {data.title ? ` · ${data.title}` : ''}
        </span>
        <span className="text-sm tabular-nums text-text-muted" data-testid="rollcall-count">
          出勤 {data.presentCount}/{data.totalCount}
        </span>
        {isCommittee && !closed && (
          <Button
            size="sm"
            className="ml-auto"
            disabled={close.isPending}
            onClick={() => close.mutate({ id, closed: true }, { onSuccess: onExit })}
          >
            <CheckCheck size={15} aria-hidden className="mr-1" />
            完成点名
          </Button>
        )}
      </div>

      <ul className="grid list-none grid-cols-1 gap-1.5 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {data.records.map((r) => (
          <li key={r.sid}>
            <label
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2.5 transition',
                r.present ? 'bg-bg-subtle' : 'bg-bg hover:bg-bg-subtle/60',
                !isCommittee && 'cursor-default',
              )}
            >
              <Checkbox
                checked={r.present}
                disabled={!isCommittee || inflight.has(r.sid)}
                onCheckedChange={(v) => toggle(r.sid, v === true)}
                aria-label={`${r.nickname} 到点`}
              />
              <Avatar className="size-8">
                {r.avatarThumb && <AvatarImage src={resolveAssetUrl(r.avatarThumb)} alt="" />}
                <AvatarFallback className="text-xs">{r.nickname.slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-text">{r.nickname}</div>
                <div className="truncate text-xs text-text-faint">{r.sid}</div>
              </div>
            </label>
          </li>
        ))}
      </ul>
    </section>
  )
}
