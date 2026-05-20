import type { Advisor, FilterState } from './types'

const KNOWN_TITLES = ['教授', '副教授', '助理教授', '研究员']

export interface FilterResult {
  rows: Advisor[]
  stats: { total: number; shown: number; recruiting: number }
}

export function applyFilters(advisors: Advisor[], state: FilterState): FilterResult {
  const q = state.q.trim().toLowerCase()

  const rows = advisors.filter((a) => {
    if (state.dept.length && !a.departments.some((d) => state.dept.includes(d.code))) return false

    if (state.title.length) {
      const t = a.title || '其他'
      const ok = state.title.some((tf) => (tf === '其他' ? !KNOWN_TITLES.includes(t) : t === tf))
      if (!ok) return false
    }

    if (state.recruit.length) {
      const r = a.is_recruiting === true ? 'yes' : a.is_recruiting === false ? 'no' : 'unk'
      if (!state.recruit.includes(r)) return false
    }

    if (state.rep.length) {
      const r = a.reputation_tag || 'unknown'
      if (!state.rep.includes(r)) return false
    }

    if (state.hasEmail && !a.email) return false
    if (state.hasSummary && !a.enriched_summary) return false

    if (q) {
      const hay = [
        a.name_cn,
        a.bio_text || '',
        (a.evaluations || []).map((e) => e.content).join(' '),
        (a.research_interests || []).join(' '),
      ]
        .join(' ')
        .toLowerCase()
      if (!hay.includes(q)) return false
    }

    return true
  })

  return {
    rows,
    stats: {
      total: advisors.length,
      shown: rows.length,
      recruiting: rows.filter((a) => a.is_recruiting === true).length,
    },
  }
}
