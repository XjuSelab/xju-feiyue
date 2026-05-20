import type { Advisor, Reputation, SortKey, SortState } from './types'

const recruitOrder = (x: boolean | null): number => (x === true ? 0 : x == null ? 1 : 2)

const repOrder = (x: Reputation | null): number => {
  switch (x) {
    case 'positive':
      return 0
    case 'neutral':
      return 1
    case 'unknown':
      return 2
    case 'negative':
      return 3
    default:
      return 4
  }
}

export function defaultSort(a: Advisor, b: Advisor): number {
  if (recruitOrder(a.is_recruiting) !== recruitOrder(b.is_recruiting)) {
    return recruitOrder(a.is_recruiting) - recruitOrder(b.is_recruiting)
  }
  if (repOrder(a.reputation_tag) !== repOrder(b.reputation_tag)) {
    return repOrder(a.reputation_tag) - repOrder(b.reputation_tag)
  }
  const cA = a.recruiting_confidence ?? 0
  const cB = b.recruiting_confidence ?? 0
  if (cA !== cB) return cB - cA
  return a.name_cn.localeCompare(b.name_cn, 'zh')
}

export function sortAdvisors(rows: Advisor[], sort: SortState): Advisor[] {
  const arr = [...rows]
  if (sort.key === 'default') {
    arr.sort(defaultSort)
    return arr
  }
  arr.sort((a, b) => byKey(a, b, sort.key, sort.dir))
  return arr
}

function byKey(a: Advisor, b: Advisor, key: SortKey, dir: 'asc' | 'desc'): number {
  const desc = dir === 'desc'
  if (key === 'name') {
    return a.name_cn.localeCompare(b.name_cn, 'zh') * (desc ? -1 : 1)
  }
  if (key === 'recruit') {
    return (recruitOrder(a.is_recruiting) - recruitOrder(b.is_recruiting)) * (desc ? 1 : -1)
  }
  if (key === 'rep') {
    return (repOrder(a.reputation_tag) - repOrder(b.reputation_tag)) * (desc ? 1 : -1)
  }
  if (key === 'updated') {
    const dA = a.last_enriched_at ? new Date(a.last_enriched_at).getTime() : 0
    const dB = b.last_enriched_at ? new Date(b.last_enriched_at).getTime() : 0
    return desc ? dB - dA : dA - dB
  }
  return 0
}
