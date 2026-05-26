import { MapPin } from 'lucide-react'
import type { Conference } from '../../types'

/** 地点 · 日期：地点 + 周期 pill 叠会期日期；都缺时显示待公布。 */
export function WhereCell({ conf }: { conf: Conference }) {
  if (!conf.location && !conf.conf_date) {
    return <span className="font-sans text-[12px] italic text-text-faint">— 待公布</span>
  }
  return (
    <div className="flex flex-col gap-0.5 font-sans text-[12.5px]">
      <span className="inline-flex items-center gap-1 font-medium text-text">
        <MapPin size={11} strokeWidth={1.8} className="flex-none" aria-hidden />
        {conf.location || '待公布'}
        {conf.cycle && (
          <span className="ml-[5px] inline-block rounded-[3px] bg-bg-subtle px-[5px] align-[1px] font-mono text-[10px] text-text-faint">
            {conf.cycle}
          </span>
        )}
      </span>
      <span className="font-mono text-[11.5px] text-text-muted">{conf.conf_date || '—'}</span>
    </div>
  )
}
