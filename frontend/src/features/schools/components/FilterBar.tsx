import { Search } from 'lucide-react'
import { Chip, type ChipTone } from './Chip'
import { Toggle } from './Toggle'
import type { Department, FilterState, RecruitFilterValue, Reputation } from '../types'

interface FilterBarProps {
  depts: Department[]
  filters: FilterState
  setFilters: (f: FilterState) => void
  total: number
  shown: number
}

const TITLE_OPTS = ['教授', '副教授', '助理教授', '研究员', '其他'] as const

const RECRUIT_OPTS: { v: RecruitFilterValue; l: string; tone: ChipTone }[] = [
  { v: 'yes', l: '招生', tone: 'pos' },
  { v: 'unk', l: '未知', tone: 'unk' },
  { v: 'no', l: '不招', tone: 'neg' },
]

const REP_OPTS: { v: Reputation; l: string; tone: ChipTone }[] = [
  { v: 'positive', l: '正面', tone: 'pos' },
  { v: 'neutral', l: '中性', tone: 'neu' },
  { v: 'negative', l: '负面', tone: 'neg' },
  { v: 'unknown', l: '未知', tone: 'unk' },
]

export function FilterBar({ depts, filters, setFilters, total, shown }: FilterBarProps) {
  function toggleStr<K extends 'dept' | 'title'>(key: K, v: string) {
    const cur = filters[key]
    setFilters({
      ...filters,
      [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v],
    })
  }
  function toggleRecruit(v: RecruitFilterValue) {
    const cur = filters.recruit
    setFilters({
      ...filters,
      recruit: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v],
    })
  }
  function toggleRep(v: Reputation) {
    const cur = filters.rep
    setFilters({
      ...filters,
      rep: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v],
    })
  }

  const labelCls =
    'flex-none w-14 font-sans text-[11.5px] font-semibold uppercase tracking-[0.06em] text-text-faint'
  const rowCls = 'flex flex-wrap items-center gap-2.5'
  const chipsCls = 'flex min-w-0 flex-1 flex-wrap gap-1'

  return (
    <div className="mb-3 flex flex-col gap-2 rounded-lg bg-bg-subtle px-3.5 py-3">
      <div className={rowCls}>
        <span className={labelCls}>学院</span>
        <div className={chipsCls}>
          {depts.map((d) => (
            <Chip
              key={d.code}
              on={filters.dept.includes(d.code)}
              onClick={() => toggleStr('dept', d.code)}
            >
              {d.name_cn}
            </Chip>
          ))}
          {depts.length === 0 && <span className="text-xs text-text-faint">—</span>}
        </div>
      </div>

      <div className={rowCls}>
        <span className={labelCls}>职称</span>
        <div className={chipsCls}>
          {TITLE_OPTS.map((t) => (
            <Chip key={t} on={filters.title.includes(t)} onClick={() => toggleStr('title', t)}>
              {t}
            </Chip>
          ))}
        </div>
      </div>

      <div className={rowCls}>
        <span className={labelCls}>招生</span>
        <div className={chipsCls}>
          {RECRUIT_OPTS.map((o) => (
            <Chip
              key={o.v}
              tone={o.tone}
              on={filters.recruit.includes(o.v)}
              onClick={() => toggleRecruit(o.v)}
            >
              {o.l}
            </Chip>
          ))}
        </div>
      </div>

      <div className={rowCls}>
        <span className={labelCls}>风评</span>
        <div className={chipsCls}>
          {REP_OPTS.map((o) => (
            <Chip
              key={o.v}
              tone={o.tone}
              on={filters.rep.includes(o.v)}
              onClick={() => toggleRep(o.v)}
            >
              {o.l}
            </Chip>
          ))}
        </div>
      </div>

      <div className={rowCls}>
        <div className="relative max-w-[320px] flex-1">
          <Search
            size={13}
            strokeWidth={1.8}
            className="pointer-events-none absolute left-[9px] top-1/2 -translate-y-1/2 text-text-faint"
          />
          <input
            type="search"
            placeholder="搜索姓名 / 简介 / 评价内容…"
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            className="w-full rounded-md border border-border bg-bg py-1.5 pl-[30px] pr-2.5 font-sans text-[13px] text-text outline-none transition-colors focus:border-text"
          />
        </div>
        <Toggle
          on={filters.hasEmail}
          onClick={() => setFilters({ ...filters, hasEmail: !filters.hasEmail })}
        >
          有邮箱
        </Toggle>
        <Toggle
          on={filters.hasSummary}
          onClick={() => setFilters({ ...filters, hasSummary: !filters.hasSummary })}
        >
          有投递参考
        </Toggle>
        <span className="ml-auto whitespace-nowrap font-mono text-[11.5px] text-text-faint">
          显示 {shown} / {total}
        </span>
      </div>
    </div>
  )
}
