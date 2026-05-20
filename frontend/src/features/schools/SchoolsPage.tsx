import { useEffect, useMemo, useState } from 'react'
import { ADVISORS, SCHOOLS, SCHOOL_GROUPS, schoolDepts } from './data'
import {
  BLANK_FILTERS,
  DEFAULT_SORT,
  type Advisor,
  type FilterState,
  type GroupCode,
  type SchoolCode,
  type SortState,
} from './types'
import { applyFilters } from './filter'
import { sortAdvisors } from './sort'
import { SchoolChips } from './components/SchoolChips'
import { FilterBar } from './components/FilterBar'
import { AdvisorTable } from './components/AdvisorTable'
import { AdvisorDrawer } from './components/drawer/AdvisorDrawer'

export function SchoolsPage() {
  const [group, setGroup] = useState<GroupCode>('top2')
  const [school, setSchool] = useState<SchoolCode>('tsinghua')
  const [picked, setPicked] = useState<Advisor | null>(null)
  const [filters, setFilters] = useState<FilterState>(BLANK_FILTERS)
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT)

  // reset filters/sort when school changes
  useEffect(() => {
    setFilters(BLANK_FILTERS)
    setSort(DEFAULT_SORT)
  }, [school])

  // snap to first school in group when group changes
  useEffect(() => {
    const sg = SCHOOL_GROUPS.find((g) => g.code === group)
    const first = sg?.schools[0]
    if (sg && first && !sg.schools.includes(school)) setSchool(first)
  }, [group, school])

  const schoolAdvisors = useMemo(() => ADVISORS.filter((a) => a.school.code === school), [school])
  const depts = useMemo(() => schoolDepts(school), [school])

  const schoolCounts = useMemo(() => {
    const c = {} as Record<SchoolCode, number>
    ;(Object.keys(SCHOOLS) as SchoolCode[]).forEach((k) => {
      c[k] = ADVISORS.filter((a) => a.school.code === k).length
    })
    return c
  }, [])

  const { rows: filtered } = useMemo(
    () => applyFilters(schoolAdvisors, filters),
    [schoolAdvisors, filters],
  )
  const sorted = useMemo(() => sortAdvisors(filtered, sort), [filtered, sort])

  const allCount = ADVISORS.length
  const schoolRecruitingPos = schoolAdvisors.filter((a) => a.is_recruiting === true).length
  const schoolNeg = schoolAdvisors.filter((a) => a.reputation_tag === 'negative').length

  return (
    <main className="w-full px-7 pb-16 pt-7 xl:px-10">
      <header className="mb-4 flex items-baseline justify-between gap-4">
        <h1 className="m-0 font-serif text-[28px] font-semibold tracking-[-0.01em] text-text">
          导师投递参考 · 中国顶尖 CS/AI 高校
        </h1>
        <div className="font-sans text-[13px] text-text-muted">
          7 校 · <strong className="font-semibold text-text">{allCount}</strong> 位导师 · 当前校{' '}
          <strong className="font-semibold text-text">{schoolAdvisors.length}</strong> 位 · 招生{' '}
          <strong className="font-semibold text-cat-tools">{schoolRecruitingPos}</strong> · 风评负面{' '}
          <strong className="font-semibold text-cat-research">{schoolNeg}</strong>
        </div>
      </header>

      <SchoolChips
        group={group}
        school={school}
        schoolCounts={schoolCounts}
        onGroup={setGroup}
        onSchool={setSchool}
      />

      <FilterBar
        depts={depts}
        filters={filters}
        setFilters={setFilters}
        total={schoolAdvisors.length}
        shown={sorted.length}
      />

      <AdvisorTable rows={sorted} onPick={setPicked} sort={sort} setSort={setSort} />

      <AdvisorDrawer advisor={picked} onClose={() => setPicked(null)} />
    </main>
  )
}

export default SchoolsPage
