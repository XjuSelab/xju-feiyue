import { MapPin } from 'lucide-react'
import { cn } from '@/lib/cn'
import { classify, daysUntil } from '../classify'
import type { Conference } from '../types'
import { TierBadge } from './cells/TierBadge'
import { FieldChip } from './cells/FieldChip'
import { LinksCell } from './cells/LinksCell'

const WK_CN = ['日', '一', '二', '三', '四', '五', '六']
const MONTH_CN = [
  '一月',
  '二月',
  '三月',
  '四月',
  '五月',
  '六月',
  '七月',
  '八月',
  '九月',
  '十月',
  '十一月',
  '十二月',
]

interface Dated {
  conf: Conference
  d: Date
}

function relWord(conf: Conference): string {
  const status = classify(conf)
  const d = daysUntil(conf.deadline) ?? 0
  if (status === 'closed') return `已截止 ${-d} 天`
  if (status === 'soon') return `仅剩 ${d} 天`
  return `${d} 天后`
}

export function TimelineView({ rows }: { rows: Conference[] }) {
  const withDl: Dated[] = rows
    .filter((r) => !!r.deadline)
    .map((r) => ({ conf: r, d: new Date(`${r.deadline}T23:59:59`) }))
  withDl.sort((a, b) => a.d.getTime() - b.d.getTime())

  const groups = new Map<string, Dated[]>()
  for (const it of withDl) {
    const key = `${it.d.getFullYear()}-${String(it.d.getMonth()).padStart(2, '0')}`
    const bucket = groups.get(key)
    if (bucket) bucket.push(it)
    else groups.set(key, [it])
  }
  const keys = [...groups.keys()].sort()

  if (keys.length === 0) {
    return (
      <div className="overflow-hidden rounded-lg border border-border bg-bg">
        <div className="px-5 py-16 text-center font-sans text-[14px] text-text-faint">
          <div className="mb-1.5 font-serif text-[18px] font-semibold text-text-muted">
            当前筛选下没有可用截稿数据
          </div>
          <div>切换"截稿状态"或清空搜索,试试看其他周期</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 pt-1">
      {keys.map((k) => {
        const items = groups.get(k) as Dated[]
        const [yearStr, monthStr] = k.split('-')
        return (
          <div key={k} className="grid grid-cols-[130px_1fr] items-start gap-[18px]">
            <div className="sticky top-16 pt-1 font-serif text-[22px] font-semibold leading-[1.2] tracking-[-0.01em] text-text">
              {MONTH_CN[Number(monthStr)]}
              <span className="mt-1 block font-mono text-[11.5px] font-medium tracking-[0.04em] text-text-faint">
                {yearStr}
              </span>
              <span className="mt-2 block font-mono text-[11px] text-text-faint">
                {items.length} 项截稿
              </span>
            </div>
            <div className="relative flex flex-col border-l border-border pl-[18px]">
              {items.map(({ conf: c, d: dd }) => {
                const status = classify(c)
                return (
                  <div
                    key={c.id}
                    data-status={status}
                    className="conf-tl-item relative grid grid-cols-[56px_1fr_auto] items-baseline gap-3.5 border-b border-border py-2.5 last:border-b-0"
                  >
                    <div className="font-mono text-[13px] font-medium text-text-muted">
                      {String(dd.getDate()).padStart(2, '0')}
                      <span className="mt-px block text-[10.5px] uppercase tracking-[0.06em] text-text-faint">
                        周{WK_CN[dd.getDay()]}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-serif text-[16px] font-semibold tracking-[-0.005em] text-text">
                          {c.abbr}
                        </span>
                        <TierBadge tier={c.tier} />
                        <FieldChip field={c.field} />
                        <span
                          className={cn(
                            'font-mono text-[11px]',
                            status === 'soon' ? 'text-cat-course' : 'text-text-faint',
                          )}
                        >
                          {relWord(c)}
                        </span>
                      </div>
                      <div className="mt-1 font-sans text-[12px] text-text-muted">
                        {c.name_full}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-3 font-sans text-[12px] text-text-muted">
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={11} strokeWidth={1.8} aria-hidden />{' '}
                          {c.location || '待公布'}
                        </span>
                        <span className="text-border-strong">·</span>
                        <span className="font-mono text-[11.5px]">
                          {c.conf_date || '日期待公布'}
                        </span>
                        {c.note && (
                          <>
                            <span className="text-border-strong">·</span>
                            <span>{c.note}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <LinksCell conf={c} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
