import { useMemo } from 'react'

import type { GroupTask } from '@/api/schemas/class'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { resolveAssetUrl } from '@/api/client'
import { cn } from '@/lib/cn'

import { GANTT_DAY_WIDTH } from '../../data'
import { barGeometry, computeWindow, dayCells, monthSpans } from '../../lib/gantt'
import { GanttTaskBar } from './GanttTaskBar'

type Props = {
  tasks: GroupTask[]
  canEdit: boolean
  onBarClick: (task: GroupTask) => void
  onMoveTask: (task: GroupTask, deltaDays: number) => void
}

const ROW_H = 36 // px，任务行高

/**
 * 手写甘特图（无图表依赖，风格对齐 admin/charts.tsx 的低依赖路线）：
 * 左列冻结任务名 + 负责人头像栈；右侧横向滚动时间轴 —— 月/日双表头、
 * 周末底色、今日竖线、状态色任务条（进度填充 + 拖移）。
 */
export function GanttChart({ tasks, canEdit, onBarClick, onMoveTask }: Props) {
  const win = useMemo(() => computeWindow(tasks), [tasks])
  const cells = useMemo(() => dayCells(win), [win])
  const months = useMemo(() => monthSpans(win), [win])
  const todayIndex = cells.findIndex((c) => c.isToday)

  const timelineWidth = win.days * GANTT_DAY_WIDTH
  const bodyHeight = tasks.length * ROW_H

  return (
    // TooltipProvider 一次包住所有任务条的 Tooltip（radix 要求；provider 每图一个即可）。
    <TooltipProvider delayDuration={150}>
      <div className="flex overflow-hidden rounded-lg border border-border">
        {/* 左列：任务名（冻结） */}
        <div className="w-48 shrink-0 border-r border-border bg-bg sm:w-56">
          {/* 与右侧双表头等高的占位 */}
          <div className="flex h-[52px] items-end border-b border-border px-3 pb-1.5 text-xs text-text-faint">
            任务
          </div>
          {tasks.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-2 border-b border-border/60 px-3 last:border-b-0"
              style={{ height: ROW_H }}
            >
              <span className="min-w-0 flex-1 truncate text-sm text-text">{t.title}</span>
              <span className="flex shrink-0 -space-x-1.5">
                {t.assignees.slice(0, 3).map((a) => (
                  <Avatar key={a.sid} className="size-5 border border-bg">
                    {a.avatarThumb && <AvatarImage src={resolveAssetUrl(a.avatarThumb)} alt="" />}
                    <AvatarFallback className="text-[8px]">{a.nickname.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                ))}
              </span>
            </div>
          ))}
        </div>

        {/* 右侧：时间轴（横向滚动） */}
        <div className="min-w-0 flex-1 overflow-x-auto bg-bg">
          <div style={{ width: timelineWidth }}>
            {/* 月表头 */}
            <div className="flex h-6 border-b border-border/60">
              {months.map((m) => (
                <div
                  key={`${m.label}-${m.startIndex}`}
                  className="shrink-0 truncate border-r border-border/40 px-2 pt-1 text-xs text-text-muted last:border-r-0"
                  style={{ width: m.span * GANTT_DAY_WIDTH }}
                >
                  {m.label}
                </div>
              ))}
            </div>
            {/* 日表头 */}
            <div className="flex h-[26px] border-b border-border">
              {cells.map((c) => (
                <div
                  key={c.date}
                  className={cn(
                    'grid shrink-0 place-content-center text-[10px] tabular-nums',
                    c.isWeekend ? 'bg-bg-subtle text-text-faint' : 'text-text-muted',
                    c.isToday && 'font-bold text-cat-research',
                  )}
                  style={{ width: GANTT_DAY_WIDTH }}
                >
                  {c.dayOfMonth}
                </div>
              ))}
            </div>

            {/* 主体：周末底色 + 今日线 + 任务行 */}
            <div className="relative" style={{ height: bodyHeight, width: timelineWidth }}>
              {cells.map(
                (c, i) =>
                  c.isWeekend && (
                    <div
                      key={c.date}
                      aria-hidden
                      className="absolute inset-y-0 bg-bg-subtle/70"
                      style={{ left: i * GANTT_DAY_WIDTH, width: GANTT_DAY_WIDTH }}
                    />
                  ),
              )}
              {todayIndex >= 0 && (
                <div
                  aria-hidden
                  className="absolute inset-y-0 z-[5] w-px bg-cat-research/60"
                  style={{ left: (todayIndex + 0.5) * GANTT_DAY_WIDTH }}
                />
              )}
              {tasks.map((t, row) => {
                const geo = barGeometry(t, win)
                return (
                  <div
                    key={t.id}
                    className="absolute inset-x-0 border-b border-border/40 last:border-b-0"
                    style={{ top: row * ROW_H, height: ROW_H }}
                  >
                    {geo && (
                      <GanttTaskBar
                        task={t}
                        geometry={geo}
                        canEdit={canEdit}
                        onClick={() => onBarClick(t)}
                        onMove={(delta) => onMoveTask(t, delta)}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
