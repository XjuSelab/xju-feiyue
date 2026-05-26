import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { classify } from '../classify'
import type { Conference, SortKey, SortState } from '../types'
import { TierBadge } from './cells/TierBadge'
import { FieldChip } from './cells/FieldChip'
import { WhereCell } from './cells/WhereCell'
import { DeadlineCell } from './cells/DeadlineCell'
import { LinksCell } from './cells/LinksCell'

interface ConfTableProps {
  rows: Conference[]
  sort: SortState
  setSort: (s: SortState) => void
}

type ColKey = SortKey | 'field' | 'publisher' | 'where' | 'links'
type Col = { k: ColKey; label: string; width: number; sortable?: boolean }

const COLS: Col[] = [
  { k: 'abbr', label: '会议', width: 200, sortable: true },
  { k: 'tier', label: '级别', width: 70, sortable: true },
  { k: 'field', label: '领域', width: 110 },
  { k: 'publisher', label: '出版方', width: 100 },
  { k: 'where', label: '地点 · 日期', width: 230 },
  { k: 'deadline', label: '截稿日期', width: 220, sortable: true },
  { k: 'links', label: '链接', width: 180 },
]

export function ConfTable({ rows, sort, setSort }: ConfTableProps) {
  if (rows.length === 0) {
    return (
      <div className="overflow-hidden rounded-lg border border-border bg-bg">
        <div className="px-5 py-16 text-center font-sans text-[14px] text-text-faint">
          <div className="mb-1.5 font-serif text-[18px] font-semibold text-text-muted">
            当前筛选下无会议
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
    if (sort.key === k) setSort({ key: k, dir: sort.dir === 'desc' ? 'asc' : 'desc' })
    else setSort({ key: k, dir: 'asc' })
  }

  return (
    <div className="conf-tbl-wrap overflow-x-auto rounded-lg border border-border bg-bg">
      <table className="w-full min-w-[1200px] table-fixed border-separate border-spacing-0 font-sans text-[13px]">
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
          {rows.map((c) => {
            const soon = classify(c) === 'soon'
            return (
              <tr key={c.id} className={cn('conf-tbl-row', soon && 'conf-tbl-row-soon')}>
                <Td>
                  <div className="flex flex-col gap-1">
                    <span className="font-serif text-[17px] font-semibold leading-[1.1] tracking-[-0.01em] text-text">
                      {c.abbr}
                    </span>
                    <span className="break-words font-sans text-[11.5px] leading-[1.35] text-text-faint">
                      {c.name_full}
                    </span>
                  </div>
                </Td>
                <Td>
                  <TierBadge tier={c.tier} />
                </Td>
                <Td>
                  <FieldChip field={c.field} />
                </Td>
                <Td>
                  <span
                    title={c.publisher}
                    className="inline-block max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-[3px] bg-bg-subtle px-1.5 py-px font-mono text-[11px] text-text-muted"
                  >
                    {c.publisher}
                  </span>
                </Td>
                <Td>
                  <WhereCell conf={c} />
                </Td>
                <Td>
                  <DeadlineCell conf={c} />
                </Td>
                <Td>
                  <LinksCell conf={c} />
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
    <td className="conf-tbl-cell border-b border-border bg-bg px-3 py-3.5 align-middle text-text transition-colors">
      {children}
    </td>
  )
}
