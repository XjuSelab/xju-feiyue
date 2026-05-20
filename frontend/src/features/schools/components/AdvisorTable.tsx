import { ChevronDown, ChevronUp, ChevronsUpDown, ExternalLink, Info } from 'lucide-react'
import type { MouseEvent } from 'react'
import { cn } from '@/lib/cn'
import { formatRelTime } from '../data'
import type { Advisor, SortKey, SortState } from '../types'
import { EmailCell } from './cells/EmailCell'
import { RecruitCell } from './cells/RecruitCell'
import { RepCell } from './cells/RepCell'
import { SummaryCell } from './cells/SummaryCell'

interface AdvisorTableProps {
  rows: Advisor[]
  onPick: (a: Advisor) => void
  sort: SortState
  setSort: (s: SortState) => void
}

type Col = {
  k: SortKey | 'dept' | 'title' | 'interests' | 'email' | 'summary' | 'actions'
  label: string
  width: number
  sortable?: boolean
}

const COLS: Col[] = [
  { k: 'name', label: '姓名', width: 92, sortable: true },
  { k: 'dept', label: '学院', width: 160 },
  { k: 'title', label: '职称', width: 88 },
  { k: 'interests', label: '研究方向', width: 180 },
  { k: 'email', label: '邮箱', width: 220 },
  { k: 'recruit', label: '招生', width: 88, sortable: true },
  { k: 'rep', label: '风评', width: 92, sortable: true },
  { k: 'summary', label: '投递参考', width: 280 },
  { k: 'updated', label: '更新于', width: 80, sortable: true },
  { k: 'actions', label: '', width: 132 },
]

export function AdvisorTable({ rows, onPick, sort, setSort }: AdvisorTableProps) {
  if (rows.length === 0) {
    return (
      <div className="overflow-hidden rounded-lg border border-border bg-bg">
        <div className="px-5 py-16 text-center font-sans text-[13px] text-text-faint">
          <div className="mb-1.5 font-serif text-[18px] font-semibold text-text-muted">
            当前筛选下无导师
          </div>
          <div>试着取消几个 chip,或清空搜索关键词</div>
        </div>
      </div>
    )
  }

  const sortIcon = (k: SortKey) => {
    if (sort.key !== k) return <ChevronsUpDown size={10} strokeWidth={2} />
    return sort.dir === 'desc' ? (
      <ChevronDown size={10} strokeWidth={2.2} />
    ) : (
      <ChevronUp size={10} strokeWidth={2.2} />
    )
  }
  const onSortClick = (k: SortKey) => {
    if (sort.key === k) {
      setSort({ key: k, dir: sort.dir === 'desc' ? 'asc' : 'desc' })
    } else {
      setSort({ key: k, dir: 'desc' })
    }
  }

  const stopProp = (e: MouseEvent) => e.stopPropagation()

  return (
    <div className="schools-tbl-wrap overflow-x-auto overflow-y-visible rounded-lg border border-border bg-bg">
      <table className="w-full min-w-[1412px] table-fixed border-separate border-spacing-0 font-sans text-[13px]">
        <colgroup>
          {COLS.map((c) => (
            <col key={c.k} style={{ width: c.width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {COLS.map((c) => {
              const active = c.sortable && sort.key === c.k
              return (
                <th
                  key={c.k}
                  onClick={c.sortable ? () => onSortClick(c.k as SortKey) : undefined}
                  className={cn(
                    'select-none whitespace-nowrap border-b border-border bg-bg-subtle px-3 py-2.5 text-left text-[11.5px] font-semibold uppercase tracking-[0.05em]',
                    c.sortable && 'cursor-pointer transition-colors hover:text-text',
                    active ? 'text-text' : 'text-text-muted',
                  )}
                >
                  {c.label}
                  {c.sortable && (
                    <span
                      className={cn(
                        'ml-[3px] inline-block align-[-1px] transition-colors',
                        active ? 'text-text' : 'text-text-faint',
                      )}
                    >
                      {sortIcon(c.k as SortKey)}
                    </span>
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => {
            const rel = formatRelTime(a.last_enriched_at)
            const isNeg = a.reputation_tag === 'negative'
            return (
              <tr
                key={a.id}
                data-neg={isNeg || undefined}
                className={cn('schools-tbl-row', isNeg && 'schools-tbl-row-neg')}
              >
                <Td>
                  <div
                    onClick={() => onPick(a)}
                    className="cursor-pointer font-serif text-[14.5px] font-semibold leading-[1.3] tracking-[-0.005em] text-text hover:text-link"
                  >
                    {a.name_cn}
                  </div>
                  {a.name_en && (
                    <span className="mt-px block font-sans text-[11px] font-normal text-text-faint">
                      {a.name_en}
                    </span>
                  )}
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-[3px]">
                    {a.departments.map((d) => (
                      <span
                        key={d.code}
                        title={d.name_cn}
                        className="inline-flex max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-[3px] bg-bg-subtle px-1.5 py-px font-sans text-[11px] leading-[1.55] text-text-muted"
                      >
                        {d.name_cn}
                      </span>
                    ))}
                  </div>
                </Td>
                <Td>
                  <span
                    className={cn(
                      'whitespace-nowrap text-[12.5px]',
                      a.title === '助理教授'
                        ? 'text-cat-tools'
                        : (a.title || '').includes('教授')
                          ? 'font-medium text-text'
                          : 'text-text',
                    )}
                  >
                    {a.title || '—'}
                  </span>
                </Td>
                <Td>
                  {a.research_interests.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-[3px]">
                      {a.research_interests.slice(0, 3).map((r, i) => (
                        <span
                          key={i}
                          className="inline-flex rounded-[3px] bg-bg-subtle px-[7px] py-px font-sans text-[11.5px] leading-[1.6] text-text-muted"
                        >
                          {r}
                        </span>
                      ))}
                      {a.research_interests.length > 3 && (
                        <span className="font-mono text-[11px] text-text-faint">
                          +{a.research_interests.length - 3}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="font-sans text-[11.5px] italic text-text-faint">未填</span>
                  )}
                </Td>
                <Td>
                  <EmailCell email={a.email} obfuscated={a.email_obfuscated} />
                </Td>
                <Td>
                  <RecruitCell status={a.is_recruiting} />
                </Td>
                <Td>
                  <RepCell tag={a.reputation_tag} />
                </Td>
                <Td>
                  <SummaryCell text={a.enriched_summary} />
                </Td>
                <Td>
                  <span
                    className={cn(
                      'whitespace-nowrap text-[11.5px]',
                      rel ? 'font-mono text-text-muted' : 'font-sans italic text-text-faint',
                    )}
                  >
                    {rel || '未调研'}
                  </span>
                </Td>
                <Td>
                  <div className="inline-flex items-center gap-0.5">
                    <a
                      href={a.homepage}
                      target="_blank"
                      rel="noreferrer"
                      title="个人主页"
                      onClick={stopProp}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-[4px] text-text-muted transition-colors hover:bg-bg-hover hover:text-text"
                    >
                      <ExternalLink size={12} strokeWidth={1.8} />
                    </a>
                    <a
                      href={a.source_url}
                      target="_blank"
                      rel="noreferrer"
                      title="原始爬取页"
                      onClick={stopProp}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-[4px] text-text-muted transition-colors hover:bg-bg-hover hover:text-text"
                    >
                      <Info size={12} strokeWidth={1.8} />
                    </a>
                    <button
                      type="button"
                      onClick={() => onPick(a)}
                      title="展开详情抽屉"
                      className="inline-flex h-7 items-center justify-center rounded-[4px] px-2 font-medium text-text transition-colors hover:bg-bg-hover"
                    >
                      详情
                    </button>
                  </div>
                </Td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="schools-tbl-cell border-b border-border bg-bg px-3 py-3 align-middle text-text transition-colors">
      {children}
    </td>
  )
}
