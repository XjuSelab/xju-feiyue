import { useMemo, useState } from 'react'
import { Info } from 'lucide-react'
import { CCF_CONFS } from './data'
import { applyFilters } from './filter'
import { applySort, smartSort } from './sort'
import {
  BLANK_FILTERS,
  DEFAULT_SORT,
  type ConfView,
  type FieldId,
  type FilterState,
  type SortState,
} from './types'
import { FieldTabs } from './components/FieldTabs'
import { FilterBar } from './components/FilterBar'
import { ConfTable } from './components/ConfTable'
import { TimelineView } from './components/TimelineView'

export function ConferencesPage() {
  const [field, setField] = useState<FieldId | 'all'>('all')
  const [filters, setFilters] = useState<FilterState>(BLANK_FILTERS)
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT)
  const [view, setView] = useState<ConfView>('table')

  // 各领域会议数（忽略筛选，只统计全量）——field tab 角标用。
  const countsByField = useMemo(() => {
    const m: Record<string, number> = {}
    for (const c of CCF_CONFS) m[c.field] = (m[c.field] || 0) + 1
    return m
  }, [])
  const totalAll = CCF_CONFS.length

  const rows = useMemo(() => applyFilters(CCF_CONFS, field, filters), [field, filters])
  const sortedRows = useMemo(() => {
    if (view === 'timeline') return rows // 时间线自己按 deadline 排
    return sort.key === 'smart' ? smartSort(rows) : applySort(rows, sort)
  }, [rows, sort, view])

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  return (
    <main className="w-full px-7 pb-16 pt-7 xl:px-10">
      <header className="mb-1.5 flex items-baseline justify-between gap-4">
        <h1 className="m-0 font-serif text-[28px] font-semibold tracking-[-0.01em] text-text">
          CCF 推荐国际学术会议
        </h1>
        <div className="whitespace-nowrap font-sans text-[13px] text-text-muted">
          今日 <strong className="font-semibold text-text">{today}</strong>
        </div>
      </header>

      <p className="mb-[18px] flex flex-wrap items-center gap-1.5 font-sans text-[12px] text-text-faint">
        <Info size={12} strokeWidth={1.8} aria-hidden className="flex-none" />
        依据 <strong className="font-semibold text-text">
          《CCF 推荐国际学术会议和期刊目录》
        </strong>{' '}
        第七版 · 2026 年 3 月更新 · 共{' '}
        <strong className="font-semibold text-text">{totalAll}</strong> 个会议 · 截稿与会期人工整理,
        <code className="rounded-[3px] bg-bg-subtle px-1.5 py-px font-mono text-[11px] text-text-muted">
          以官网公告为准
        </code>
      </p>

      <FieldTabs value={field} onChange={setField} countsByField={countsByField} total={totalAll} />

      <FilterBar
        filters={filters}
        setFilters={setFilters}
        total={totalAll}
        shown={rows.length}
        view={view}
        setView={setView}
      />

      {view === 'table' ? (
        <ConfTable rows={sortedRows} sort={sort} setSort={setSort} />
      ) : (
        <TimelineView rows={rows} />
      )}
    </main>
  )
}

export default ConferencesPage
