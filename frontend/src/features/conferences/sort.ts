/** 表格列排序 + 智能默认排序。搬自设计稿 applySort / smartSort。 */
import { classify } from './classify'
import type { ConfStatus, Conference, SortState, Tier } from './types'

const TIER_ORDER: Record<Tier, number> = { A: 0, B: 1, C: 2 }

/** 列点击排序：tier / abbr / deadline（null deadline 沉底）。 */
export function applySort(rows: Conference[], sort: SortState): Conference[] {
  const arr = [...rows]
  arr.sort((a, b) => {
    let d = 0
    if (sort.key === 'tier') d = TIER_ORDER[a.tier] - TIER_ORDER[b.tier]
    else if (sort.key === 'abbr') d = a.abbr.localeCompare(b.abbr)
    else if (sort.key === 'deadline') {
      const aD = a.deadline ? new Date(a.deadline).getTime() : Infinity
      const bD = b.deadline ? new Date(b.deadline).getTime() : Infinity
      d = aD - bD
    }
    return sort.dir === 'asc' ? d : -d
  })
  return arr
}

const STATUS_ORDER: Record<ConfStatus, number> = { soon: 0, open: 1, tbd: 2, closed: 3 }

/** 默认排序：即将截稿 → 征稿中（按 deadline 升序）→ 未公布 / 已截止（按级别 + 简称）。 */
export function smartSort(rows: Conference[]): Conference[] {
  return [...rows].sort((a, b) => {
    const sA = classify(a)
    const sB = classify(b)
    if (STATUS_ORDER[sA] !== STATUS_ORDER[sB]) return STATUS_ORDER[sA] - STATUS_ORDER[sB]
    if (sA === 'soon' || sA === 'open') {
      return new Date(a.deadline as string).getTime() - new Date(b.deadline as string).getTime()
    }
    if (a.tier !== b.tier) return TIER_ORDER[a.tier] - TIER_ORDER[b.tier]
    return a.abbr.localeCompare(b.abbr)
  })
}
