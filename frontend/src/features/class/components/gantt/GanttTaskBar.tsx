import { useRef, useState } from 'react'

import type { GroupTask } from '@/api/schemas/class'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/cn'

import { GANTT_DAY_WIDTH, STATUS_META } from '../../data'
import { snapDays, type BarGeometry } from '../../lib/gantt'

type Props = {
  task: GroupTask
  geometry: BarGeometry
  canEdit: boolean
  /** 点击（<5px 位移的 pointerup）→ 打开编辑对话框。 */
  onClick: () => void
  /** 拖移吸附后的整条平移天数（非 0 才回调）。 */
  onMove: (deltaDays: number) => void
}

/** 拖拽 vs 点击的位移阈值（px）。 */
const CLICK_THRESHOLD_PX = 5

/**
 * 甘特任务条 —— 状态配色 + 进度填充；pointer capture 整条拖移（day 吸附，
 * live transform 预览，pointerup 提交）。<5px 位移视为点击（编辑）。
 * `touch-action: none` 防触屏滚动抢事件。只读（非组员）时仅点击查看。
 */
export function GanttTaskBar({ task, geometry, canEdit, onClick, onMove }: Props) {
  const [dragPx, setDragPx] = useState<number | null>(null)
  const startX = useRef(0)
  const moved = useRef(false)

  const meta = STATUS_META[task.status]
  const snapped = dragPx == null ? 0 : snapDays(dragPx, GANTT_DAY_WIDTH)

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!canEdit) return
    // 只响应主键 / 触控笔。
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    startX.current = e.clientX
    moved.current = false
    setDragPx(0)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (dragPx == null) return
    const dx = e.clientX - startX.current
    if (Math.abs(dx) >= CLICK_THRESHOLD_PX) moved.current = true
    setDragPx(dx)
  }
  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (dragPx == null) {
      // 只读模式：无 capture，click 走 onClickPlain。
      return
    }
    e.currentTarget.releasePointerCapture(e.pointerId)
    const dx = e.clientX - startX.current
    setDragPx(null)
    if (!moved.current || Math.abs(dx) < CLICK_THRESHOLD_PX) {
      onClick()
      return
    }
    const delta = snapDays(dx, GANTT_DAY_WIDTH)
    if (delta !== 0) onMove(delta)
  }

  const label =
    geometry.span >= 3 ? task.title : geometry.span >= 2 ? task.title.slice(0, 4) : ''

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-testid={`gantt-bar-${task.id}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onClick={() => {
            // 只读态没有 pointer capture 流程，click 直接查看。
            if (!canEdit) onClick()
          }}
          className={cn(
            'absolute top-1.5 h-6 overflow-hidden rounded-md border text-left text-[11px] leading-none shadow-sm transition-shadow',
            meta.barClass,
            canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
            dragPx != null && 'z-10 shadow-md',
          )}
          style={{
            left: geometry.offset * GANTT_DAY_WIDTH + 1,
            width: geometry.span * GANTT_DAY_WIDTH - 2,
            transform: snapped !== 0 ? `translateX(${snapped * GANTT_DAY_WIDTH}px)` : undefined,
            touchAction: 'none',
            borderLeftStyle: geometry.clippedStart ? 'dashed' : undefined,
            borderRightStyle: geometry.clippedEnd ? 'dashed' : undefined,
          }}
          aria-label={`任务 ${task.title}`}
        >
          {/* 进度填充 */}
          <span
            aria-hidden
            className={cn('absolute inset-y-0 left-0', meta.fillClass)}
            style={{ width: `${task.progress}%` }}
          />
          {label && (
            <span className="relative z-[1] block truncate px-1.5 pt-[7px]">{label}</span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <div className="flex flex-col gap-0.5 text-xs">
          <span className="font-medium">{task.title}</span>
          <span>
            {task.startDate} ~ {task.endDate} · {STATUS_META[task.status].label} ·{' '}
            {task.progress}%
          </span>
          {task.assignees.length > 0 && (
            <span>负责：{task.assignees.map((a) => a.nickname).join('、')}</span>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
