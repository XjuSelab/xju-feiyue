import { cn } from '@/lib/cn'
import { classify, fmtDeadlineWord, progressForBar } from '../../classify'
import type { Conference } from '../../types'

type Live = 'soon' | 'open' | 'closed'

const BADGE: Record<Live, string> = {
  soon: 'bg-tag-course text-cat-course',
  open: 'bg-tag-tools text-cat-tools',
  closed: 'bg-bg-subtle text-text-faint',
}
const BAR: Record<Live, string> = {
  soon: 'bg-cat-course',
  open: 'bg-cat-tools',
  closed: 'bg-border-strong',
}

/** 截稿日期——本页主角：日期 + 状态徽章 + 备注 + 进度条。 */
export function DeadlineCell({ conf }: { conf: Conference }) {
  const status = classify(conf)
  if (status === 'tbd') {
    return <span className="font-sans text-[12px] italic text-text-faint">— 待公布</span>
  }
  const key = status as Live
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[12.5px] font-medium text-text">{conf.deadline}</span>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-[3px] px-[7px] py-px font-sans text-[11px] font-medium leading-[1.6]',
            BADGE[key],
          )}
        >
          <span className="h-[5px] w-[5px] rounded-full bg-current" />
          {fmtDeadlineWord(conf.deadline)}
        </span>
      </div>
      {conf.note && (
        <div className="font-mono text-[10.5px] leading-[1.5] text-text-faint">{conf.note}</div>
      )}
      <div className="mt-0.5 h-[3px] w-[140px] overflow-hidden rounded-[2px] bg-border">
        <div
          className={cn('h-full rounded-[2px] transition-[width]', BAR[key])}
          style={{ width: `${progressForBar(conf.deadline)}%` }}
        />
      </div>
    </div>
  )
}
