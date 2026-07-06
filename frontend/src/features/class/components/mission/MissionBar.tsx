import { useState } from 'react'
import { Settings2, Target } from 'lucide-react'

import type { Mission } from '@/api/schemas/class'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { MissionManageDialog } from './MissionManageDialog'

type Props = {
  missions: Mission[] | undefined
  isCommittee: boolean
}

/**
 * 分组任务层（layer 1）—— /class 概览页顶部的横幅。
 * 展示进行中的分组任务；班委可「管理任务」（新建 / 设为进行中 / 改名 / 删除）。
 */
export function MissionBar({ missions, isCommittee }: Props) {
  const [manageOpen, setManageOpen] = useState(false)
  const active = missions?.find((m) => m.isActive) ?? null

  return (
    <section
      aria-label="当前分组任务"
      className="mb-6 rounded-xl border border-border bg-bg-subtle p-4"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 grid size-9 shrink-0 place-content-center rounded-lg bg-cat-tools/10 text-cat-tools">
          <Target size={18} strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          {active ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-text-faint">
                  当前分组任务
                </span>
                <Badge variant="secondary" className="text-[10px]">
                  进行中
                </Badge>
              </div>
              <h2 className="m-0 mt-1 font-serif text-lg font-semibold text-text">
                {active.title}
              </h2>
              {active.description && (
                <p className="m-0 mt-1 whitespace-pre-wrap text-sm text-text-muted">
                  {active.description}
                </p>
              )}
            </>
          ) : (
            <>
              <h2 className="m-0 text-sm font-semibold text-text">暂无进行中的分组任务</h2>
              <p className="m-0 mt-0.5 text-sm text-text-muted">
                {isCommittee
                  ? '设置一个正在进行的分组任务，作为本次分组的顶层。'
                  : '学委还没有发布分组任务，可先浏览下方各组概览。'}
              </p>
            </>
          )}
        </div>
        {isCommittee && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setManageOpen(true)}
          >
            <Settings2 size={15} aria-hidden className="mr-1.5" />
            {active ? '管理任务' : '设置任务'}
          </Button>
        )}
      </div>

      {isCommittee && (
        <MissionManageDialog
          open={manageOpen}
          onOpenChange={setManageOpen}
          missions={missions ?? []}
        />
      )}
    </section>
  )
}
