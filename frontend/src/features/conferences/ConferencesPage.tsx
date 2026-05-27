import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Info } from 'lucide-react'
import { getConferences } from '@/api/endpoints/conferences'
import { CCF_CONFS } from './data'
import { applyFilters } from './filter'
import { applySort, smartSort } from './sort'
import {
  BLANK_FILTERS,
  DEFAULT_SORT,
  type Conference,
  type ConfView,
  type FieldId,
  type FilterState,
  type SortState,
} from './types'
import { FieldTabs } from './components/FieldTabs'
import { FilterBar } from './components/FilterBar'
import { ConfTable } from './components/ConfTable'
import { TimelineView } from './components/TimelineView'

const CONF_STALE_MS = 30 * 60_000

export function ConferencesPage() {
  const [field, setField] = useState<FieldId | 'all'>('all')
  const [filters, setFilters] = useState<FilterState>(BLANK_FILTERS)
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT)
  const [view, setView] = useState<ConfView>('table')

  const confQuery = useQuery({
    queryKey: ['conferences'],
    queryFn: getConferences,
    staleTime: CONF_STALE_MS,
  })
  const allConfs: Conference[] = confQuery.data?.conferences ?? CCF_CONFS

  const countsByField = useMemo(() => {
    const m: Record<string, number> = {}
    for (const c of allConfs) m[c.field] = (m[c.field] || 0) + 1
    return m
  }, [allConfs])
  const totalAll = allConfs.length

  const rows = useMemo(
    () => applyFilters(allConfs, field, filters),
    [allConfs, field, filters],
  )
  const sortedRows = useMemo(() => {
    if (view === 'timeline') return rows
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
        <a
          href="https://www.ccf.org.cn/Academic_Evaluation/By_category/"
          target="_blank"
          rel="noreferrer"
          title="CCF 推荐国际学术会议和期刊目录（官方）"
          className="inline-flex items-center gap-0.5 rounded-[3px] bg-bg-subtle px-1.5 py-px font-mono text-[11px] text-text-muted transition-colors hover:text-link"
        >
          以官网公告为准
          <ExternalLink size={10} strokeWidth={1.8} aria-hidden />
        </a>
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
