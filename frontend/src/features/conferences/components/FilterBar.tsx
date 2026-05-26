import type { ReactNode } from 'react'
import { CalendarDays, List, Search } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  PUBLISHERS_TOP,
  STATUSES,
  TIERS,
  type ConfStatus,
  type ConfView,
  type FilterState,
  type Tier,
} from '../types'

interface FilterBarProps {
  filters: FilterState
  setFilters: (f: FilterState) => void
  total: number
  shown: number
  view: ConfView
  setView: (v: ConfView) => void
}

const INACTIVE_CHIP =
  'border-border bg-bg text-text-muted hover:border-border-strong hover:text-text'

const TIER_ACTIVE: Record<Tier, string> = {
  A: 'border-text bg-text text-white',
  B: 'border-[#6B6862] bg-[#6B6862] text-white',
  C: 'border-text-muted bg-text-muted text-white',
}

const STATUS_ACTIVE: Record<ConfStatus, string> = {
  soon: 'border-cat-course bg-cat-course text-white',
  open: 'border-cat-tools bg-cat-tools text-white',
  closed: 'border-cat-research bg-cat-research text-white',
  tbd: 'border-text-muted bg-text-muted text-white',
}

function Chip({
  on,
  activeCls,
  onClick,
  children,
}: {
  on: boolean
  activeCls: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[4px] border px-[9px] py-[3px] font-sans text-[12px] leading-[1.5] transition-colors',
        on ? activeCls : INACTIVE_CHIP,
      )}
    >
      {children}
    </button>
  )
}

function Toggle({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex select-none items-center gap-1.5 font-sans text-[12.5px] transition-colors',
        on ? 'text-text' : 'text-text-muted',
      )}
    >
      <span
        className={cn(
          'relative inline-block h-[14px] w-[26px] rounded-[8px] transition-colors',
          on ? 'bg-text' : 'bg-border-strong',
        )}
      >
        <span
          className={cn(
            'absolute left-px top-px h-3 w-3 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition-transform',
            on && 'translate-x-3',
          )}
        />
      </span>
      {children}
    </button>
  )
}

const labelCls =
  'flex-none w-[60px] font-sans text-[11.5px] font-semibold uppercase tracking-[0.06em] text-text-faint'
const rowCls = 'flex flex-wrap items-center gap-2.5'
const chipsCls = 'flex min-w-0 flex-1 flex-wrap gap-1'

export function FilterBar({ filters, setFilters, total, shown, view, setView }: FilterBarProps) {
  function toggleArr<K extends 'tier' | 'status' | 'pub'>(key: K, v: FilterState[K][number]) {
    const cur = filters[key] as FilterState[K][number][]
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]
    setFilters({ ...filters, [key]: next })
  }

  return (
    <div className="mb-3 flex flex-col gap-2 rounded-lg bg-bg-subtle px-3.5 py-3">
      <div className={rowCls}>
        <span className={labelCls}>CCF 级别</span>
        <div className={chipsCls}>
          {TIERS.map((t) => (
            <Chip
              key={t}
              on={filters.tier.includes(t)}
              activeCls={TIER_ACTIVE[t]}
              onClick={() => toggleArr('tier', t)}
            >
              CCF-{t}
            </Chip>
          ))}
        </div>
      </div>

      <div className={rowCls}>
        <span className={labelCls}>截稿状态</span>
        <div className={chipsCls}>
          {STATUSES.map((s) => (
            <Chip
              key={s.v}
              on={filters.status.includes(s.v)}
              activeCls={STATUS_ACTIVE[s.v]}
              onClick={() => toggleArr('status', s.v)}
            >
              <span className="h-[7px] w-[7px] rounded-full bg-current opacity-70" />
              {s.label}
              <span className="font-mono text-[10px] opacity-70">{s.sub}</span>
            </Chip>
          ))}
        </div>
      </div>

      <div className={rowCls}>
        <span className={labelCls}>出版方</span>
        <div className={chipsCls}>
          {PUBLISHERS_TOP.map((p) => (
            <Chip
              key={p}
              on={filters.pub.includes(p)}
              activeCls="border-text bg-text text-white"
              onClick={() => toggleArr('pub', p)}
            >
              {p}
            </Chip>
          ))}
        </div>
      </div>

      <div className={rowCls}>
        <div className="relative max-w-[360px] flex-1">
          <Search
            size={13}
            strokeWidth={1.8}
            aria-hidden
            className="pointer-events-none absolute left-[9px] top-1/2 -translate-y-1/2 text-text-faint"
          />
          <input
            type="search"
            placeholder="搜索简称 / 全称 / 出版方 / 地点…"
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            className="w-full rounded-md border border-border bg-bg py-1.5 pl-[30px] pr-2.5 font-sans text-[13px] text-text outline-none transition-colors focus:border-text"
          />
        </div>
        <Toggle
          on={filters.aOnly}
          onClick={() => setFilters({ ...filters, aOnly: !filters.aOnly })}
        >
          仅 A 类
        </Toggle>
        <Toggle
          on={filters.upcoming}
          onClick={() => setFilters({ ...filters, upcoming: !filters.upcoming })}
        >
          有未来截稿
        </Toggle>

        <div className="ml-2 inline-flex overflow-hidden rounded-md border border-border bg-bg">
          <ViewBtn on={view === 'table'} onClick={() => setView('table')} border>
            <List size={13} strokeWidth={1.8} aria-hidden /> 表格
          </ViewBtn>
          <ViewBtn on={view === 'timeline'} onClick={() => setView('timeline')}>
            <CalendarDays size={13} strokeWidth={1.8} aria-hidden /> 时间线
          </ViewBtn>
        </div>

        <span className="ml-auto whitespace-nowrap font-mono text-[11.5px] text-text-faint">
          显示 {shown} / {total}
        </span>
      </div>
    </div>
  )
}

function ViewBtn({
  on,
  onClick,
  border,
  children,
}: {
  on: boolean
  onClick: () => void
  border?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-[5px] font-sans text-[12.5px] font-medium transition-colors',
        border && 'border-r border-border',
        on ? 'bg-text text-white' : 'text-text-muted hover:bg-bg-subtle hover:text-text',
      )}
    >
      {children}
    </button>
  )
}
