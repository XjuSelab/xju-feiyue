/** 客户端筛选（field tab + filter bar）。搬自设计稿 App 的 rows useMemo。 */
import { classify, daysUntil } from './classify'
import type { Conference, FieldId, FilterState } from './types'

export function applyFilters(
  confs: Conference[],
  field: FieldId | 'all',
  filters: FilterState,
): Conference[] {
  let r = confs
  if (field !== 'all') r = r.filter((c) => c.field === field)
  if (filters.tier.length) r = r.filter((c) => filters.tier.includes(c.tier))
  if (filters.status.length) r = r.filter((c) => filters.status.includes(classify(c)))
  if (filters.pub.length) r = r.filter((c) => filters.pub.includes(c.publisher))
  if (filters.aOnly) r = r.filter((c) => c.tier === 'A')
  if (filters.upcoming) {
    r = r.filter((c) => {
      const d = daysUntil(c.deadline)
      return d != null && d >= 0
    })
  }
  const q = filters.q.trim().toLowerCase()
  if (q) {
    r = r.filter(
      (c) =>
        c.abbr.toLowerCase().includes(q) ||
        c.name_full.toLowerCase().includes(q) ||
        (c.publisher || '').toLowerCase().includes(q) ||
        (c.location || '').toLowerCase().includes(q),
    )
  }
  return r
}
